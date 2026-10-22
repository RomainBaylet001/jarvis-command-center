/* NORTHSTAR / instrument identity and valuation helpers.
   Pure functions: no network requests or browser storage writes.
   Quote prices must use major currency units: GBP, not GBp. */
(function (root) {
  'use strict';

  const BASE_CURRENCY = 'EUR';
  const TYPES = new Set(['STOCK', 'ETF']);

  function requiredText(value, label, limit) {
    if (typeof value !== 'string') {
      throw Error(label + ' is required.');
    }

    const text = value.trim();

    if (
      !text ||
      text.length > limit ||
      /[\u0000-\u001f\u007f]/.test(text)
    ) {
      throw Error('Invalid ' + label.toLowerCase() + '.');
    }

    return text;
  }

  function currencyCode(value) {
    const code = requiredText(value, 'Currency', 3);

    if (!/^[A-Z]{3}$/.test(code)) {
      throw Error(
        'Use a three-letter currency code, such as EUR or USD.'
      );
    }

    return code;
  }

  function validIsin(value) {
    if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(value)) {
      return false;
    }

    const digits = value.replace(/[A-Z]/g, letter =>
      String(letter.charCodeAt(0) - 55)
    );

    let total = 0;

    for (
      let i = digits.length - 1, position = 0;
      i >= 0;
      i--, position++
    ) {
      let digit = Number(digits[i]);

      if (position % 2) digit *= 2;

      total += digit > 9 ? digit - 9 : digit;
    }

    return total % 10 === 0;
  }

  function instrument(input) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input)
    ) {
      throw Error('Choose an investment before saving.');
    }

    const provider = requiredText(
      input.provider,
      'Data provider',
      24
    ).toLowerCase();

    const symbol = requiredText(
      input.symbol,
      'Symbol',
      64
    );

    const exchange = requiredText(
      input.exchange,
      'Exchange',
      32
    ).toUpperCase();

    const currency = currencyCode(input.currency);

    const type = requiredText(
      input.type,
      'Asset type',
      10
    ).toUpperCase();

    const name = requiredText(
      input.name,
      'Investment name',
      180
    );

    if (!/^[a-z][a-z0-9-]*$/.test(provider)) {
      throw Error('Invalid data provider.');
    }

    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(symbol)) {
      throw Error('Invalid stock or ETF symbol.');
    }

    if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(exchange)) {
      throw Error('Invalid exchange identifier.');
    }

    if (!TYPES.has(type)) {
      throw Error('Only stocks and ETFs are supported.');
    }

    const isin = input.isin == null || input.isin === ''
      ? ''
      : requiredText(input.isin, 'ISIN', 12).toUpperCase();

    if (isin && !validIsin(isin)) {
      throw Error(
        'The ISIN is invalid. Check all 12 characters.'
      );
    }

    const id = [
      provider,
      exchange,
      symbol,
      currency
    ].join(':');

    if (input.id != null && input.id !== id) {
      throw Error(
        'Investment identity does not match its listing.'
      );
    }

    return Object.freeze({
      id,
      provider,
      symbol,
      exchange,
      currency,
      type,
      name,
      isin
    });
  }

  const LEGACY = Object.freeze({
    VWCE: instrument({
      provider: 'yahoo',
      symbol: 'VWCE.DE',
      exchange: 'XETR',
      currency: 'EUR',
      type: 'ETF',
      name: 'Vanguard FTSE All-World UCITS ETF',
      isin: 'IE00BK5BQT80'
    }),

    VFEA: instrument({
      provider: 'yahoo',
      symbol: 'VFEA.DE',
      exchange: 'XETR',
      currency: 'EUR',
      type: 'ETF',
      name: 'Vanguard FTSE Emerging Markets UCITS ETF',
      isin: 'IE00BK5BR733'
    })
  });

  function forTrade(trade) {
    if (!trade || typeof trade !== 'object') {
      throw Error('Invalid purchase.');
    }

    if (Object.hasOwn(LEGACY, trade.asset)) {
      const known = LEGACY[trade.asset];

      if (
        trade.instrument &&
        instrument(trade.instrument).id !== known.id
      ) {
        throw Error(
          'Saved investment details conflict with the purchase.'
        );
      }

      return known;
    }

    const listing = instrument(trade.instrument);

    if (trade.asset !== listing.id) {
      throw Error(
        'Purchase is missing a matching investment identity.'
      );
    }

    return listing;
  }

  function searchLocal(listings, query, limit = 20) {
    if (!Array.isArray(listings)) {
      throw Error('Invalid investment list.');
    }

    const needle = String(query || '')
      .trim()
      .toLocaleLowerCase('en');

    if (!needle) return [];

    const seen = new Set();
    const matches = [];

    for (const candidate of listings) {
      const listing = instrument(candidate);

      if (seen.has(listing.id)) continue;

      seen.add(listing.id);

      const haystack = [
        listing.name,
        listing.symbol,
        listing.isin,
        listing.exchange,
        listing.currency
      ].join(' ').toLocaleLowerCase('en');

      if (haystack.includes(needle)) {
        matches.push(listing);
      }
    }

    const maximum = Number.isInteger(limit)
      ? Math.max(1, Math.min(50, limit))
      : 20;

    return matches.slice(0, maximum);
  }

  function positive(value) {
    return (
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value > 0
    );
  }

  function validTimestamp(value, now) {
    if (
      typeof value !== 'string' ||
      !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ) {
      return false;
    }

    const timestamp = Date.parse(value);

    return (
      Number.isFinite(timestamp) &&
      timestamp <= now + 300000
    );
  }

  function valueInEuro(
    listing,
    shares,
    quote,
    fx = null,
    now = Date.now()
  ) {
    const asset = instrument(listing);

    if (
      typeof shares !== 'number' ||
      !Number.isFinite(shares) ||
      shares < 0
    ) {
      throw Error('Shares must be a non-negative number.');
    }

    if (!Number.isFinite(now)) {
      throw Error('Invalid valuation time.');
    }

    if (shares === 0) {
      return {
        value: 0,
        reason: '',
        quoteAsOf: '',
        fxAsOf: '',
        quoteType: ''
      };
    }

    if (
      !quote ||
      quote.instrumentId !== asset.id ||
      quote.currency !== asset.currency ||
      !positive(quote.price) ||
      !validTimestamp(quote.asOf, now) ||
      !['delayed', 'closing', 'manual'].includes(quote.type)
    ) {
      return {
        value: null,
        reason: 'missing-quote'
      };
    }

    let rate = 1;
    let fxAsOf = '';

    if (asset.currency !== BASE_CURRENCY) {
      if (
        !fx ||
        fx.from !== asset.currency ||
        fx.to !== BASE_CURRENCY ||
        !positive(fx.rate) ||
        !validTimestamp(fx.asOf, now)
      ) {
        return {
          value: null,
          reason: 'missing-fx'
        };
      }

      rate = fx.rate;
      fxAsOf = fx.asOf;
    }

    const value = shares * quote.price * rate;

    if (!Number.isFinite(value)) {
      return {
        value: null,
        reason: 'invalid-value'
      };
    }

    return {
      value,
      reason: '',
      quoteAsOf: quote.asOf,
      fxAsOf,
      quoteType: quote.type
    };
  }

  const api = Object.freeze({
    BASE_CURRENCY,
    LEGACY,
    instrument,
    forTrade,
    searchLocal,
    validIsin,
    valueInEuro
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.NorthstarAssets = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
