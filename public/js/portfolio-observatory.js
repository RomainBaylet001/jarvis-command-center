/* NORTHSTAR / multi-asset portfolio interface. */
(async () => {
  'use strict';

  const STORAGE_KEY = 'jarvis-private-portfolio-v1';

  const ENGINE_URL = document.currentScript?.src ||
    new URL('./js/portfolio-observatory.js', document.baseURI).href;

  const el = id => document.getElementById(id);

  const html = value => String(value ?? '').replace(
    /[&<>"']/g,
    char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]
  );

  const money = (value, currency = 'EUR') =>
    new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency
    }).format(value);

  const eur = value => money(value);

  const pct = value =>
    `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

  const signedEuro = value =>
    `${value >= 0 ? '+' : '−'}${eur(Math.abs(value))}`;

  const sharesText = value => value === null
    ? '—'
    : value.toLocaleString('en-IE', {
        maximumFractionDigits: 10
      });

  async function helper(file, globalName) {
    if (window[globalName]) return;

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const url = new URL(file, ENGINE_URL);

      url.searchParams.set('v', 'multi-asset-1');

      script.src = url.href;
      script.onload = resolve;

      script.onerror = () =>
        reject(Error('Unable to load ' + file));

      document.head.append(script);
    });
  }

  try {
    await helper('./assets.js', 'NorthstarAssets');
    await helper('./market-data.js', 'NorthstarMarket');
    await helper('./portfolio-model.js', 'NorthstarPortfolio');
  } catch (error) {
    const notice = document.createElement('p');

    notice.className = 'pf-sub';
    notice.setAttribute('role', 'alert');

    notice.textContent =
      error.message +
      '. Reload to retry. Your saved purchases are unchanged.';

    el('view-investments')?.append(notice);
    return;
  }

  const Assets = window.NorthstarAssets;
  const Market = window.NorthstarMarket;
  const Model = window.NorthstarPortfolio;

  NorthstarFinance.validateTrades = Model.validateTrades;
  NorthstarFinance.parseCsv = parseCsv;
  NorthstarFinance.toCsv = toCsv;

  const blankAccount = () => ({
    trades: [],
    quotes: {
      VWCE: null,
      VFEA: null
    },
    quoteDate: ''
  });

  let account = blankAccount();
  let marketData = null;
  let feedError = 'Market data not loaded yet';
  let range = 'ALL';
  let chartMode = 'capital';
  let refreshing = false;
  let lastAttempt = 0;
  let marketTimer = 0;
  let result = null;

  let OWNED = [];
  let SYMBOLS = ['VWCE', 'VFEA', 'SXR8'];

  const COLORS = {
    Portfolio: '#f1f7ff',
    VWCE: '#4bdcf1',
    VFEA: '#f6ba49',
    SXR8: '#c296ff'
  };

  const PALETTE = [
    '#eaa283',
    '#a7d49c',
    '#b4a8e8',
    '#e1b77c',
    '#86c8cd',
    '#d59cba'
  ];

  const visible = new Set([
    'Portfolio',
    'VWCE',
    'VFEA',
    'SXR8'
  ]);

  const encountered = new Set(visible);

  let legendSignature = '';

  let chartCache = {
    source: null,
    signature: '',
    market: null,
    capital: null
  };

  function historyData(mode) {
    if (!marketData) return [];

    const signature = JSON.stringify(account.trades);

    if (
      chartCache.source !== marketData ||
      chartCache.signature !== signature
    ) {
      chartCache = {
        source: marketData,
        signature,
        market: null,
        capital: null
      };
    }

    if (chartCache[mode] === null) {
      chartCache[mode] = mode === 'market'
        ? Model.marketSeries(account.trades, marketData)
        : Model.series(account.trades, marketData);
    }

    return chartCache[mode];
  }

  function listing(asset) {
    return marketData
      ? Market.entry(marketData, asset)?.instrument ||
        result?.rows?.[asset]?.instrument
      : result?.rows?.[asset]?.instrument;
  }

  function label(asset) {
    if (asset === 'Portfolio') return 'Portfolio';
    if (asset === 'SXR8') return 'S&P 500 benchmark';

    if (asset === 'VWCE' || asset === 'VFEA') {
      return asset;
    }

    const item = listing(asset);

    if (!item) return 'Unavailable listing';

    const ticker = item.exchange === 'XETR'
      ? item.symbol.replace(/\.DE$/, '')
      : item.symbol;

    return item.id === marketData?.benchmark
      ? ticker + ' holding'
      : ticker;
  }

  function color(asset) {
    if (!COLORS[asset]) {
      let hash = 0;

      for (const char of asset) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
      }

      COLORS[asset] = PALETTE[hash % PALETTE.length];
    }

    return COLORS[asset];
  }

  function syncAssets() {
    OWNED = [...new Set(
      account.trades.map(trade =>
        Model.assetKey(Assets.forTrade(trade))
      )
    )];

    SYMBOLS = [...new Set([
      'VWCE',
      'VFEA',
      'SXR8',
      ...OWNED
    ])];

    for (const asset of SYMBOLS) {
      color(asset);

      if (!encountered.has(asset)) {
        visible.add(asset);
        encountered.add(asset);
      }
    }

    syncLegend();
  }

  function syncLegend() {
    const host = el('pf-legend');
    const keys = ['Portfolio', ...SYMBOLS];

    const signature =
      keys.join('|') +
      keys.map(label).join('|');

    if (!host || signature === legendSignature) {
      return;
    }

    legendSignature = signature;
    host.replaceChildren();

    for (const asset of keys) {
      const button = document.createElement('button');

      button.type = 'button';
      button.dataset.series = asset;
      button.textContent = label(asset);

      button.classList.toggle(
        'active',
        visible.has(asset)
      );

      button.style.borderLeft =
        '4px solid ' + color(asset);

      button.setAttribute(
        'aria-pressed',
        String(visible.has(asset))
      );

      button.addEventListener('click', () => {
        if (visible.has(asset)) {
          visible.delete(asset);
        } else {
          visible.add(asset);
        }

        button.classList.toggle(
          'active',
          visible.has(asset)
        );

        button.setAttribute(
          'aria-pressed',
          String(visible.has(asset))
        );

        drawChart();
      });

      host.append(button);
    }
  }

  function syncPerformanceLabels() {
    const button = el('pf-modes')
      ?.querySelector('[data-mode=market]');

    if (button) {
      button.textContent = 'Market returns';
    }

    if (el('performance-basis')) {
      el('performance-basis').textContent =
        chartMode === 'market'
          ? 'Investment price returns in EUR · rebased at the start of the selected window'
          : 'Gain ÷ contributed capital · since first purchase · not time-weighted';
    }
  }

  function loadAccount() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      const saved = raw === null
        ? blankAccount()
        : JSON.parse(raw);

      if (!saved || !Array.isArray(saved.trades)) {
        throw Error('Invalid saved portfolio structure.');
      }

      account = {
        ...saved,
        trades: Model.validateTrades(saved.trades)
      };

      document.body.removeAttribute(
        'data-storage-error'
      );
    } catch (error) {
      account = blankAccount();
      document.body.dataset.storageError = 'true';

      if (el('pf-message')) {
        el('pf-message').textContent =
          'Saved purchases could not be read. Original storage is untouched. ' +
          'Export the raw JSON backup before making changes.';
      }

      console.warn('Unable to load portfolio', error);
    }

    syncAssets();
  }

  async function refreshPrices() {
    if (refreshing) return;

    refreshing = true;
    lastAttempt = Date.now();

    el('pf-refresh').disabled = true;

    el('pf-feed').textContent =
      'Updating published market data…';

    document.dispatchEvent(
      new CustomEvent('northstar:state', {
        detail: 'loading'
      })
    );

    try {
      const next = await Market.load();

      marketData = next;
      feedError = '';

      document.dispatchEvent(
        new CustomEvent('northstar:catalogue', {
          detail: Object.values(next.instruments)
            .map(entry => entry.instrument)
        })
      );
    } catch (error) {
      feedError =
        error.message || 'Market data unavailable';
    } finally {
      refreshing = false;
      el('pf-refresh').disabled = false;

      document.dispatchEvent(
        new CustomEvent('northstar:state', {
          detail: feedError ? 'warning' : 'updated'
        })
      );

      render();
      scheduleMarketRefresh();
    }
  }

  function currentQuote(asset) {
    if (marketData) {
      return Market.quote(marketData, asset);
    }

    if (!Object.hasOwn(Assets.LEGACY, asset)) {
      return null;
    }

    const price = account.quotes?.[asset];

    const value =
      typeof price === 'number' ||
      typeof price === 'string'
        ? Number(price)
        : NaN;

    return (
      Number.isFinite(value) &&
      value > 0 &&
      Model.validDate(account.quoteDate)
    ) ? {
      price: value,
      priceEUR: value,
      currency: 'EUR',
      date: account.quoteDate,
      asOf: '',
      type: 'manual',
      exchange: 'XETR',
      timezone: 'Europe/Berlin'
    } : null;
  }

  function displayTime(
    time,
    zone = 'Europe/Berlin'
  ) {
    return Number.isFinite(Date.parse(time))
      ? new Intl.DateTimeFormat('en-GB', {
          timeZone: zone,
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(time))
      : '';
  }

  function sessionState(
    now = Date.now(),
    exchange = 'XETR'
  ) {
    return marketData
      ? Market.sessionState(
          marketData,
          exchange,
          now
        )
      : {
          known: false,
          open: false
        };
  }

  function quoteStale(quote, now = Date.now()) {
    if (
      !quote ||
      quote.priceEUR === null ||
      quote.type === 'manual'
    ) {
      return true;
    }

    const state = sessionState(
      now,
      quote.exchange
    );

    if (!state.known) return true;

    const stamp = Date.parse(quote.asOf);

    if (
      state.open &&
      now - stamp > 90 * 60000
    ) {
      return true;
    }

    if (
      !state.open &&
      state.previous &&
      (
        quote.date < state.previous.date ||
        (
          now > Date.parse(state.previous.close) + 3600000 &&
          stamp < Date.parse(state.previous.close) - 1800000
        )
      )
    ) {
      return true;
    }

    return (
      !!quote.fxAsOf &&
      Math.abs(
        stamp - Date.parse(quote.fxAsOf)
      ) > 72 * 3600000
    );
  }

  function quoteLabel(quote) {
    if (!quote) return 'Price unavailable';

    const zone =
      quote.timezone || 'Europe/Berlin';

    const city = zone === 'America/New_York'
      ? 'New York'
      : 'Berlin';

    const time = displayTime(
      quote.asOf,
      zone
    );

    return (
      quote.date +
      (time ? ' ' + time + ' ' + city : '') +
      (
        quote.type === 'manual'
          ? ' · manual snapshot'
          : quote.type === 'closing'
            ? ' · daily close'
            : ' · delayed quote'
      )
    );
  }

  function valuationLabel() {
    const quotes = (
      OWNED.length
        ? OWNED
        : ['VWCE', 'VFEA']
    ).map(currentQuote);

    if (
      quotes.some(quote =>
        !quote || quote.priceEUR === null
      )
    ) {
      return 'VALUATION UNAVAILABLE';
    }

    const oldest = quotes
      .filter(Boolean)
      .sort((a, b) =>
        (a.asOf || a.date).localeCompare(
          b.asOf || b.date
        )
      )[0];

    if (!oldest) {
      return 'MARKET DATA UNAVAILABLE';
    }

    return (
      (
        quotes.every(
          quote => quote.type === 'closing'
        )
          ? 'DAILY CLOSE / '
          : quotes.some(
              quote => quote.type === 'manual'
            )
            ? 'PRICE SNAPSHOT / '
            : 'DELAYED QUOTES / '
      ) +
      quoteLabel(oldest).split(' · ')[0] +
      (
        quotes.some(
          quote => quoteStale(quote)
        )
          ? ' · STALE'
          : ''
      )
    );
  }

  function updateMarketDisplay() {
    const exchanges = [...new Set(
      OWNED
        .map(asset => listing(asset)?.exchange)
        .filter(Boolean)
    )];

    if (!exchanges.length) {
      exchanges.push('XETR');
    }

    const states = exchanges.map(exchange => ({
      exchange,
      ...sessionState(Date.now(), exchange)
    }));

    const open = states.filter(
      state => state.open
    ).length;

    const known = states.every(
      state => state.known
    );

    const badge = el('northstar-market-status');

    if (badge) {
      const name = exchanges[0] === 'NMS'
        ? 'NASDAQ'
        : 'XETRA';

      badge.textContent =
        exchanges.length === 1
          ? name + (
              !known
                ? ' STATUS UNAVAILABLE'
                : open
                  ? ' OPEN'
                  : ' CLOSED'
            )
          : open
            ? `${open} OF ${exchanges.length} MARKETS OPEN`
            : known
              ? 'MARKETS CLOSED'
              : 'MARKET STATUS UNAVAILABLE';

      badge.dataset.market = open
        ? 'open'
        : known
          ? 'closed'
          : 'unknown';

      badge.title = states.map(state =>
        (
          state.exchange === 'NMS'
            ? 'Nasdaq'
            : 'Xetra'
        ) + ': ' + (
          !state.known
            ? 'calendar unavailable'
            : state.open
              ? 'regular session open'
              : 'regular session closed'
        )
      ).join(' · ');
    }

    if (el('hero-date')) {
      el('hero-date').textContent =
        valuationLabel();
    }

    if (el('goal-market')) {
      el('goal-market').textContent =
        valuationLabel() + ' · scheduled hourly';

      el('goal-market').dataset.warning = String(
        !!feedError ||
        result?.status === 'warning'
      );
    }

    if (el('focus-date')) {
      el('focus-date').textContent =
        valuationLabel();
    }

    if (el('pf-feed')) {
      el('pf-feed').textContent = marketData
        ? (
            feedError
              ? 'Refresh failed; previous published data retained. '
              : ''
          ) +
          'Delayed listing prices · portfolio values in EUR · ' +
          (
            result?.missing.length
              ? 'Some holdings cannot be valued.'
              : 'Each price retains its own timestamp.'
          )
        : 'Published prices unavailable. Refresh to retry.';
    }

    document.body.dataset.state =
      !marketData ||
      feedError ||
      result?.status === 'warning'
        ? 'warning'
        : 'idle';
  }

  function scheduleMarketRefresh() {
    clearTimeout(marketTimer);

    if (document.hidden) return;

    const exchanges = new Set(
      OWNED
        .map(asset => listing(asset)?.exchange)
        .filter(Boolean)
    );

    if (!exchanges.size) {
      exchanges.add('XETR');
    }

    const active = [...exchanges].some(exchange => {
      const state = sessionState(
        Date.now(),
        exchange
      );

      return !state.known || state.open;
    });

    marketTimer = setTimeout(
      refreshPrices,
      (active ? 5 : 30) * 60000
    );
  }

  function setupMarketDisplay() {
    const style = document.createElement('style');

    style.textContent = `
      .data-status {
        flex-wrap: wrap;
        gap: 12px;
      }

      .data-status > .status-dot {
        display: none;
      }

      #northstar-market-status {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        color: #cdb78c;
        font: 9px/1.8 var(--mono);
        letter-spacing: .07em;
      }

      #northstar-market-status::before {
        content: "";
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: currentColor;
      }

      #northstar-market-status[data-market=open] {
        color: #80d8ad;
      }

      #northstar-market-status[data-market=closed] {
        color: #ee9696;
      }

      #hero-date {
        font-size: 9px;
      }

      #pf-holdings td small {
        display: block;
        margin-top: 5px;
        color: #9daab8;
        font-size: 11px;
      }

      #pf-legend {
        flex-wrap: wrap;
      }

      #pf-prices {
        grid-template-columns:
          repeat(auto-fit, minmax(170px, 1fr));
      }
    `;

    document.head.append(style);

    const badge = document.createElement('span');

    badge.id = 'northstar-market-status';
    badge.setAttribute('role', 'status');

    document.querySelector('.data-status')
      ?.prepend(badge);

    setInterval(() => {
      if (!document.hidden) {
        updateMarketDisplay();
      }
    }, 60000);

    document.addEventListener(
      'visibilitychange',
      () => {
        clearTimeout(marketTimer);

        if (!document.hidden) {
          updateMarketDisplay();

          if (Date.now() - lastAttempt > 60000) {
            refreshPrices();
          } else {
            scheduleMarketRefresh();
          }
        }
      }
    );

    document.addEventListener('click', event => {
      if (
        event.target.closest?.('#explore-core')
      ) {
        queueMicrotask(syncFocus);
      }
    });
  }

  function summary() {
    const value = Model.summarize(
      account.trades,
      marketData
    );

    if (!marketData) {
      for (const row of value.holdings) {
        const candidate = currentQuote(row.key);

        if (
          candidate &&
          row.trades.every(
            trade => trade.date <= candidate.date
          )
        ) {
          row.quote = candidate;
          row.shares = row.recordedShares;
          row.value = row.shares * candidate.price;
          row.profit = row.value - row.invested;

          row.reason = Number.isFinite(row.value)
            ? ''
            : 'invalid-value';

          if (row.reason) {
            row.value = row.profit = null;
          }
        }
      }

      value.value = value.holdings.every(
        row => row.value !== null
      )
        ? value.holdings.reduce(
            (total, row) => total + row.value,
            0
          )
        : null;

      if (!Number.isFinite(value.value)) {
        value.value = null;
      }

      value.profit = value.value === null
        ? null
        : value.value - value.invested;

      const basis = value.value > 0
        ? value.value
        : value.invested;

      value.allocationBasis = value.value > 0
        ? 'Market value'
        : 'Invested capital';

      for (const row of value.holdings) {
        row.weight = basis
          ? (
              value.value > 0
                ? row.value
                : row.invested
            ) / basis * 100
          : 0;
      }

      value.allocation =
        value.allocationWorld =
          value.rows.VWCE?.weight || 0;

      value.allocationEmerging =
        value.rows.VFEA?.weight || 0;

      value.allocationOther = basis
        ? Math.max(
            0,
            100 -
            value.allocationWorld -
            value.allocationEmerging
          )
        : 0;

      value.status = 'warning';

      value.missing = value.holdings
        .filter(row => row.reason)
        .map(row => ({
          asset: row.key,
          reason: row.reason
        }));
    }

    if (
      document.body.dataset.storageError === 'true'
    ) {
      value.value = value.profit = null;
    }

    return value;
  }

  function render() {
    result = summary();
    syncAssets();

    el('pf-invested').textContent =
      eur(result.invested);

    el('pf-value').textContent =
      result.value === null
        ? '—'
        : eur(result.value);

    el('pf-pl').textContent =
      result.profit === null ||
      !result.invested
        ? '—'
        : `${signedEuro(result.profit)} (${pct(
            result.profit /
            result.invested * 100
          )})`;

    el('pf-pl').style.color =
      result.profit === null
        ? ''
        : result.profit >= 0
          ? '#65e5aa'
          : '#ff9292';

    el('pf-count').textContent =
      account.trades.length;

    el('pf-holdings').innerHTML =
      result.holdings.length
        ? result.holdings.map(row => `
          <tr data-holding="${html(row.key)}">
            <td style="color:${color(row.key)}">
              <b>${html(label(row.key))}</b>
              <small>${html(row.instrument.name)}</small>
            </td>
            <td>${eur(row.invested)}</td>
            <td>${sharesText(row.shares)}</td>
            <td title="${html(quoteLabel(row.quote))}">
              ${
                row.quote
                  ? money(
                      row.quote.price,
                      row.instrument.currency
                    )
                  : '—'
              }
            </td>
            <td>${
              row.value === null
                ? '—'
                : eur(row.value)
            }</td>
            <td>${
              row.profit === null
                ? '—'
                : signedEuro(row.profit)
            }</td>
          </tr>
        `).join('')
        : '<tr><td colspan="6">No purchases saved in this browser.</td></tr>';

    const segments = [];
    let edge = 0;

    for (const row of result.holdings) {
      const start = edge;
      edge += row.weight;

      segments.push(
        `${color(row.key)} ${start}% ${edge}%`
      );
    }

    el('pf-bar').style.background =
      segments.length
        ? `linear-gradient(to right,${segments.join(',')})`
        : '#273548';

    el('pf-allocation').textContent =
      result.count
        ? result.allocationBasis +
          ' allocation · ' +
          result.holdings.map(row =>
            `${label(row.key)} ${row.weight.toFixed(1)}%`
          ).join(' · ')
        : 'No purchases saved';

    el('pf-trades').innerHTML = [...account.trades]
      .sort((a, b) =>
        b.date.localeCompare(a.date)
      )
      .map(trade => {
        const key = Model.assetKey(
          Assets.forTrade(trade)
        );

        return `
          <tr>
            <td>${html(trade.date)}</td>
            <td style="color:${color(key)}">
              ${html(label(key))}
            </td>
            <td>${eur(trade.amount)}</td>
            <td>${sharesText(trade.shares)}</td>
            <td>${html(trade.broker)}</td>
          </tr>
        `;
      }).join('');

    el('pf-prices').innerHTML =
      SYMBOLS.map(asset => {
        const quote = currentQuote(asset);

        return `
          <div class="pf-quote">
            <small>${html(label(asset))}</small>
            <strong style="color:${color(asset)}">
              ${
                quote
                  ? money(
                      quote.price,
                      quote.currency
                    )
                  : '—'
              }
            </strong>
            <span>
              ${html(quoteLabel(quote))}
              ${
                quote && quoteStale(quote)
                  ? ' · STALE'
                  : ''
              }
            </span>
          </div>
        `;
      }).join('');

    const dates = result.holdings
      .map(row => row.quote?.date)
      .filter(Boolean)
      .sort();

    const detail = {
      ...result,

      date: dates[0] || '',

      historyDate:
        historyData('market').at(-1)?.day || '',

      quotes: Object.fromEntries(
        SYMBOLS.map(asset => [
          asset,
          currentQuote(asset)
        ])
      ),

      status:
        feedError ||
        document.body.dataset.storageError === 'true'
          ? 'warning'
          : result.status
    };

    document.dispatchEvent(
      new CustomEvent('northstar:summary', {
        detail
      })
    );

    // Presentation listeners run first.
    // Then apply the multi-asset labels.
    el('pf-bar').setAttribute(
      'aria-label',
      el('pf-allocation').textContent
    );

    const extra = result.holdings.some(
      row => !['VWCE', 'VFEA'].includes(row.key)
    );

    if (el('core-allocation')) {
      el('core-allocation').textContent = extra
        ? `${result.holdings.length} investments`
        : `${result.allocationWorld.toFixed(1)}% / ${
            result.allocationEmerging.toFixed(1)
          }%`;

      const caption = el('core-allocation')
        .parentElement
        .querySelector('span');

      if (caption) {
        caption.textContent = extra
          ? 'HOLDINGS'
          : result.allocationBasis.toUpperCase() +
            ' / WORLD : EMERGING';
      }
    }

    document.querySelectorAll(
      '#goal-section p'
    ).forEach(p => {
      if (
        p.textContent.includes('SXR8 is excluded.')
      ) {
        p.textContent = p.textContent.replace(
          'SXR8 is excluded.',
          'The reference benchmark is excluded unless purchased.'
        );
      }
    });

    syncFocus();
    updateMarketDisplay();
    drawChart();
  }

  let focusSelected = '';

  function syncFocus() {
    const dialog = el('core-dialog');

    if (!dialog?.open || !result) return;

    if (el('map-help')) {
      el('map-help').textContent =
        'Purchased holdings and allocation. ' +
        'The reference benchmark is separate from owned positions.';
    }

    const footer = dialog.querySelector(
      '.map-bottom > span'
    );

    if (footer) {
      footer.textContent =
        'Delayed market prices · private browser storage';
    }

    if (el('focus-total')) {
      el('focus-total').textContent =
        result.value === null
          ? '—'
          : eur(result.value);
    }

    const bar = dialog.querySelector(
      '.focus-allocation'
    );

    const legend = dialog.querySelector(
      '.focus-legend'
    );

    if (bar) {
      bar.innerHTML = result.holdings
        .map(row => `
          <span style="
            width:${row.weight}%;
            background:${color(row.key)}
          "></span>
        `).join('');

      while (bar.children.length < 2) {
        bar.append(
          document.createElement('span')
        );
      }

      bar.setAttribute(
        'aria-label',
        el('pf-allocation').textContent
      );
    }

    if (legend) {
      legend.innerHTML = result.holdings
        .map(row => `
          <div>
            <span>
              <i style="background:${color(row.key)}"></i>
              ${html(label(row.key))}
            </span>
            <strong>${row.weight.toFixed(1)}%</strong>
          </div>
        `).join('') +
        '<strong id="focus-world" hidden></strong>' +
        '<strong id="focus-emerging" hidden></strong>';
    }

    if (el('focus-basis')) {
      el('focus-basis').textContent =
        result.count
          ? result.allocationBasis +
            ' allocation · purchased holdings only'
          : 'No purchases saved in this browser.';
    }

    const selector = dialog.querySelector(
      '.asset-selector'
    );

    const keys = [...OWNED, 'SXR8'];

    if (!keys.includes(focusSelected)) {
      focusSelected = keys[0];
    }

    if (selector) {
      selector.replaceChildren();
      selector.style.flexWrap = 'wrap';

      for (const asset of keys) {
        const button = document.createElement(
          'button'
        );

        button.type = 'button';
        button.textContent = label(asset);
        button.style.color = color(asset);

        button.setAttribute(
          'aria-pressed',
          String(asset === focusSelected)
        );

        button.addEventListener('click', () => {
          focusSelected = asset;
          syncFocus();
        });

        selector.append(button);
      }
    }

    const box = el('asset-detail');
    if (!box) return;

    const row = result.rows[focusSelected];

    box.style.setProperty(
      '--asset-color',
      color(focusSelected)
    );

    box.innerHTML =
      `<h3>${html(label(focusSelected))}</h3>` +
      (
        row
          ? `
            <p>${html(row.instrument.name)}</p>
            <dl class="asset-metrics">
              <dt>Invested</dt>
              <dd>${eur(row.invested)}</dd>

              <dt>Shares</dt>
              <dd>${sharesText(row.shares)}</dd>

              <dt>Listing price</dt>
              <dd>${
                row.quote
                  ? money(
                      row.quote.price,
                      row.instrument.currency
                    )
                  : '—'
              }</dd>

              <dt>Value in EUR</dt>
              <dd>${
                row.value === null
                  ? '—'
                  : eur(row.value)
              }</dd>

              <dt>Unrealized P/L</dt>
              <dd>${
                row.profit === null
                  ? '—'
                  : signedEuro(row.profit)
              }</dd>
            </dl>
          `
          : '<p>S&P 500 reference. This comparison does not add an owned position.</p>'
      );
  }

  function seriesData() {
    return historyData('capital');
  }

  function drawChart() {
    requestAnimationFrame(
      syncPerformanceLabels
    );

    const target = el('pf-chart');
    const market = chartMode === 'market';

    let data = [];

    try {
      data = market
        ? historyData('market')
        : seriesData();
    } catch (error) {
      console.warn(
        'Chart data unavailable',
        error
      );
    }

    el('pf-legend')
      .querySelectorAll('button')
      .forEach(button => {
        button.disabled =
          market &&
          button.dataset.series === 'Portfolio';

        button.title = button.disabled
          ? 'Portfolio is available in Your capital view'
          : 'Toggle this series';
      });

    if (!data.length) {
      const title = !marketData
        ? 'Awaiting market history'
        : !account.trades.length
          ? 'Your capital, in perspective.'
          : 'Comparison needs complete price history';

      const message = !marketData
        ? 'Refresh to retry the daily closing-price feed.'
        : !account.trades.length
          ? 'Restore your purchases to compare your portfolio. Market returns are available above.'
          : 'A purchase, price, exchange rate or split history is outside the available coverage. No entry prices have been invented.';

      target.innerHTML = `
        <div class="pf-empty">
          <span class="empty-star">✧</span>
          <strong>${title}</strong>
          <p>${message}</p>
          ${
            marketData && !account.trades.length
              ? '<a href="./ledger.html">Restore your portfolio ↗</a>'
              : ''
          }
        </div>
      `;

      el('pf-readout').textContent = '';

      el('pf-chart-note').textContent =
        'Completed daily closes only. ' +
        'The benchmark is separate from purchased holdings.';

      return;
    }

    const final = data.at(-1).day;

    const limit = new Date(
      final + 'T12:00:00Z'
    );

    const months = {
      '1M': 1,
      '3M': 3,
      '6M': 6,
      '1Y': 12
    };

    if (months[range]) {
      limit.setUTCMonth(
        limit.getUTCMonth() - months[range]
      );
    }

    const cutoff = limit
      .toISOString()
      .slice(0, 10);

    let points = range === 'ALL'
      ? data
      : data.filter(
          point => point.day >= cutoff
        );

    if (market) {
      const base = points[0];

      points = points.map(point => ({
        day: point.day,

        ...Object.fromEntries(
          SYMBOLS.map(asset => [
            asset,
            (
              point[asset] /
              base[asset] - 1
            ) * 100
          ])
        )
      }));
    }

    const chosen = [...visible].filter(
      asset =>
        ['Portfolio', ...SYMBOLS].includes(asset) &&
        (!market || asset !== 'Portfolio')
    );

    const values = points.flatMap(point =>
      chosen
        .map(asset => point[asset])
        .filter(Number.isFinite)
    );

    if (!values.length) {
      target.innerHTML =
        '<div class="pf-empty">Select at least one series above.</div>';

      el('pf-readout').textContent = '';
      return;
    }

    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values);

    const padding = Math.max(
      0.5,
      (maximum - minimum) * 0.13
    );

    const low = minimum - padding;
    const high = maximum + padding;

    const width = Math.max(
      300,
      target.clientWidth || 900
    );

    const height = width < 520
      ? 285
      : 340;

    const left = 48;
    const right = 16;
    const top = 18;
    const bottom = 34;

    const firstTime = Date.parse(
      points[0].day
    );

    const lastTime = Date.parse(final);

    const x = index =>
      left +
      (width - left - right) *
      (
        Date.parse(points[index].day) -
        firstTime
      ) /
      Math.max(
        1,
        lastTime - firstTime
      );

    const y = value =>
      top +
      (height - top - bottom) *
      (high - value) /
      (high - low);

    let svg = '';

    for (let index = 0; index <= 4; index++) {
      const value =
        low + (high - low) * index / 4;

      svg += `
        <line
          x1="${left}"
          x2="${width - right}"
          y1="${y(value)}"
          y2="${y(value)}"
          stroke="#7299b31b"
        />

        <text
          x="${left - 9}"
          y="${y(value) + 4}"
          text-anchor="end"
          fill="#8da5b9"
          font-size="10"
        >${value.toFixed(1)}%</text>
      `;
    }

    svg += `
      <line
        x1="${left}"
        x2="${width - right}"
        y1="${y(0)}"
        y2="${y(0)}"
        stroke="#7299b34d"
        stroke-dasharray="3 5"
      />
    `;

    chosen.forEach(asset => {
      let path = '';
      let active = false;

      points.forEach((point, index) => {
        if (Number.isFinite(point[asset])) {
          path +=
            `${active ? 'L' : 'M'}` +
            `${x(index).toFixed(2)},` +
            `${y(point[asset]).toFixed(2)} `;

          active = true;
        } else {
          active = false;
        }
      });

      svg += `
        <path
          class="chart-line"
          pathLength="1"
          d="${path}"
          fill="none"
          stroke="${COLORS[asset]}"
          stroke-width="${
            asset === 'Portfolio' ? 2.5 : 1.7
          }"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      `;

      const end = points.at(-1)[asset];

      if (Number.isFinite(end)) {
        svg += `
          <circle
            cx="${x(points.length - 1)}"
            cy="${y(end)}"
            r="3"
            fill="${COLORS[asset]}"
          />
        `;
      }
    });

    const labelIndexes = [...new Set([
      0,
      Math.floor(
        (points.length - 1) / 2
      ),
      points.length - 1
    ])];

    for (const index of labelIndexes) {
      const anchor = index === 0
        ? 'start'
        : index === points.length - 1
          ? 'end'
          : 'middle';

      svg += `
        <text
          x="${x(index)}"
          y="${height - 8}"
          text-anchor="${anchor}"
          fill="#8da5b9"
          font-size="10"
        >${points[index].day}</text>
      `;
    }

    svg += `
      <g id="pf-crosshair" visibility="hidden">
        <line
          id="pf-cross-line"
          y1="${top}"
          y2="${height - bottom}"
          stroke="#c5e8ff88"
          stroke-dasharray="3 4"
        />

        ${chosen.map(asset => `
          <circle
            data-dot="${html(asset)}"
            r="4"
            fill="${COLORS[asset]}"
            stroke="#08101b"
            stroke-width="2"
          />
        `).join('')}
      </g>
    `;

    target.innerHTML = `
      <svg
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="${
          market
            ? 'Investment price returns in EUR'
            : 'Profit relative to contributions'
        } history"
      >${svg}</svg>

      <input
        id="pf-scrub"
        class="chart-scrub"
        type="range"
        min="0"
        max="${points.length - 1}"
        value="${points.length - 1}"
        aria-label="Inspect historical date"
      >

      <span class="scrub-hint">
        Drag the chart · use the slider or arrow keys to inspect history
      </span>
    `;

    function show(position, cross = true) {
      const index = Math.max(
        0,
        Math.min(
          points.length - 1,
          position
        )
      );

      const point = points[index];

      el('pf-readout').innerHTML = `
        <time>${point.day}</time>

        ${chosen.map(asset => `
          <span>
            <i style="background:${COLORS[asset]}"></i>
            ${html(label(asset))}
            <b>${
              Number.isFinite(point[asset])
                ? pct(point[asset])
                : '—'
            }</b>
          </span>
        `).join('')}
      `;

      el('pf-crosshair').setAttribute(
        'visibility',
        cross ? 'visible' : 'hidden'
      );

      el('pf-cross-line').setAttribute(
        'x1',
        x(index)
      );

      el('pf-cross-line').setAttribute(
        'x2',
        x(index)
      );

      target.querySelectorAll(
        '[data-dot]'
      ).forEach(dot => {
        const value =
          point[dot.dataset.dot];

        dot.setAttribute(
          'visibility',
          Number.isFinite(value)
            ? 'visible'
            : 'hidden'
        );

        if (Number.isFinite(value)) {
          dot.setAttribute('cx', x(index));
          dot.setAttribute('cy', y(value));
        }
      });

      el('pf-scrub').value = index;

      el('pf-scrub').setAttribute(
        'aria-valuetext',
        `${point.day}. ` +
        chosen.map(asset =>
          `${label(asset)}: ${
            Number.isFinite(point[asset])
              ? pct(point[asset])
              : 'unavailable'
          }`
        ).join('. ')
      );
    }

    const plot = target.querySelector('svg');

    let frame = 0;
    let pendingX = 0;

    function scrub(event) {
      pendingX = event.clientX;

      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;

        const rect =
          plot.getBoundingClientRect();

        const position =
          (pendingX - rect.left) /
          rect.width * width;

        let closest = 0;

        for (
          let index = 1;
          index < points.length;
          index++
        ) {
          if (
            Math.abs(
              x(index) - position
            ) <
            Math.abs(
              x(closest) - position
            )
          ) {
            closest = index;
          }
        }

        show(closest);
      });
    }

    plot.addEventListener(
      'pointermove',
      scrub
    );

    plot.addEventListener(
      'pointerdown',
      event => {
        plot.setPointerCapture(
          event.pointerId
        );

        scrub(event);
      }
    );

    plot.addEventListener(
      'pointerleave',
      () => {
        if (frame) {
          cancelAnimationFrame(frame);
        }

        frame = 0;

        show(
          points.length - 1,
          false
        );
      }
    );

    el('pf-scrub').addEventListener(
      'input',
      event => {
        show(Number(event.target.value));
      }
    );

    show(points.length - 1, false);

    el('pf-chart-note').textContent = market
      ? `Investment closing-price returns in EUR, rebased to 0% on ${points[0].day}. ` +
        `These are investment price returns, not your portfolio. History ends ${final}; ` +
        'selected windows are limited to available data.'
      : 'Cumulative profit ÷ contributed capital, not time-weighted return. ' +
        `Window starts ${points[0].day}; returns remain since first purchase. ` +
        'SXR8 receives the same amounts on the same dates, priced at the next ' +
        'available common close. Benchmark excludes fees and taxes; portfolio ' +
        'includes only costs in saved purchase amounts. No intraday valuation is assumed.';
  }

  // CSV includes instrument metadata so additional
  // holdings can be restored correctly.
  function parseCsv(text) {
    text = String(text)
      .replace(/^\uFEFF/, '')
      .trim();

    if (text.length > 1048576) {
      throw Error('Backup exceeds 1 MB.');
    }

    const first =
      text.split(/\r?\n/)[0] || '';

    const delimiter = first.includes('\t')
      ? '\t'
      : first.includes(';') &&
        !first.includes(',')
        ? ';'
        : ',';

    const rows = [];

    let row = [];
    let field = '';
    let quoted = false;

    for (
      let index = 0;
      index < text.length;
      index++
    ) {
      const char = text[index];

      if (char === '"') {
        if (
          quoted &&
          text[index + 1] === '"'
        ) {
          field += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (
        !quoted &&
        [delimiter, '\n', '\r'].includes(char)
      ) {
        row.push(field);
        field = '';

        if (char !== delimiter) {
          if (
            row.some(value => value.trim())
          ) {
            rows.push(row);
          }

          row = [];

          if (
            char === '\r' &&
            text[index + 1] === '\n'
          ) {
            index++;
          }
        }
      } else {
        field += char;
      }
    }

    if (quoted) {
      throw Error(
        'Unclosed quoted field in CSV.'
      );
    }

    row.push(field);

    if (
      row.some(value => value.trim())
    ) {
      rows.push(row);
    }

    let instrumentColumn = 6;

    if (
      rows[0]?.[0]
        .trim()
        .toLowerCase() === 'date'
    ) {
      const header = rows.shift().map(
        value => value.trim().toLowerCase()
      );

      instrumentColumn =
        header.indexOf('instrument');
    }

    if (!rows.length) {
      throw Error('No purchases in this CSV.');
    }

    return Model.validateTrades(
      rows.map(values => {
        let [
          date,
          asset,
          amount,
          shares,
          purchasePrice,
          broker
        ] = values;

        asset = (asset || '').trim();

        if (
          ['VWCE', 'VFEA'].includes(
            asset.toUpperCase()
          )
        ) {
          asset = asset.toUpperCase();
        }

        const trade = {
          date: date?.trim(),
          asset,
          amount,
          shares,
          purchasePrice,
          broker
        };

        const metadata =
          instrumentColumn >= 0
            ? values[instrumentColumn]?.trim()
            : '';

        if (metadata) {
          trade.instrument =
            JSON.parse(metadata);
        }

        return trade;
      })
    );
  }

  function toCsv(input) {
    const trades = Model.validateTrades(input);

    const rows = [
      [
        'date',
        'asset',
        'invested',
        'shares',
        'price',
        'broker',
        'instrument'
      ],

      ...trades.map(trade => [
        trade.date,
        trade.asset,
        trade.amount,
        trade.shares,
        trade.purchasePrice || '',
        trade.broker,
        trade.instrument
          ? JSON.stringify(trade.instrument)
          : ''
      ])
    ];

    return rows.map(row =>
      row.map(value =>
        '"' +
        String(value).replaceAll('"', '""') +
        '"'
      ).join(',')
    ).join('\r\n');
  }

  document.addEventListener(
    'northstar:save-transactions',
    event => {
      const request = event.detail;

      if (
        !request ||
        typeof request.success !== 'function' ||
        typeof request.error !== 'function'
      ) {
        return;
      }

      let raw;

      try {
        raw = localStorage.getItem(
          STORAGE_KEY
        );

        if (raw !== request.expectedRaw) {
          throw Error(
            'Purchases changed in another tab or import. ' +
            'Cancel and reopen the form.'
          );
        }

        const previous = raw === null
          ? account
          : JSON.parse(raw);

        if (
          !previous ||
          !Array.isArray(previous.trades)
        ) {
          throw Error(
            'Saved purchases could not be read. ' +
            'Export the raw JSON backup first.'
          );
        }

        const next = {
          ...previous,
          trades: Model.validateTrades(
            request.trades
          )
        };

        raw = JSON.stringify(next);

        localStorage.setItem(
          STORAGE_KEY,
          raw
        );

        account = next;

        document.body.removeAttribute(
          'data-storage-error'
        );
      } catch (error) {
        request.error(
          error.message ||
          'Unable to save purchases.'
        );

        return;
      }

      try {
        render();
      } catch (error) {
        console.error(
          'Purchases saved; interface refresh failed.',
          error
        );
      }

      request.success(raw);
    }
  );

  document.addEventListener(
    'northstar:reload-transactions',
    () => {
      loadAccount();
      render();
    }
  );

  addEventListener('storage', event => {
    if (
      (
        event.key === STORAGE_KEY ||
        event.key === null
      ) &&
      el('pf-root')
    ) {
      loadAccount();
      render();
    }
  });

  function loadTransactionEditor() {
    if (
      el('northstar-transactions-script')
    ) {
      return;
    }

    const script =
      document.createElement('script');

    script.id =
      'northstar-transactions-script';

    const url = new URL(
      './transactions.js',
      ENGINE_URL
    );

    url.searchParams.set(
      'v',
      String(Date.now())
    );

    script.src = url.href;

    script.onerror = () => {
      el('pf-message').textContent =
        'Purchase editor unavailable. Imports and backups remain available. Reload to retry.';
    };

    document.head.append(script);
  }

  function importCsv() {
    try {
      const raw = el('pf-csv')
        .value
        .trim();

      if (raw.length > 1048576) {
        throw Error('Backup exceeds 1 MB.');
      }

      const imported = raw.startsWith('{')
        ? JSON.parse(raw)
        : null;

      const trades = imported
        ? Model.validateTrades(
            imported.trades
          )
        : parseCsv(raw);

      const next = imported
        ? {
            ...imported,
            trades
          }
        : {
            ...account,
            trades
          };

      if (
        !confirm(
          `Save ${trades.length} purchases in this browser? ` +
          'This replaces the current portfolio. ' +
          'Export a backup first if needed.'
        )
      ) {
        return;
      }

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );

      account = next;

      document.body.removeAttribute(
        'data-storage-error'
      );

      el('pf-csv').value = '';

      el('pf-message').textContent =
        `${trades.length} purchases saved privately in this browser.`;

      render();
    } catch (error) {
      el('pf-message').textContent =
        error.message;
    }
  }

  function downloadBackup(
    content,
    extension,
    type
  ) {
    const url = URL.createObjectURL(
      new Blob([content], {type})
    );

    const link =
      document.createElement('a');

    link.href = url;

    link.download =
      `northstar-portfolio-${
        new Date().toISOString().slice(0, 10)
      }.${extension}`;

    document.body.append(link);

    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      2000
    );
  }

  function exportCsv() {
    try {
      if (
        document.body.dataset.storageError === 'true'
      ) {
        throw Error(
          'Saved purchases could not be read. ' +
          'Export the raw JSON backup instead.'
        );
      }

      downloadBackup(
        toCsv(account.trades),
        'csv',
        'text/csv;charset=utf-8'
      );
    } catch (error) {
      el('pf-message').textContent =
        error.message;
    }
  }

  function exportJson() {
    try {
      downloadBackup(
        localStorage.getItem(STORAGE_KEY) ||
        JSON.stringify(account),
        'json',
        'application/json'
      );
    } catch (_) {
      el('pf-message').textContent =
        'Browser storage is inaccessible.';
    }
  }

  window.NorthstarEngine = Object.freeze({
    version: 2,

    catalogue: () => marketData
      ? Object.values(
          marketData.instruments
        ).map(entry => entry.instrument)
      : [],

    currentSummary: () => result
  });

  function initialize() {
    const host = el('view-investments');

    if (!host || el('pf-root')) return;

    const root =
      document.createElement('div');

    root.id = 'pf-root';

    root.innerHTML = `
      <div class="pf-micro">
        NORTHSTAR / INVESTMENT INTELLIGENCE 002
      </div>

      <h1>
        My Portfolio<span style="color:#56d5ef">.</span>
      </h1>

      <p class="pf-sub">
        Purchased holdings · values in EUR · S&P 500 benchmark
      </p>

      <div class="pf-grid">
        <div class="pf-card">
          <small>TOTAL INVESTED</small>
          <strong id="pf-invested">—</strong>
        </div>

        <div class="pf-card">
          <small>PORTFOLIO VALUE*</small>
          <strong id="pf-value">—</strong>
        </div>

        <div class="pf-card">
          <small>UNREALIZED P/L*</small>
          <strong id="pf-pl">—</strong>
        </div>

        <div class="pf-card">
          <small>PURCHASES</small>
          <strong id="pf-count">—</strong>
        </div>
      </div>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Performance observatory</h2>
          <span class="pf-micro">HISTORY / EUR</span>
        </div>

        <div
          class="pf-controls pf-modes"
          id="pf-modes"
          aria-label="Return calculation"
        >
          <button
            type="button"
            data-mode="capital"
            class="active"
            aria-pressed="true"
          >Your capital</button>

          <button
            type="button"
            data-mode="market"
            aria-pressed="false"
          >Market returns</button>
        </div>

        <div
          class="pf-controls"
          id="pf-legend"
        ></div>

        <div
          class="pf-controls"
          id="pf-periods"
        >
          <button
            data-range="1M"
            type="button"
            aria-pressed="false"
          >1M</button>

          <button
            data-range="3M"
            type="button"
            aria-pressed="false"
          >3M</button>

          <button
            data-range="6M"
            type="button"
            aria-pressed="false"
          >6M</button>

          <button
            data-range="1Y"
            type="button"
            aria-pressed="false"
          >1Y</button>

          <button
            data-range="ALL"
            type="button"
            class="active"
            aria-pressed="true"
          >ALL</button>
        </div>

        <div
          id="pf-readout"
          class="pf-readout"
          aria-live="off"
        ></div>

        <div id="pf-chart"></div>

        <p
          id="pf-chart-note"
          class="pf-sub"
        ></p>
      </section>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Automatic Market Prices</h2>

          <button
            type="button"
            id="pf-refresh"
          >REFRESH DATA ↻</button>
        </div>

        <p
          class="pf-sub"
          id="pf-feed"
        >
          Connecting to market data…
        </p>

        <div
          id="pf-prices"
          class="pf-prices"
        ></div>

        <p class="pf-sub">
          *Delayed listing prices, retrieved on the GitHub schedule
          during supported market sessions.
          Foreign-currency holdings are converted to EUR using
          the published exchange rate.
          Charts use completed daily closes and dated exchange rates.
          Source: Yahoo Finance via GitHub Actions.
        </p>
      </section>

      <section class="pf-panel">
        <h2>Current Holdings</h2>

        <div
          class="pf-bar"
          id="pf-bar"
        ></div>

        <p
          class="pf-sub"
          id="pf-allocation"
        ></p>

        <div class="pf-table">
          <table>
            <thead>
              <tr>
                <th>INVESTMENT</th>
                <th>INVESTED</th>
                <th>SHARES</th>
                <th>PRICE*</th>
                <th>VALUE*</th>
                <th>P/L*</th>
              </tr>
            </thead>

            <tbody id="pf-holdings"></tbody>
          </table>
        </div>

        <p class="pf-sub">
          P/L uses the saved purchase amounts and full saved
          share precision. It may differ slightly from your
          brokers and excludes costs not captured in those amounts.
        </p>
      </section>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Transaction History</h2>

          <span class="pf-micro">
            PRIVATE / THIS BROWSER
          </span>
        </div>

        <div class="pf-table">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>INVESTMENT</th>
                <th>INVESTED</th>
                <th>SHARES</th>
                <th>BROKER</th>
              </tr>
            </thead>

            <tbody id="pf-trades"></tbody>
          </table>
        </div>

        <details>
          <summary>Import or restore purchases</summary>

          <p class="pf-sub">
            Choose a CSV or JSON backup, or paste CSV below.
            Import replaces purchases only after confirmation.
            Nothing is uploaded to GitHub.
          </p>

          <label class="file-label">
            Choose backup

            <input
              id="pf-file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
            >
          </label>

          <label for="pf-csv">
            Backup contents
          </label>

          <textarea
            id="pf-csv"
            placeholder="date,asset,invested,shares,price,broker"
          ></textarea>

          <button
            id="pf-import"
            type="button"
          >IMPORT TRANSACTIONS</button>
        </details>

        <button
          id="pf-json"
          type="button"
        >EXPORT JSON BACKUP ↓</button>

        <button
          id="pf-backup"
          type="button"
        >EXPORT CSV ↓</button>

        <p
          class="pf-sub"
          id="pf-message"
          aria-live="polite"
        >
          Your transactions are stored only in this browser.
          Save a backup.
        </p>
      </section>
    `;

    host.appendChild(root);

    document.dispatchEvent(
      new Event('northstar:ready')
    );

    el('pf-modes')
      .querySelector('[data-mode=market]')
      .textContent = 'Market returns';

    el('pf-json').addEventListener(
      'click',
      exportJson
    );

    el('pf-file').addEventListener(
      'change',
      async event => {
        const file = event.target.files[0];

        if (!file) return;

        if (file.size > 1048576) {
          el('pf-message').textContent =
            'Backup exceeds 1 MB.';

          return;
        }

        try {
          el('pf-csv').value =
            await file.text();
        } catch (_) {
          el('pf-message').textContent =
            'Unable to read backup file.';
        }

        event.target.value = '';
      }
    );

    el('pf-modes').addEventListener(
      'click',
      event => {
        const button =
          event.target.closest('[data-mode]');

        if (!button) return;

        chartMode = button.dataset.mode;

        el('pf-modes')
          .querySelectorAll('button')
          .forEach(item => {
            item.classList.toggle(
              'active',
              item === button
            );

            item.setAttribute(
              'aria-pressed',
              String(item === button)
            );
          });

        drawChart();
      }
    );

    syncLegend();

    el('pf-periods').addEventListener(
      'click',
      event => {
        const button = event.target.closest(
          'button[data-range]'
        );

        if (!button) return;

        range = button.dataset.range;

        el('pf-periods')
          .querySelectorAll('button')
          .forEach(item => {
            item.classList.toggle(
              'active',
              item === button
            );

            item.setAttribute(
              'aria-pressed',
              String(item === button)
            );
          });

        drawChart();
      }
    );

    el('pf-import').addEventListener(
      'click',
      importCsv
    );

    el('pf-backup').addEventListener(
      'click',
      exportCsv
    );

    el('pf-refresh').addEventListener(
      'click',
      refreshPrices
    );

    let resizeTimer;
    let lastWidth = 0;

    new ResizeObserver(entries => {
      const width = Math.round(
        entries[0].contentRect.width
      );

      if (width === lastWidth) return;

      lastWidth = width;

      clearTimeout(resizeTimer);

      resizeTimer = setTimeout(
        drawChart,
        120
      );
    }).observe(el('pf-chart'));

    setupMarketDisplay();
    loadAccount();
    render();
    refreshPrices();
    loadTransactionEditor();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {once: true}
    );
  } else {
    initialize();
  }
})();
