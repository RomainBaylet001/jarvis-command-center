"""Publish catalogue market data. Run from GitHub Actions, never the browser."""

import copy
import json
import math
import re
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import exchange_calendars as xcals
import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "public" / "data"
CATALOG = DATA / "instruments.json"
OUTPUT = DATA / "market-data.json"
UTC = timezone.utc

MARKETS = {
    "XETR": ("XETR", "GER", "Europe/Berlin"),
    "NMS": ("XNYS", "NMS", "America/New_York"),
}

MINOR_UNITS = {
    "GBp": ("GBP", 0.01),
    "GBX": ("GBP", 0.01),
}


def positive(value):
    return (
        not isinstance(value, bool)
        and isinstance(value, (int, float))
        and math.isfinite(value)
        and value > 0
    )


def iso(value):
    return value.astimezone(UTC).isoformat(timespec="seconds")


def stamp(value, now):
    try:
        parsed = datetime.fromisoformat(
            value.replace("Z", "+00:00")
        )

        if parsed.tzinfo and parsed <= now + timedelta(minutes=5):
            return parsed.astimezone(UTC)

    except (AttributeError, TypeError, ValueError, OverflowError):
        pass

    return None


def provider_stamp(value, now):
    if not positive(value):
        return None

    try:
        parsed = datetime.fromtimestamp(value, UTC)

        return (
            parsed
            if parsed <= now + timedelta(minutes=5)
            else None
        )

    except (ValueError, OverflowError, OSError):
        return None


def retry(operation):
    for attempt in range(2):
        try:
            return operation()

        except Exception:
            if attempt:
                raise

            time.sleep(2)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalog(path):
    catalog = read_json(path)

    if (
        catalog.get("schemaVersion") != 1
        or catalog.get("baseCurrency") != "EUR"
    ):
        raise ValueError(
            "Unsupported catalogue version or base currency"
        )

    items = catalog.get("instruments")

    if not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise ValueError(
            "Catalogue must contain between 1 and 100 listings"
        )

    seen = set()

    for item in items:
        if not isinstance(item, dict):
            raise ValueError("Invalid catalogue listing")

        symbol = item.get("symbol", "")
        exchange = item.get("exchange", "")
        currency = item.get("currency", "")

        identity = f"yahoo:{exchange}:{symbol}:{currency}"

        if (
            item.get("provider") != "yahoo"
            or not isinstance(symbol, str)
            or not re.fullmatch(
                r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}",
                symbol,
            )
            or exchange not in MARKETS
            or not isinstance(currency, str)
            or not re.fullmatch(r"[A-Z]{3}", currency)
            or item.get("type") not in ("STOCK", "ETF")
            or not isinstance(item.get("name"), str)
            or not item["name"].strip()
            or item.get("id") != identity
            or identity in seen
        ):
            raise ValueError(
                f"Invalid or duplicate listing: {symbol}"
            )

        seen.add(identity)

    references = [
        *catalog.get("legacyAssets", {}).values(),
        *catalog.get("benchmarks", {}).values(),
    ]

    if any(identity not in seen for identity in references):
        raise ValueError("Catalogue references an unknown listing")

    return catalog


def completed(day, calendar, now):
    label = pd.Timestamp(day)

    return (
        calendar.is_session(label)
        and calendar.session_close(label).to_pydatetime()
        + timedelta(minutes=30) <= now
    )


def clean_history(rows, calendar, now):
    result = {}

    if not isinstance(rows, list):
        return []

    for row in rows:
        try:
            day, value = row

            if (
                isinstance(day, str)
                and date.fromisoformat(day).isoformat() == day
                and positive(value)
                and completed(day, calendar, now)
            ):
                result[day] = value

        except (ValueError, TypeError, OverflowError):
            continue

    return sorted(result.items())


def choose_quote(old, new, identity, currency, now):
    valid = []

    for quote in (old, new):
        if not isinstance(quote, dict):
            continue

        when = stamp(quote.get("asOf"), now)

        if (
            quote.get("instrumentId") == identity
            and quote.get("currency") == currency
            and quote.get("type") in ("delayed", "closing")
            and positive(quote.get("price"))
            and when is not None
        ):
            valid.append((when, quote))

    return (
        copy.deepcopy(
            max(valid, key=lambda entry: entry[0])[1]
        )
        if valid
        else None
    )


