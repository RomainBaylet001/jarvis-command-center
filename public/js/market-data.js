/* NORTHSTAR / catalogue and published market-data reader.
   No portfolio storage writes.
   Prices remain in their quotation currency. */

(function (root) {
  'use strict';

  const Assets =
    typeof module !== 'undefined' && module.exports
      ? require('./assets.js')
      : root.NorthstarAssets;

  const scriptURL = typeof document !== 'undefined'
    ? document.currentScript?.src ||
      new URL('./js/market-data.js', document.baseURI).href
    : '';

  const ZONES = Object.freeze({
    XETR: 'Europe/Berlin',
    NMS: 'America/New_York'
  });

  const DAY = 86400000;

  const own = (object, key) =>
    Object.hasOwn(object, key);

  const positive = value =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value > 0;

  function validDate(value) {
    if (
      typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return false;
    }

    const date = new Date(value + 'T12:00:00Z');

    return (
      Number.isFinite(+date) &&
      date.toISOString().slice(0, 10) === value
    );
  }

  function timestamp(value, now = Infinity) {
    if (
      typeof value !== 'string' ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ) {
      return null;
    }

    const time = Date.parse(value);

    return (
      Number.isFinite(time) &&
      time <= now + 300000
    ) ? time : null;
  }

  function localDate(time, zone) {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(time);

    const part = type =>
      parts.find(item => item.type === type).value;

    return (
      `${part('year')}-${part('month')}-${part('day')}`
    );
  }

  function readHistory(rows, latest, market, now) {
    if (!Array.isArray(rows) || rows.length > 10000) {
      throw Error('Invalid daily history.');
    }

    const seen = new Set();
    const result = [];

    for (const row of rows) {
      if (
        !Array.isArray(row) ||
        row.length !== 2 ||
        !validDate(row[0]) ||
        !positive(row[1]) ||
        row[0] > latest ||
        seen.has(row[0])
      ) {
        throw Error('Invalid or duplicate daily price.');
      }

      if (
        market &&
        row[0] >= market.calendarStart &&
        row[0] <= market.calendarEnd
      ) {
        const session = market.sessions.find(
          item => item.date === row[0]
        );

        if (
          !session ||
          Date.parse(session.close) + 1800000 > now
        ) {
          throw Error(
            'Daily history contains an unfinished session.'
          );
        }
      }

      seen.add(row[0]);
      result.push([row[0], row[1]]);
    }

    return result.sort(
      (a, b) => a[0].localeCompare(b[0])
    );
  }

  function readMarket(raw, zone) {
    if (
      !raw ||
      raw.timezone !== zone ||
      !validDate(raw.calendarStart) ||
      !validDate(raw.calendarEnd) ||
      raw.calendarStart > raw.calendarEnd ||
      !Array.isArray(raw.sessions) ||
      raw.sessions.length > 1000
    ) {
      return null;
    }

    const sessions = [];
    const seen = new Set();

    for (const session of raw.sessions) {
      const open = timestamp(session?.open);
      const close = timestamp(session?.close);

      if (
        !validDate(session?.date) ||
        seen.has(session.date) ||
        open === null ||
        close === null ||
        open >= close ||
        localDate(open, zone) !== session.date ||
        localDate(close, zone) !== session.date ||
        session.date < raw.calendarStart ||
        session.date > raw.calendarEnd
      ) {
        return null;
      }

      seen.add(session.date);

      sessions.push({
        date: session.date,
        open: session.open,
        close: session.close
      });
    }

    sessions.sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    return {
      timezone: zone,
      calendarStart: raw.calendarStart,
      calendarEnd: raw.calendarEnd,
      sessions
    };
  }

  function readQuote(raw, listing, now) {
    if (
      !raw ||
      raw.instrumentId !== listing.id ||
      raw.currency !== listing.currency ||
      !positive(raw.price) ||
      timestamp(raw.asOf, now) === null ||
      !['delayed', 'closing'].includes(raw.type)
    ) {
      return null;
    }

    return {
      instrumentId: listing.id,
      currency: listing.currency,
      price: raw.price,
      asOf: raw.asOf,
      type: raw.type
    };
  }

  function parse(catalogue, payload, now = Date.now()) {
    if (!Assets || !Number.isFinite(now)) {
      throw Error('Investment helpers unavailable.');
    }

    if (
      catalogue?.schemaVersion !== 1 ||
      catalogue.baseCurrency !== 'EUR' ||
      payload?.schemaVersion !== 1 ||
      payload.baseCurrency !== 'EUR' ||
      !Array.isArray(catalogue.instruments) ||
      !catalogue.instruments.length ||
      catalogue.instruments.length > 100 ||
      timestamp(payload.attemptedAt, now) === null
    ) {
      throw Error('Invalid published investment data.');
    }

    const instruments = Object.create(null);
    const aliases = Object.create(null);
    const markets = Object.create(null);
    const fx = Object.create(null);
    const warnings = [];

    for (const [exchange, zone] of Object.entries(ZONES)) {
      markets[exchange] = readMarket(
        payload.markets?.[exchange],
        zone
      );
    }

    for (const input of catalogue.instruments) {
      const listing = Assets.instrument(input);

      if (
        own(instruments, listing.id) ||
        !own(ZONES, listing.exchange)
      ) {
        throw Error(
          'Duplicate or unsupported investment listing.'
        );
      }

      const raw = payload.instruments?.[listing.id];
      let matching = false;

      try {
        const candidate = Assets.instrument(
          raw?.instrument
        );

        matching =
          candidate.id === listing.id &&
          candidate.type === listing.type;
      } catch (_) {
        // Missing entries remain explicitly unavailable.
      }

      let history = [];
      let splits = null;
      const notices = [];

      const quote = matching
        ? readQuote(raw.quote, listing, now)
        : null;

      if (!quote) {
        notices.push('Price unavailable');
      }

      if (matching) {
        const events = raw.splits;
        const today = localDate(
          now,
          ZONES[listing.exchange]
        );

        if (
          Array.isArray(events) &&
          events.length <= 1000 &&
          events.every(event =>
            validDate(event?.date) &&
            event.date <= today &&
            positive(event.ratio)
          ) &&
          new Set(
            events.map(event => event.date)
          ).size === events.length
        ) {
          splits = events
            .map(event => ({
              date: event.date,
              ratio: event.ratio
            }))
            .sort(
              (a, b) => a.date.localeCompare(b.date)
            );
        } else {
          notices.push('Split history unavailable');
        }

        try {
          if (
            raw.historySettings?.field !== 'Close' ||
            raw.historySettings.autoAdjust !== false
          ) {
            throw Error(
              'Unexpected historical price basis.'
            );
          }

          history = readHistory(
            raw.history,
            today,
            markets[listing.exchange],
            now
          );
        } catch (_) {
          notices.push('Daily history unavailable');
        }

        if (
          Array.isArray(raw.warnings) &&
          raw.warnings.length
        ) {
          notices.push(
            'Provider reported a data warning'
          );
        }
      }

      instruments[listing.id] = {
        instrument: listing,
        quote,
        history,
        splits,
        historySettings: {
          field: 'Close',
          autoAdjust: false
        },
        warnings: notices
      };

      warnings.push(
        ...notices.map(
          notice => `${listing.symbol}: ${notice}`
        )
      );
    }

    for (
      const [key, listing]
      of Object.entries(Assets.LEGACY)
    ) {
      if (
        catalogue.legacyAssets?.[key] !== listing.id ||
        !own(instruments, listing.id)
      ) {
        throw Error(
          'Catalogue conflicts with existing purchases.'
        );
      }

      aliases[key] = listing.id;
    }

    const benchmark = catalogue.benchmarks?.sp500;

    if (!own(instruments, benchmark)) {
      throw Error('Portfolio benchmark unavailable.');
    }

    aliases.SXR8 = benchmark;

    const currencies = new Set(
      Object.values(instruments).map(
        entry => entry.instrument.currency
      )
    );

    for (const currency of currencies) {
      if (currency === 'EUR') continue;

      const raw = payload.fx?.[currency];

      const matching =
        raw?.from === currency &&
        raw.to === 'EUR';

      const valid =
        matching &&
        positive(raw.rate) &&
        timestamp(raw.asOf, now) !== null;

      let history = [];

      if (matching) {
        try {
          const yesterday = new Date(now - DAY)
            .toISOString()
            .slice(0, 10);

          history = readHistory(
            raw.history,
            yesterday,
            null,
            now
          );
        } catch (_) {
          warnings.push(
            `${currency}/EUR: daily history unavailable`
          );
        }
      }

      fx[currency] = {
        from: currency,
        to: 'EUR',
        rate: valid ? raw.rate : null,
        asOf: valid ? raw.asOf : null,
        history
      };

      if (!valid) {
        warnings.push(
          `${currency}/EUR: conversion unavailable`
        );
      }
    }

    return {
      instruments,
      aliases,
      markets,
      fx,
      warnings,
      benchmark,
      attemptedAt: payload.attemptedAt,
      parsedAt: now
    };
  }

  function entry(snapshot, asset) {
    const id = snapshot.aliases[asset] || asset;

    return own(snapshot.instruments, id)
      ? snapshot.instruments[id]
      : null;
  }

  function quote(snapshot, asset, now = Date.now()) {
    const record = entry(snapshot, asset);

    if (!record?.quote) return null;

    const listing = record.instrument;

    const rate =
      snapshot.fx[listing.currency] || null;

    const valuation = Assets.valueInEuro(
      listing,
      1,
      record.quote,
      rate,
      now
    );

    return {
      ...record.quote,
      date: localDate(
        Date.parse(record.quote.asOf),
        ZONES[listing.exchange]
      ),
      exchange: listing.exchange,
      timezone: ZONES[listing.exchange],
      priceEUR: valuation.value,
      fxAsOf: valuation.fxAsOf || '',
      reason: valuation.reason
    };
  }

  function previousPrice(rows, day, maxGap) {
    let left = 0;
    let right = rows.length - 1;
    let found = -1;

    while (left <= right) {
      const middle = Math.floor(
        (left + right) / 2
      );

      if (rows[middle][0] <= day) {
        found = middle;
        left = middle + 1;
      } else {
        right = middle - 1;
      }
    }

    if (found < 0) return null;

    const row = rows[found];

    return (
      Date.parse(day) - Date.parse(row[0]) <=
      maxGap * DAY
    ) ? row : null;
  }

  function priceOn(
    snapshot,
    asset,
    day,
    maxGap = 7
  ) {
    if (
      !validDate(day) ||
      !Number.isInteger(maxGap) ||
      maxGap < 0 ||
      maxGap > 7
    ) {
      throw Error(
        'Invalid historical price request.'
      );
    }

    const record = entry(snapshot, asset);

    if (
      !record ||
      day > localDate(
        snapshot.parsedAt,
        ZONES[record.instrument.exchange]
      )
    ) {
      return null;
    }

    const native = previousPrice(
      record.history,
      day,
      maxGap
    );

    if (!native) return null;

    const currency = record.instrument.currency;

    const conversion = currency === 'EUR'
      ? [day, 1]
      : previousPrice(
          snapshot.fx[currency]?.history || [],
          day,
          maxGap
        );

    if (!conversion) return null;

    const value = native[1] * conversion[1];

    return positive(value) ? {
      price: native[1],
      currency,
      priceEUR: value,
      priceDate: native[0],
      fxDate:
        currency === 'EUR'
          ? ''
          : conversion[0]
    } : null;
  }

  function sessionState(
    snapshot,
    exchange,
    now = Date.now()
  ) {
    const market = snapshot.markets[exchange];

    if (!market || !Number.isFinite(now)) {
      return {
        known: false,
        open: false
      };
    }

    const today = localDate(
      now,
      market.timezone
    );

    if (
      today < market.calendarStart ||
      today > market.calendarEnd
    ) {
      return {
        known: false,
        open: false
      };
    }

    const session = market.sessions.find(
      item => item.date === today
    );

    return {
      known: true,

      open:
        !!session &&
        now >= Date.parse(session.open) &&
        now < Date.parse(session.close),

      session,

      next: market.sessions.find(
        item => Date.parse(item.open) > now
      ),

      previous: [...market.sessions]
        .reverse()
        .find(
          item => Date.parse(item.close) <= now
        )
    };
  }

  async function load(options = {}) {
    const fetcher =
      options.fetcher ||
      root.fetch?.bind(root);

    const base =
      options.baseURL ||
      (
        scriptURL
          ? new URL('../data/', scriptURL).href
          : ''
      );

    if (!fetcher || !base) {
      throw Error(
        'Market-data connection unavailable.'
      );
    }

    const controller = new AbortController();

    const timer = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const files = await Promise.all(
        [
          'instruments.json',
          'market-data.json'
        ].map(async file => {
          const url = new URL(file, base);

          url.searchParams.set(
            'v',
            String(Date.now())
          );

          const response = await fetcher(
            url.href,
            {
              cache: 'no-store',
              signal: controller.signal
            }
          );

          if (!response.ok) {
            throw Error(
              `Investment data HTTP ${response.status}.`
            );
          }

          return response.json();
        })
      );

      return parse(files[0], files[1]);
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
  }

  const api = Object.freeze({
    parse,
    load,
    entry,
    quote,
    priceOn,
    sessionState
  });

  if (
    typeof module !== 'undefined' &&
    module.exports
  ) {
    module.exports = api;
  } else {
    root.NorthstarMarket = api;
  }
})(
  typeof window !== 'undefined'
    ? window
    : globalThis
);
