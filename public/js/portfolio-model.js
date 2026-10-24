/* NORTHSTAR / portfolio calculations.
   Pure functions. No storage writes, DOM changes or network requests.
   Purchase amounts are actual EUR costs.
   Quote prices retain their quotation currency. */

(function (root) {
  'use strict';

  const commonJS =
    typeof module !== 'undefined' && module.exports;

  const Assets = commonJS
    ? require('./assets.js')
    : root.NorthstarAssets;

  const Market = commonJS
    ? require('./market-data.js')
    : root.NorthstarMarket;

  const own = (object, key) =>
    Object.hasOwn(object, key);

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

  function numeric(value, label, allowZero = false) {
    if (
      typeof value !== 'number' &&
      typeof value !== 'string'
    ) {
      throw Error(label);
    }

    if (
      typeof value === 'string' &&
      !value.trim()
    ) {
      throw Error(label);
    }

    const number = Number(value);

    if (
      !Number.isFinite(number) ||
      (allowZero ? number < 0 : number <= 0)
    ) {
      throw Error(label);
    }

    return number;
  }

  function assetKey(listing) {
    for (
      const [key, known]
      of Object.entries(Assets.LEGACY)
    ) {
      if (listing.id === known.id) return key;
    }

    return listing.id;
  }

  function validateTrades(input) {
    if (
      !Array.isArray(input) ||
      input.length > 1000
    ) {
      throw Error('Expected at most 1,000 purchases.');
    }

    return input.map((trade, index) => {
      try {
        if (
          !trade ||
          typeof trade !== 'object' ||
          Array.isArray(trade) ||
          !validDate(trade.date)
        ) {
          throw Error('Check the purchase date.');
        }

        const listing = Assets.forTrade(trade);

        if (
          trade.amountCurrency != null &&
          trade.amountCurrency !== 'EUR'
        ) {
          throw Error(
            'Total paid must be the actual amount in EUR.'
          );
        }

        if (
          trade.purchasePriceCurrency != null &&
          trade.purchasePriceCurrency !== listing.currency
        ) {
          throw Error(
            'Unit purchase price must use the listing currency.'
          );
        }

        const amount = numeric(
          trade.amount,
          'Enter a positive EUR cost.'
        );

        const shares = numeric(
          trade.shares,
          'Enter a positive share quantity.'
        );

        const purchasePrice =
          trade.purchasePrice == null ||
          trade.purchasePrice === ''
            ? 0
            : numeric(
                trade.purchasePrice,
                'Check the unit purchase price.',
                true
              );

        const broker = String(trade.broker || '');

        if (
          broker.length > 180 ||
          /[\u0000-\u001f\u007f]/.test(broker)
        ) {
          throw Error('Check the broker name.');
        }

        const result = {
          ...trade,
          amount,
          shares,
          purchasePrice,
          broker
        };

        if (trade.instrument != null) {
          result.instrument = listing;
        }

        return result;
      } catch (error) {
        throw Error(
          `Purchase ${index + 1}: ${error.message}`
        );
      }
    });
  }

  function sum(values) {
    const total = values.reduce(
      (result, value) => result + value,
      0
    );

    if (!Number.isFinite(total)) {
      throw Error(
        'Portfolio figures exceed the supported numeric range.'
      );
    }

    return total;
  }

  function groupTrades(trades) {
    const rows = Object.create(null);

    for (const trade of trades) {
      const instrument = Assets.forTrade(trade);
      const key = assetKey(instrument);

      if (!own(rows, key)) {
        rows[key] = {
          key,
          instrument,
          trades: []
        };
      }

      rows[key].trades.push(trade);
    }

    return rows;
  }

  function splitFactor(record, purchased, through) {
    if (
      !record ||
      !Array.isArray(record.splits)
    ) {
      return null;
    }

    // The feed contains two years of split events.
    // Do not guess older share units.
    if (
      !record.history.length ||
      purchased < record.history[0][0]
    ) {
      return null;
    }

    let factor = 1;

    for (const event of record.splits) {
      // Date-only purchases use post-split units
      // on the event date.
      if (
        event.date > purchased &&
        event.date <= through
      ) {
        factor *= event.ratio;
      }
    }

    return (
      Number.isFinite(factor) &&
      factor > 0
    ) ? factor : null;
  }

  function isStale(snapshot, quote, now) {
    if (!snapshot || !quote) return true;

    const state = Market.sessionState(
      snapshot,
      quote.exchange,
      now
    );

    if (!state.known) return true;

    const time = Date.parse(quote.asOf);

    if (
      state.open &&
      now - time > 90 * 60000
    ) {
      return true;
    }

    if (!state.open && state.previous) {
      const last = state.previous;

      if (quote.date < last.date) return true;

      if (
        now > Date.parse(last.close) + 3600000 &&
        time < Date.parse(last.close) - 1800000
      ) {
        return true;
      }
    }

    // Exchange rates can close on a different clock.
    // Preserve their timestamps and flag a large gap.
    return (
      !!quote.fxAsOf &&
      Math.abs(
        time - Date.parse(quote.fxAsOf)
      ) > 72 * 3600000
    );
  }

  function summarize(
    input,
    snapshot,
    now = Date.now()
  ) {
    if (!Number.isFinite(now)) {
      throw Error('Invalid valuation time.');
    }

    const trades = validateTrades(input);
    const rows = groupTrades(trades);

    for (const row of Object.values(rows)) {
      row.invested = sum(
        row.trades.map(trade => trade.amount)
      );

      row.recordedShares = sum(
        row.trades.map(trade => trade.shares)
      );

      const record = snapshot
        ? Market.entry(
            snapshot,
            row.instrument.id
          )
        : null;

      row.quote = snapshot
        ? Market.quote(
            snapshot,
            row.instrument.id,
            now
          )
        : null;

      row.shares = null;
      row.value = null;
      row.profit = null;
      row.reason = '';
      row.warnings = [...(record?.warnings || [])];

      if (!row.quote) {
        row.reason = 'missing-price';
      } else if (
        row.trades.some(
          trade => trade.date > row.quote.date
        )
      ) {
        row.reason = 'price-before-purchase';
      } else {
        const factors = row.trades.map(trade =>
          splitFactor(
            record,
            trade.date,
            row.quote.date
          )
        );

        if (
          factors.some(factor => factor === null)
        ) {
          row.reason = 'missing-split-coverage';
        } else {
          row.shares = sum(
            row.trades.map(
              (trade, index) =>
                trade.shares * factors[index]
            )
          );

          if (row.quote.priceEUR === null) {
            row.reason =
              row.quote.reason || 'missing-fx';
          } else {
            const value =
              row.shares * row.quote.priceEUR;

            if (!Number.isFinite(value)) {
              row.reason = 'invalid-value';
            } else {
              row.value = value;
              row.profit = value - row.invested;
            }
          }
        }
      }

      row.stale = isStale(
        snapshot,
        row.quote,
        now
      );
    }

    const holdings = Object.values(rows);

    const invested = sum(
      holdings.map(row => row.invested)
    );

    const complete = holdings.every(
      row => row.value !== null
    );

    const value = complete
      ? sum(holdings.map(row => row.value))
      : null;

    const marketBasis =
      value !== null && value > 0;

    const base = marketBasis
      ? value
      : invested;

    for (const row of holdings) {
      row.weight = base
        ? (
            marketBasis
              ? row.value
              : row.invested
          ) / base * 100
        : 0;
    }

    const world = rows.VWCE?.weight || 0;
    const emerging = rows.VFEA?.weight || 0;

    const coveredValue = complete
      ? sum(
          holdings
            .filter(row =>
              row.key === 'VWCE' ||
              row.key === 'VFEA'
            )
            .map(row => row.value)
        )
      : null;

    const dates = holdings
      .map(row => row.quote?.date)
      .filter(Boolean)
      .sort();

    return {
      rows,
      holdings,
      invested,
      value,

      profit:
        value === null
          ? null
          : value - invested,

      count: trades.length,

      allocation: world,
      allocationWorld: world,
      allocationEmerging: emerging,

      allocationOther:
        Math.max(0, 100 - world - emerging) *
        (base ? 1 : 0),

      allocationBasis:
        marketBasis
          ? 'Market value'
          : 'Invested capital',

      date: dates[0] || '',

      status: holdings.some(row =>
        row.reason ||
        row.stale ||
        row.warnings.length
      ) ? 'warning' : 'idle',

      missing: holdings
        .filter(row => row.reason)
        .map(row => ({
          asset: row.key,
          reason: row.reason
        })),

      exposureCoverage: {
        value: coveredValue,

        percent:
          value > 0
            ? coveredValue / value * 100
            : null,

        unanalysed: holdings
          .filter(row =>
            row.key !== 'VWCE' &&
            row.key !== 'VFEA'
          )
          .map(row => row.key)
      }
    };
  }

  function chartContext(input, snapshot) {
    if (!snapshot) return null;

    const trades = validateTrades(input);
    const groups = groupTrades(trades);

    const keys = [...new Set([
      'VWCE',
      'VFEA',
      'SXR8',
      ...Object.keys(groups)
    ])];

    const records = Object.create(null);
    const maps = Object.create(null);

    for (const key of keys) {
      const record = Market.entry(
        snapshot,
        key
      );

      if (!record?.history.length) {
        return null;
      }

      records[key] = record;
      maps[key] = new Map(record.history);
    }

    // Compare completed closes on the same date
    // across the selected exchanges.
    const dates = records.VWCE.history
      .map(row => row[0])
      .filter(day =>
        keys.every(key =>
          maps[key].has(day) &&
          Market.priceOn(
            snapshot,
            key,
            day,
            7
          )
        )
      );

    return {
      trades,
      groups,
      keys,
      records,
      dates
    };
  }

  function marketSeries(input, snapshot) {
    const context = chartContext(
      input,
      snapshot
    );

    if (!context) return [];

    return context.dates.map(day => ({
      day,

      ...Object.fromEntries(
        context.keys.map(key => [
          key,
          Market.priceOn(
            snapshot,
            key,
            day
          ).priceEUR
        ])
      )
    }));
  }

  function series(input, snapshot) {
    const context = chartContext(
      input,
      snapshot
    );

    if (
      !context ||
      !context.trades.length ||
      !context.dates.length
    ) {
      return [];
    }

    const {
      trades,
      keys,
      records,
      dates
    } = context;

    const first = dates[0];
    const last = dates.at(-1);

    if (
      trades.some(trade =>
        trade.date < first ||
        trade.date > last
      )
    ) {
      return [];
    }

    const plans = [];

    for (const trade of trades) {
      const listing = Assets.forTrade(trade);
      const key = assetKey(listing);
      const record = records[key];
      const through = record.history.at(-1)[0];

      // Yahoo Close history already reflects
      // later stock splits.
      const factor = splitFactor(
        record,
        trade.date,
        through
      );

      if (factor === null) return [];

      const tradeDay = dates.find(
        day => day >= trade.date
      );

      if (!tradeDay) return [];

      const benchmarkPrice = Market.priceOn(
        snapshot,
        'SXR8',
        tradeDay
      ).priceEUR;

      const historyShares =
        trade.shares * factor;

      const benchmarkShares =
        trade.amount / benchmarkPrice;

      if (
        !Number.isFinite(historyShares) ||
        !Number.isFinite(benchmarkShares)
      ) {
        return [];
      }

      plans.push({
        ...trade,
        key,
        tradeDay,
        historyShares,
        benchmarkShares
      });
    }

    const start = plans
      .map(plan => plan.tradeDay)
      .sort()[0];

    return dates
      .filter(day => day >= start)
      .map(day => {
        const active = plans.filter(
          plan => plan.tradeDay <= day
        );

        const invested = sum(
          active.map(plan => plan.amount)
        );

        const actual = sum(
          active.map(plan =>
            plan.historyShares *
            Market.priceOn(
              snapshot,
              plan.key,
              day
            ).priceEUR
          )
        );

        const benchmark = sum(
          active.map(
            plan => plan.benchmarkShares
          )
        ) * Market.priceOn(
          snapshot,
          'SXR8',
          day
        ).priceEUR;

        const record = {
          day,
          Portfolio:
            (actual / invested - 1) * 100,
          SXR8:
            (benchmark / invested - 1) * 100
        };

        for (const key of keys) {
          if (key === 'SXR8') continue;

          const buys = active.filter(
            plan => plan.key === key
          );

          const cost = sum(
            buys.map(plan => plan.amount)
          );

          record[key] = cost
            ? (
                sum(
                  buys.map(
                    plan => plan.historyShares
                  )
                ) *
                Market.priceOn(
                  snapshot,
                  key,
                  day
                ).priceEUR /
                cost - 1
              ) * 100
            : null;
        }

        if (
          Object.values(record).some(value =>
            typeof value === 'number' &&
            !Number.isFinite(value)
          )
        ) {
          throw Error(
            'Historical figures exceed the supported numeric range.'
          );
        }

        return record;
      });
  }

  const api = Object.freeze({
    validDate,
    assetKey,
    validateTrades,
    summarize,
    series,
    marketSeries
  });

  if (commonJS) {
    module.exports = api;
  } else {
    root.NorthstarPortfolio = api;
  }
})(
  typeof window !== 'undefined'
    ? window
    : globalThis
);