def update_listing(item, previous, calendar, now):
    identity = item["id"]
    symbol = item["symbol"]
    currency = item["currency"]

    if previous.get("instrument") != item:
        previous = {}

    history = clean_history(
        previous.get("history"),
        calendar,
        now,
    )

    quote = choose_quote(
        previous.get("quote"),
        None,
        identity,
        currency,
        now,
    )

    history_fetched = previous.get("historyFetchedAt")

    if not stamp(history_fetched, now):
        history_fetched = None

    events = []

    for event in previous.get("splits", []):
        if isinstance(event, dict) and positive(event.get("ratio")):
            try:
                if completed(
                    date.fromisoformat(event["date"]),
                    calendar,
                    now,
                ):
                    events.append(event)

            except (KeyError, TypeError, ValueError):
                pass

    warnings = []
    ticker = yf.Ticker(symbol)

    try:
        info = retry(ticker.get_info)
        raw_currency = info.get("currency")

        major, scale = MINOR_UNITS.get(
            raw_currency,
            (raw_currency, 1.0),
        )

        if (
            info.get("symbol") != symbol
            or major != currency
            or info.get("exchange")
            != MARKETS[item["exchange"]][1]
            or info.get("quoteType")
            != ("ETF" if item["type"] == "ETF" else "EQUITY")
        ):
            raise ValueError(
                "Provider listing identity mismatch"
            )

        when = provider_stamp(
            info.get("regularMarketTime"),
            now,
        )

        price = info.get("regularMarketPrice")

        if positive(price) and when:
            fresh = {
                "instrumentId": identity,
                "currency": currency,
                "price": price * scale,
                "asOf": iso(when),
                "type": "delayed",
            }

            quote = choose_quote(
                quote,
                fresh,
                identity,
                currency,
                now,
            )

        else:
            warnings.append(
                "No verified timestamped quote returned"
            )

    except Exception as error:
        warnings.append(
            "Listing verification failed: "
            f"{type(error).__name__}"
        )

        info = None

    if info is not None:
        try:
            frame = retry(
                lambda: ticker.history(
                    period="2y",
                    interval="1d",
                    auto_adjust=False,
                    actions=True,
                    timeout=25,
                )
            )

            if frame.empty or frame.index.tz is None:
                raise ValueError("Missing dated history")

            metadata = ticker.get_history_metadata()

            if metadata.get("currency") != raw_currency:
                raise ValueError(
                    "History quotation units differ"
                )

            rows = []
            splits = []

            for index, row in frame.iterrows():
                day = index.tz_convert(calendar.tz).date()

                if not completed(day, calendar, now):
                    continue

                close = float(row["Close"]) * scale

                if positive(close):
                    rows.append((day.isoformat(), close))

                ratio = float(row.get("Stock Splits", 0))

                if positive(ratio):
                    splits.append({
                        "date": day.isoformat(),
                        "ratio": ratio,
                    })

            if not rows:
                raise ValueError(
                    "No completed daily closes"
                )

            # Replace the series together so revised split
            # adjustments remain consistent.
            history = sorted(rows)
            events = splits
            history_fetched = iso(now)

        except Exception as error:
            warnings.append(
                f"History retained: {type(error).__name__}"
            )

    if history:
        day, close = history[-1]

        fallback = {
            "instrumentId": identity,
            "currency": currency,
            "price": close,
            "asOf": iso(
                calendar.session_close(
                    pd.Timestamp(day)
                ).to_pydatetime()
            ),
            "type": "closing",
        }

        quote = choose_quote(
            quote,
            fallback,
            identity,
            currency,
            now,
        )

    else:
        warnings.append("Daily history unavailable")

    if quote is None:
        warnings.append("Market price unavailable")

    return {
        "instrument": item,
        "quote": quote,
        "history": history,
        "historyFetchedAt": history_fetched,
        "historySettings": {
            "field": "Close",
            "autoAdjust": False,
        },
        "splits": events,
        "warnings": warnings,
    }


