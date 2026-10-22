"""NORTHSTAR market-data prototype. No portfolio data is stored here."""

import copy
import math
import re
import time
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from tempfile import gettempdir
from threading import Lock

import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Serverless deployments provide writable temporary storage.
yf.set_tz_cache_location(str(Path(gettempdir()) / "northstar-yfinance"))

app = FastAPI(title="NORTHSTAR Market API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://romainbaylet.com",
        "https://www.romainbaylet.com",
        "https://romainbaylet001.github.io",
    ],
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
    allow_credentials=False,
)

SOURCE = "Yahoo Finance via yfinance"

SYMBOL = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
EXCHANGE = re.compile(r"^[A-Z0-9][A-Z0-9._-]{0,31}$")

KINDS = {
    "EQUITY": "STOCK",
    "ETF": "ETF",
}

# Keep these identifiers consistent with assets.js.
KNOWN = {
    "VWCE.DE": ("XETR", "IE00BK5BQT80"),
    "VFEA.DE": ("XETR", "IE00BK5BR733"),
}

# Convert pence quotations into pounds.
MINOR_UNITS = {
    "GBp": ("GBP", 0.01),
    "GBX": ("GBP", 0.01),
}

_cache = OrderedDict()
_lock = Lock()


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def cached(key, ttl, build):
    """Bounded per-process cache; not persistent storage or a rate limiter."""
    with _lock:
        item = _cache.get(key)

        if item and item[0] > time.monotonic():
            _cache.move_to_end(key)
            return copy.deepcopy(item[1])

        _cache.pop(key, None)

    value = build()

    with _lock:
        _cache[key] = (
            time.monotonic() + ttl,
            copy.deepcopy(value),
        )
        _cache.move_to_end(key)

        while len(_cache) > 256:
            _cache.popitem(last=False)

    return value


def clean(value, limit=180):
    if not isinstance(value, str):
        return ""

    value = value.strip()

    if (
        not value
        or len(value) > limit
        or any(ord(character) < 32 for character in value)
    ):
        return ""

    return value


def valid_symbol(value):
    value = clean(value, 64)

    if not SYMBOL.fullmatch(value):
        raise HTTPException(
            400,
            "Enter a valid listing symbol, such as AAPL or VWCE.DE.",
        )

    return value


