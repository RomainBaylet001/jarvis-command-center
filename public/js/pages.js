/* NORTHSTAR / shared page shell. Uses the existing portfolio engine. */
(() => {
  'use strict';

  const pages = [
    ['overview', 'Overview', 'index.html'],
    ['performance', 'Performance', 'performance.html'],
    ['goal', 'Goal', 'goal.html'],
    ['xray', 'X-Ray', 'xray.html'],
    ['holdings', 'Holdings', 'holdings.html'],
    ['ledger', 'Ledger', 'ledger.html']
  ];

  const current = document.body.dataset.northstarPage;

  if (!pages.some(([key]) => key === current)) return;

  const legacy = {
    '#pf-chart': 'performance.html',
    '#goal-section': 'goal.html',
    '#portfolio-xray': 'xray.html',
    '#pf-holdings': 'holdings.html',
    '#pf-trades': 'ledger.html'
  };

  if (current === 'overview' && legacy[location.hash]) {
    location.replace('./' + legacy[location.hash]);
    return;
  }

  const version = 'pages-1';
  const get = id => document.getElementById(id);
  let connected = false;

  function installStyles() {
    const style = document.createElement('style');

    style.textContent = `
      body.ns-pages [hidden] {
        display: none !important;
      }

      body.ns-pages .masthead > .nav {
        display: none !important;
      }

      body.ns-pages .masthead > #motion-toggle {
        display: none;
      }

      .ns-page-nav {
        display: flex;
        align-items: center;
        gap: 26px;
        margin-left: auto;
      }

      .ns-page-nav a {
        position: relative;
        display: flex;
        align-items: center;
        min-height: 48px;
        color: #a9b5c1;
        text-decoration: none;
        font-size: 14px;
        white-space: nowrap;
      }

      .ns-page-nav a:hover,
      .ns-page-nav a[aria-current=page] {
        color: #ead7b1;
      }

      .ns-page-nav a[aria-current=page]::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 10%;
        right: 10%;
        height: 1px;
        background: linear-gradient(
          90deg, transparent, #d5bd8d, transparent
        );
      }

      .ns-page-nav a:focus-visible,
      .ns-goal-preview:focus-visible {
        outline: 2px solid #99dce4;
        outline-offset: 5px;
      }

      body.ns-pages .observatory #hero-title {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      body.ns-pages:not([data-northstar-page=overview]) main > .observatory {
        display: none !important;
      }

      body.ns-pages #view-investments > .boot,
      body.ns-pages #pf-root > .pf-grid {
        display: none !important;
      }

      body.ns-pages #pf-root > section,
      body.ns-pages #pf-root > dialog {
        display: none !important;
      }

      body.ns-pages #pf-root > section.ns-visible {
        display: block !important;
      }

      body.ns-pages #view-investments #pf-root > section.ns-visible:not(#goal-section) {
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        padding: 24px 0 36px;
        margin: 0 0 32px;
      }

      body.ns-pages #view-investments #pf-root > section.ns-visible::before {
        display: none;
      }

      body.ns-pages #pf-root > section.ns-visible > .section-coordinate {
        display: none;
      }

      body.ns-pages #view-investments #pf-root > #ledger-dialog {
        box-sizing: border-box;
        position: static;
        width: 100%;
        max-width: none;
        max-height: none;
        padding: 24px 0 36px;
        margin: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        overflow: visible;
      }

      body.ns-pages #view-investments #pf-root #ledger-dialog > section {
        display: block;
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
      }

      body.ns-pages #view-investments #pf-root #ledger-dialog > section::before,
      body.ns-pages #pf-root #ledger-dialog .section-coordinate {
        display: none;
      }

      body.ns-pages #view-investments #pf-root .ns-market-panel .pf-quote {
        border: 0;
        border-radius: 0;
        background: transparent;
        padding: 18px 22px;
        border-left: 1px solid #a4b5c522;
      }

      body.ns-pages #view-investments #pf-root .ns-market-panel .pf-quote:first-child {
        border-left: 0;
        padding-left: 0;
      }

      body.ns-pages #view-investments #pf-root .ns-market-panel .pf-quote span {
        display: block;
        font-size: 12px;
        line-height: 1.8;
      }

      .ns-price-details {
        margin-top: 22px;
        border-top: 1px solid #a4b5c51c;
      }

      body.ns-pages #pf-root .ns-price-details > summary {
        font-size: 14px;
      }

      .ns-market-strip {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 20px 0;
        margin-bottom: 10px;
        color: #a8b8c5;
        border-bottom: 1px solid #a4b5c514;
      }

      .ns-market-copy {
        min-width: 0;
        margin: 0;
        font: 11px/1.9 var(--mono, monospace);
      }

      .ns-market-copy [data-market] {
        margin-right: 12px;
      }

      .ns-market-copy [data-market=open] {
        color: #8ed8b6;
      }

      .ns-market-copy [data-market=closed] {
        color: #d28c8c;
      }

      .ns-market-copy [data-market=unknown] {
        color: #d1bb90;
      }

      .ns-market-strip button {
        flex-shrink: 0;
        min-height: 44px;
        min-width: 44px;
        padding: 8px 12px;
        border: 1px solid #a4b5c52b;
        border-radius: 3px;
        background: transparent;
        color: #bccbd4;
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
      }

      .ns-market-strip button:disabled {
        opacity: .5;
        cursor: wait;
      }

      body.ns-pages[data-northstar-page=overview] .ns-market-strip {
        display: none;
      }

      body.ns-pages main {
        min-height: calc(100dvh - 86px);
      }

      body.ns-pages main > footer {
        margin-top: 44px;
      }

      .ns-goal-preview {
        display: block;
        max-width: 560px;
        margin: 0 auto 36px;
        padding: 24px 0;
        color: #dce5eb;
        text-decoration: none;
        border-top: 1px solid #cdb78c28;
        border-bottom: 1px solid #a4b5c51c;
      }

      .ns-goal-preview header,
      .ns-goal-preview .ns-goal-numbers {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
      }

      .ns-goal-preview h2 {
        margin: 0;
        font: normal 24px/1.3 Georgia, serif;
      }

      .ns-goal-preview header > span {
        color: #ccb68d;
        font-size: 13px;
      }

      .ns-goal-preview .ns-goal-numbers {
        margin: 20px 0 12px;
        flex-wrap: wrap;
      }

      .ns-goal-preview strong {
        font-size: 24px;
        font-weight: 400;
        font-variant-numeric: tabular-nums;
      }

      .ns-goal-preview .ns-goal-progress {
        color: #b6dde2;
        font-size: 16px;
      }

      .ns-goal-preview .ns-goal-track {
        height: 3px;
        background: #a4b5c51c;
        overflow: hidden;
      }

      .ns-goal-preview .ns-goal-track i {
        display: block;
        width: 0;
        height: 100%;
        background: #cdb78c;
      }

      .ns-goal-preview p {
        margin: 12px 0 0;
        color: #9faebb;
        font-size: 13px;
        line-height: 1.7;
      }

      .ns-load-error {
        max-width: 600px;
        margin: 48px auto;
        padding: 20px;
        color: #e4d3b1;
        font-size: 15px;
        line-height: 1.8;
      }

      @media (max-width: 850px) {
        .ns-page-nav {
          gap: 18px;
        }

        .ns-page-nav a {
          font-size: 13px;
        }
      }

      @media (max-width: 620px) {
        .ns-page-nav {
          position: fixed;
          z-index: 30;
          bottom: 0;
          left: 0;
          right: 0;
          margin: 0;
          padding: 6px 18px calc(6px + env(safe-area-inset-bottom));
          gap: 24px;
          overflow-x: auto;
          background: #070b11f7;
          border-top: 1px solid #a4b5c522;
        }

        .ns-page-nav a {
          min-height: 48px;
          font-size: 13px;
        }

        body.ns-pages main {
          padding-bottom: calc(80px + env(safe-area-inset-bottom));
        }

        .ns-market-strip {
          align-items: flex-start;
          padding-top: 16px;
        }

        .ns-market-copy {
          font-size: 10px;
        }

        body.ns-pages #view-investments #pf-root .ns-market-panel .pf-quote {
          padding: 18px 0;
          border-left: 0;
          border-bottom: 1px solid #a4b5c51c;
        }

        .ns-goal-preview {
          margin-bottom: 24px;
        }
      }
    `;

    document.head.append(style);
  }

  function installNavigation() {
    const header = document.querySelector('.masthead');

    if (!header || header.querySelector('.ns-page-nav')) return;

    const old = header.querySelector('.nav');

    if (old) {
      old.hidden = true;
      old.inert = true;
      old.setAttribute('aria-hidden', 'true');
    }

    const nav = document.createElement('nav');
    nav.className = 'ns-page-nav';
    nav.setAttribute('aria-label', 'Main navigation');

    pages.forEach(([key, label, file]) => {
      const link = document.createElement('a');
      link.href = './' + file;
      link.textContent = label;

      if (key === current) {
        link.setAttribute('aria-current', 'page');
      }

      nav.append(link);
    });

    header.append(nav);

    document.querySelectorAll('.identity').forEach(link => {
      link.href = './index.html';
    });
  }

  function installMarketStatus() {
    const source = get('hero-date');
    const originalRefresh = get('refresh');
    const strip = get('ns-market-strip');

    if (!source || !originalRefresh || !strip) return;

    const copy = strip.querySelector('p');
    const button = strip.querySelector('button');

    function sync() {
      const status = get('northstar-market-status');

      const nodes = [...source.childNodes]
        .map(node => node.cloneNode(true));

      if (status) {
        nodes.unshift(
          status.cloneNode(true),
          document.createTextNode(' ')
        );
      }

      copy.replaceChildren(...nodes);

      copy.querySelectorAll('[id]').forEach(node => {
        node.removeAttribute('id');
      });

      button.disabled = originalRefresh.disabled;
    }

    new MutationObserver(sync).observe(
      source.closest('.data-status') || source,
      {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true
      }
    );

    new MutationObserver(sync).observe(originalRefresh, {
      attributes: true,
      attributeFilter: ['disabled']
    });

    button.addEventListener('click', () => {
      originalRefresh.click();
    });

    sync();
  }

  function installGoalPreview() {
    if (current !== 'overview') return;

    const goal = get('goal-section');
    if (!goal) return;

    const preview = document.createElement('a');
    preview.className = 'ns-goal-preview';
    preview.href = './goal.html';

    preview.innerHTML = `
      <header>
        <h2>Your goal</h2>
        <span>Explore ↗</span>
      </header>

      <div class="ns-goal-numbers">
        <strong>—</strong>
        <span class="ns-goal-progress">—</span>
      </div>

      <div class="ns-goal-track" aria-hidden="true">
        <i></i>
      </div>

      <p>Waiting for portfolio data.</p>
    `;

    get('view-investments').before(preview);

    const target = preview.querySelector('strong');
    const percent = preview.querySelector('.ns-goal-progress');
    const bar = preview.querySelector('i');
    const note = preview.querySelector('p');

    function sync() {
      target.textContent =
        get('goal-target')?.textContent || '—';

      const value = get('goal-percent')?.textContent || '—';

      percent.textContent = value === '—'
        ? '—'
        : value + ' of target';

      const raw = get('goal-track')
        ?.getAttribute('aria-valuenow');

      const amount = raw === null ? NaN : Number(raw);

      bar.style.width = Number.isFinite(amount)
        ? Math.max(0, Math.min(100, amount)) + '%'
        : '0%';

      const warning = get('goal-warning');
      const storage = get('goal-storage')
        ?.textContent?.trim();

      note.textContent = warning && !warning.hidden
        ? warning.textContent
        : storage ||
          (get('goal-remaining')?.textContent || '—') +
          ' remaining';
    }

    new MutationObserver(sync).observe(goal, {
      childList: true,
      characterData: true,
      attributes: true,
      subtree: true
    });

    sync();
  }

  function connectPage() {
    if (connected) return;

    const root = get('pf-root');
    if (!root) return;

    connected = true;

    const performance = get('pf-chart')?.closest('section');
    const holdings = get('pf-holdings')?.closest('section');
    const ledger = get('pf-trades')?.closest('section');
    const prices = get('pf-prices')?.closest('section');
    const goal = get('goal-section');

    let ledgerPage;

    if (ledger) {
      const oldDialog = get('ledger-dialog');

      ledgerPage = document.createElement('div');
      ledgerPage.id = 'ledger-dialog';

      if (oldDialog) {
        oldDialog.replaceWith(ledgerPage);
      } else {
        root.append(ledgerPage);
      }

      ledgerPage.append(ledger);
      ledgerPage.hidden = current !== 'ledger';

      const title = ledger.querySelector('h2');
      if (title) title.textContent = 'Ledger';
    }

    [...root.children].forEach(node => {
      if (node.tagName === 'SECTION') {
        node.hidden = true;
        node.classList.remove('ns-visible');
      }
    });

    const views = {
      performance,
      goal,
      holdings,
      ledger
    };

    const selected = views[current];

    if (selected) {
      selected.hidden = false;

      if (current !== 'ledger') {
        selected.classList.add('ns-visible');
      }

      const heading = selected.querySelector('h2');

      if (heading) {
        heading.setAttribute('role', 'heading');
        heading.setAttribute('aria-level', '1');
      }
    }

    if (holdings && prices) {
      root.append(holdings, prices);

      prices.hidden = current !== 'holdings';

      if (current === 'holdings') {
        prices.classList.add('ns-visible');
      }

      prices.classList.add('ns-market-panel');

      const title = prices.querySelector('h2');
      if (title) title.textContent = 'Market prices';

      const explanation = prices.querySelector(
        ':scope > .pf-sub:last-child'
      );

      if (explanation && explanation.id !== 'pf-feed') {
        const details = document.createElement('details');
        details.className = 'ns-price-details';

        const summary = document.createElement('summary');
        summary.textContent = 'Price details';

        explanation.before(details);
        details.append(summary, explanation);
      }
    }

    const skip = document.querySelector('.skip');

    if (skip) {
      const targets = {
        overview: 'hero-title',
        performance: 'pf-chart',
        goal: 'goal-section',
        holdings: 'pf-holdings',
        ledger: 'ledger-dialog'
      };

      skip.href = '#' + targets[current];
      skip.textContent = 'Skip to ' + current;
    }

    installMarketStatus();
    installGoalPreview();

    document.body.classList.add('ns-page-ready');

    requestAnimationFrame(() => {
      dispatchEvent(new Event('resize'));
    });
  }

  function mountShell() {
    document.body.innerHTML = `
      <a class="skip" href="#view-investments">
        Skip to portfolio
      </a>

      <header class="masthead" id="top">
        <a
          class="identity"
          href="./index.html"
          aria-label="Northstar overview"
        >
          <img
            src="./assets/northstar-mark.svg"
            width="38"
            height="38"
            alt=""
          >
          <span>
            NORTHSTAR
            <small>WEALTH OBSERVATORY</small>
          </span>
        </a>

        <nav
          class="nav"
          aria-label="Portfolio sections"
          hidden
          inert
        >
          <span class="nav-beacon" aria-hidden="true"></span>
          <a class="active" href="#top">Overview</a>
          <a href="#pf-chart">Performance</a>
          <a href="#pf-holdings">Holdings</a>
          <a href="#pf-trades">Ledger</a>
        </nav>

        <button
          class="motion-toggle"
          id="motion-toggle"
          type="button"
          aria-pressed="false"
          aria-label="Pause ambient motion"
        >
          Motion <span>ON</span>
        </button>
      </header>

      <main id="ns-main">
        <div class="ns-market-strip" id="ns-market-strip">
          <p class="ns-market-copy">
            Connecting to market data…
          </p>

          <button
            type="button"
            aria-label="Refresh market prices"
          >
            Refresh ↻
          </button>
        </div>

        <section
          class="observatory"
          aria-labelledby="hero-title"
        >
          <div class="hero-copy">
            <h1 id="hero-title">Portfolio overview</h1>

            <div class="hero-valuation">
              <span class="label">
                PORTFOLIO VALUE
                <span class="unit">EUR</span>
              </span>

              <strong id="hero-value">—</strong>

              <div id="hero-pl" class="hero-pl">
                Awaiting your portfolio
              </div>
            </div>

            <div
              class="hero-facts"
              aria-label="Portfolio context"
            >
              <div>
                <span>CONTRIBUTED</span>
                <strong id="core-contributed">—</strong>
              </div>

              <div>
                <span>WORLD / EMERGING</span>
                <strong id="core-allocation">—</strong>
              </div>
            </div>

            <div class="hero-actions">
              <button
                class="primary-link"
                id="explore-core"
                type="button"
                aria-haspopup="dialog"
                aria-controls="core-dialog"
              >
                Portfolio in focus
              </button>

              <a class="quiet-link" href="#pf-trades">
                Portfolio ledger →
              </a>
            </div>

            <div class="data-status">
              <span class="status-dot"></span>

              <span id="hero-date">
                CONNECTING TO MARKET DATA
              </span>

              <button
                id="refresh"
                type="button"
                aria-label="Refresh market data"
              >↻</button>
            </div>
          </div>

          <div
            class="instrument"
            id="instrument"
            role="region"
            aria-label="Northstar celestial instrument"
          >
            <div class="core-space">
              <canvas
                id="celestial-core"
                aria-hidden="true"
              ></canvas>

              <div
                class="core-tilt"
                id="core-tilt"
                aria-hidden="true"
              >
                <svg viewBox="0 0 500 500">
                  <g id="precision-ticks"></g>
                </svg>
              </div>
            </div>

            <div class="instrument-footer">
              <span id="core-state">ACQUIRING DATA</span>
            </div>
          </div>
        </section>

        <section
          id="view-investments"
          aria-label="Portfolio"
        >
          <p class="boot">Loading portfolio…</p>
        </section>

        <footer>
          <a
            class="identity footer-identity"
            href="./index.html"
          >
            NORTHSTAR <span>✧</span>
          </a>

          <p>
            Perspective, without speculation.<br>
            Delayed market prices · private browser storage ·
            no brokerage connection.
          </p>
        </footer>
      </main>

      <dialog
        id="core-dialog"
        aria-labelledby="map-title"
        aria-describedby="map-help"
      >
        <div class="map-heading">
          <div>
            <span class="eyebrow">
              NORTHSTAR / PORTFOLIO
            </span>
            <h2 id="map-title">Your portfolio, in focus.</h2>
          </div>

          <button
            id="close-core"
            type="button"
            autofocus
            aria-label="Close portfolio in focus"
          >
            Close ×
          </button>
        </div>

        <p id="map-help">
          Actual holdings and allocation.
        </p>

        <div class="map-layout">
          <canvas
            id="celestial-map"
            aria-hidden="true"
          ></canvas>

          <div class="map-information">
            <span class="eyebrow">SELECT A REFERENCE</span>

            <div
              class="asset-selector"
              role="group"
              aria-label="Asset details"
            >
              <button
                type="button"
                data-asset="VWCE"
                aria-pressed="true"
              >
                VWCE <small>WORLD</small>
              </button>

              <button
                type="button"
                data-asset="VFEA"
                aria-pressed="false"
              >
                VFEA <small>EMERGING</small>
              </button>

              <button
                type="button"
                data-asset="SXR8"
                aria-pressed="false"
              >
                SXR8 <small>BENCHMARK ONLY</small>
              </button>
            </div>

            <div
              id="asset-detail"
              aria-live="polite"
            ></div>

            <p class="map-privacy">
              PRIVATE BY DESIGN<br>
              Purchases stay in this browser.
              No brokerage connection.
            </p>
          </div>
        </div>

        <div class="map-bottom">
          <span>Private browser storage</span>
          <button id="reset-core" type="button">Reset</button>
        </div>
      </dialog>
    `;
  }

  function loadScript(file) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');

      script.src = './js/' + file + '?v=' + version;
      script.async = false;
      script.onload = resolve;

      script.onerror = () => {
        reject(new Error('Unable to load ' + file));
      };

      document.head.append(script);
    });
  }

  async function start() {
    document.body.classList.add('ns-pages');
    installStyles();

    if (current === 'xray') {
      installNavigation();

      const motion = get('motion-toggle');
      const footer = document.querySelector('.xray-footer');

      if (motion && footer) footer.append(motion);

      return;
    }

    mountShell();
    installNavigation();

    document.title =
      pages.find(([key]) => key === current)[1] +
      ' — NORTHSTAR';

    document.addEventListener('northstar:ready', () => {
      queueMicrotask(connectPage);
    }, { once: true });

    try {
      for (const file of [
        'finance-utils.js',
        'observatory.js',
        'celestial.js',
        'goal.js',
        'portfolio-observatory.js'
      ]) {
        await loadScript(file);
      }
    } catch (error) {
      console.error('NORTHSTAR page load failed.', error);

      const notice = document.createElement('p');
      notice.className = 'ns-load-error';
      notice.setAttribute('role', 'alert');

      notice.textContent =
        'This page could not finish loading. ' +
        'Reload to try again. ' +
        'Your saved purchases have not been changed.';

      get('ns-main').prepend(notice);
    }
  }

  start();
})();