def update_fx(currency, previous, now):
    result = {
        "from": currency,
        "to": "EUR",
        "rate": None,
        "asOf": None,
        "type": "delayed",
        "history": [],
        "historyFetchedAt": None,
        "warnings": [],
    }

    matching = (
        previous.get("from") == currency
        and previous.get("to") == "EUR"
    )

    if matching:
        if (
            positive(previous.get("rate"))
            and stamp(previous.get("asOf"), now)
        ):
            result.update(
                rate=previous["rate"],
                asOf=previous["asOf"],
            )

        for row in previous.get("history", []):
            try:
                day, rate = row

                if (
                    date.fromisoformat(day) < now.date()
                    and positive(rate)
                ):
                    result["history"].append((day, rate))

            except (ValueError, TypeError):
                pass

        if stamp(previous.get("historyFetchedAt"), now):
            result["historyFetchedAt"] = previous[
                "historyFetchedAt"
            ]

    try:
        ticker = yf.Ticker(f"{currency}EUR=X")
        info = retry(ticker.get_info)

        if (
            info.get("symbol") != f"{currency}EUR=X"
            or info.get("currency") != "EUR"
            or info.get("quoteType") != "CURRENCY"
        ):
            raise ValueError("Currency pair mismatch")

        rate = info.get("regularMarketPrice")

        when = provider_stamp(
            info.get("regularMarketTime"),
            now,
        )

        baseline = stamp(result["asOf"], now)

        if positive(rate) and when:
            if baseline is None or when >= baseline:
                result.update(
                    rate=rate,
                    asOf=iso(when),
                )

        else:
            result["warnings"].append(
                "No timestamped exchange-rate quote returned"
            )

        frame = retry(
            lambda: ticker.history(
                period="2y",
                interval="1d",
                auto_adjust=False,
                actions=False,
                timeout=25,
            )
        )

        if frame.empty or frame.index.tz is None:
            raise ValueError("Missing FX history")

        if (
            ticker.get_history_metadata().get("currency")
            != "EUR"
        ):
            raise ValueError("FX history currency mismatch")

        rows = []

        for index, close in frame["Close"].items():
            # Exclude today's FX bar.
            # A partial day is not a completed daily close.
            if index.date() < min(
                now.date(),
                now.astimezone(frame.index.tz).date(),
            ):
                rate = float(close)

                if positive(rate):
                    rows.append(
                        (index.date().isoformat(), rate)
                    )

        if not rows:
            raise ValueError("No completed FX days")

        result.update(
            history=sorted(rows),
            historyFetchedAt=iso(now),
        )

    except Exception as error:
        result["warnings"].append(
            "Exchange-rate data retained: "
            f"{type(error).__name__}"
        )

    if result["rate"] is None:
        result["warnings"].append(
            "EUR conversion unavailable"
        )

    return result


def main():
    now = datetime.now(UTC)
    catalog = load_catalog(CATALOG)

    previous = read_json(OUTPUT) if OUTPUT.exists() else {}

    if (
        previous.get("schemaVersion") != 1
        or previous.get("baseCurrency") != "EUR"
    ):
        previous = {}

    payload = {
        "schemaVersion": 1,
        "baseCurrency": "EUR",
        "source": (
            "Yahoo Finance via yfinance; "
            "delayed quotes and daily history"
        ),
        "attemptedAt": iso(now),
        "instruments": {},
        "fx": {},
        "markets": {},
    }

    calendars = {}

    exchanges = {
        item["exchange"]
        for item in catalog["instruments"]
    }

    for exchange in sorted(exchanges):
        calendar_name, _, zone = MARKETS[exchange]

        calendar = xcals.get_calendar(
            calendar_name,
            start=str(
                now.date() - timedelta(days=1200)
            ),
            end=str(
                now.date() + timedelta(days=90)
            ),
        )

        calendars[exchange] = calendar

        sessions = [
            {
                "date": label.date().isoformat(),
                "open": iso(
                    calendar.session_open(
                        label
                    ).to_pydatetime()
                ),
                "close": iso(
                    calendar.session_close(
                        label
                    ).to_pydatetime()
                ),
            }
            for label in calendar.sessions_in_range(
                str(now.date() - timedelta(days=7)),
                str(now.date() + timedelta(days=60)),
            )
        ]

        payload["markets"][exchange] = {
            "calendar": calendar_name,
            "timezone": zone,
            "calendarStart": str(
                now.date() - timedelta(days=7)
            ),
            "calendarEnd": str(
                now.date() + timedelta(days=60)
            ),
            "sessions": sessions,
        }

    for item in catalog["instruments"]:
        entry = update_listing(
            item,
            previous.get("instruments", {}).get(
                item["id"],
                {},
            ),
            calendars[item["exchange"]],
            now,
        )

        payload["instruments"][item["id"]] = entry

        print(
            f'{item["symbol"]}: '
            f'{len(entry["history"])} daily closes; '
            f'{len(entry["warnings"])} warnings'
        )

        for warning in entry["warnings"]:
            print(
                f'::warning::{item["symbol"]}: {warning}'
            )

    currencies = {
        item["currency"]
        for item in catalog["instruments"]
    } - {"EUR"}

    for currency in sorted(currencies):
        entry = update_fx(
            currency,
            previous.get("fx", {}).get(currency, {}),
            now,
        )

        payload["fx"][currency] = entry

        for warning in entry["warnings"]:
            print(
                f"::warning::{currency}/EUR: {warning}"
            )

    if not any(
        entry["quote"]
        for entry in payload["instruments"].values()
    ):
        raise RuntimeError(
            "No valid prices; existing "
            "market-data.json was not replaced"
        )

    DATA.mkdir(parents=True, exist_ok=True)

    temporary = OUTPUT.with_suffix(".json.tmp")

    temporary.write_text(
        json.dumps(
            payload,
            indent=2,
            allow_nan=False,
        ) + "\n",
        encoding="utf-8",
    )

    temporary.replace(OUTPUT)

    print(
        "Published market-data.json; "
        "original quote timestamps preserved."
    )


if __name__ == "__main__":
    main()