def positive(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None

    if not math.isfinite(value) or value <= 0:
        return None

    return float(value)


def timestamp(value):
    value = positive(value)

    if value is None or value > time.time() + 300:
        return None

    try:
        return datetime.fromtimestamp(
            value,
            timezone.utc,
        ).isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def valid_isin(value):
    value = clean(value, 12).upper()

    if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", value):
        return ""

    digits = "".join(
        str(ord(character) - 55)
        if character.isalpha()
        else character
        for character in value
    )

    total = 0

    for index, digit in enumerate(reversed(digits)):
        number = int(digit) * (2 if index % 2 else 1)
        total += number // 10 + number % 10

    return value if total % 10 == 0 else ""


def info_for(symbol):
    try:
        info = yf.Ticker(symbol).get_info()
    except Exception:
        raise HTTPException(
            502,
            "The market-data provider is unavailable. Try again shortly.",
        ) from None

    if not isinstance(info, dict) or not info:
        raise HTTPException(
            404,
            "This listing could not be verified.",
        )

    # Never silently substitute a different listing.
    returned_symbol = clean(info.get("symbol"), 64)

    if returned_symbol.upper() != symbol.upper():
        raise HTTPException(
            502,
            "The provider returned a different listing.",
        )

    return info


def listing_from(info):
    symbol = clean(info.get("symbol"), 64)
    kind = KINDS.get(info.get("quoteType"))

    if not kind or not SYMBOL.fullmatch(symbol):
        raise HTTPException(
            422,
            "Only verified stock and ETF listings are supported.",
        )

    raw_currency = clean(info.get("currency"), 3)

    currency, scale = MINOR_UNITS.get(
        raw_currency,
        (raw_currency, 1.0),
    )

    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise HTTPException(
            422,
            "The listing's quotation currency could not be verified.",
        )

    exchange = clean(info.get("exchange"), 32).upper()
    known = KNOWN.get(symbol.upper())

    if known:
        exchange = known[0]

    if not EXCHANGE.fullmatch(exchange):
        raise HTTPException(
            422,
            "The listing's exchange could not be verified.",
        )

    name = (
        clean(info.get("longName"))
        or clean(info.get("shortName"))
    )

    if not name:
        raise HTTPException(
            422,
            "The listing's name could not be verified.",
        )

    instrument = {
        "id": f"yahoo:{exchange}:{symbol}:{currency}",
        "provider": "yahoo",
        "symbol": symbol,
        "exchange": exchange,
        "currency": currency,
        "type": kind,
        "name": name,
        "isin": (
            known[1]
            if known
            else valid_isin(info.get("isin"))
        ),
    }

    return instrument, scale


def resolve(symbol):
    info = info_for(symbol)
    instrument, scale = listing_from(info)

    price = positive(info.get("regularMarketPrice"))
    as_of = timestamp(info.get("regularMarketTime"))

    quote = None

    if price is not None and as_of:
        quote = {
            "instrumentId": instrument["id"],
            "currency": instrument["currency"],
            "price": price * scale,
            "asOf": as_of,
            "type": "delayed",
        }

    return {
        "instrument": instrument,
        "quote": quote,
        "source": SOURCE,
        "fetchedAt": utc_now(),
        "warning": (
            ""
            if quote
            else "A timestamped market price is currently unavailable."
        ),
    }


@app.get("/")
@app.get("/health")
def health():
    return {
        "service": "northstar-market-api",
        "version": "1.0.0",
        "status": "ok",
    }


@app.get("/api/search")
def search(q: str = Query(min_length=2, max_length=80)):
    query = clean(q, 80)

    if len(query) < 2:
        raise HTTPException(
            400,
            "Enter at least two characters.",
        )

    def fetch():
        try:
            rows = yf.Search(
                query,
                max_results=12,
                news_count=0,
                timeout=15,
            ).quotes
        except Exception:
            raise HTTPException(
                502,
                "Investment search is unavailable. Try again shortly.",
            ) from None

        if not isinstance(rows, list):
            raise HTTPException(
                502,
                "The provider returned an invalid search response.",
            )

        results = []
        seen = set()

        for row in rows:
            if not isinstance(row, dict):
                continue

            symbol = clean(row.get("symbol"), 64)
            kind = KINDS.get(row.get("quoteType"))

            name = (
                clean(row.get("longname"))
                or clean(row.get("shortname"))
            )

            if (
                not kind
                or not SYMBOL.fullmatch(symbol)
                or not name
                or symbol in seen
            ):
                continue

            seen.add(symbol)

            results.append({
                "symbol": symbol,
                "name": name,
                "type": kind,
                "exchange": (
                    clean(row.get("exchDisp"), 80)
                    or clean(row.get("exchange"), 32)
                ),
                "requiresVerification": True,
            })

        # Resolve a selected candidate before saving it as an instrument.
        return {
            "results": results,
            "source": SOURCE,
            "fetchedAt": utc_now(),
        }

    return cached(
        ("search", query.casefold()),
        300,
        fetch,
    )


@app.get("/api/instrument")
@app.get("/api/quote")
def instrument(
    symbol: str = Query(min_length=1, max_length=64),
):
    symbol = valid_symbol(symbol)

    return cached(
        ("instrument", symbol.upper()),
        300,
        lambda: resolve(symbol),
    )


@app.get("/api/fx")
def fx(
    from_currency: str = Query(min_length=3, max_length=3),
):
    currency = clean(from_currency, 3)

    if not re.fullmatch(r"[A-Z]{3}", currency):
        raise HTTPException(
            400,
            "Use a three-letter uppercase quotation currency.",
        )

    if currency == "EUR":
        return {
            "from": "EUR",
            "to": "EUR",
            "rate": 1.0,
            "asOf": utc_now(),
            "source": "Identity conversion",
        }

    def fetch():
        info = info_for(f"{currency}EUR=X")

        if (
            info.get("quoteType") != "CURRENCY"
            or info.get("currency") != "EUR"
        ):
            raise HTTPException(
                422,
                "This currency conversion could not be verified.",
            )

        rate = positive(info.get("regularMarketPrice"))
        as_of = timestamp(info.get("regularMarketTime"))

        if rate is None or as_of is None:
            raise HTTPException(
                503,
                "A timestamped exchange rate is currently unavailable.",
            )

        return {
            "from": currency,
            "to": "EUR",
            "rate": rate,
            "asOf": as_of,
            "type": "delayed",
            "source": SOURCE,
            "fetchedAt": utc_now(),
        }

    return cached(
        ("fx", currency),
        900,
        fetch,
    )
