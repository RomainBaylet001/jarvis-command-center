/*
  NORTHSTAR / portfolio goal.
  Reads engine summaries. Saves only the separate goal setting.
*/

(() => {
  'use strict';

  const KEY = 'northstar-goal-v1';
  const LIMIT = 1000000000000;

  const money = value => new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2
  }).format(value);

  const percent = value => new Intl.NumberFormat('en-IE', {
    maximumFractionDigits: 2
  }).format(value) + '%';

  const validTarget = value =>
    Number.isFinite(value) &&
    value > 0 &&
    value <= LIMIT;

  const calculate = (value, target) => ({
    percent: value / target * 100,
    remaining: Math.max(0, target - value),
    bar: Math.max(0, Math.min(100, value / target * 100))
  });

  const nav = document.querySelector('.nav');

  if (!nav || document.getElementById('goal-section')) return;

  let target = 1000000;
  let summary = null;
  let targetKind = 'Example target';

  let storageNote =
    'Example target · choose Edit goal to save your own.';

  try {
    const raw = localStorage.getItem(KEY);

    if (raw !== null) {
      const saved = JSON.parse(raw);

      if (
        saved?.version === 1 &&
        validTarget(saved.target)
      ) {
        target = saved.target;
        targetKind = 'Your target';
        storageNote = '';
      } else {
        storageNote =
          'Saved goal could not be read. ' +
          'The example below has not replaced it.';
      }
    }
  } catch {
    storageNote =
      'Goal could not be loaded. ' +
      'The example below is for this visit.';
  }

  const style = document.createElement('style');

  style.textContent = `
    body.goal-enabled #view-investments #pf-root > .pf-grid,
    body.goal-enabled main > .section-divider {
      display: none;
    }

    .nav .goal-nav {
      appearance: none;
      display: flex;
      align-items: center;
      gap: 8px;
      height: 100%;
      min-height: 44px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      color: #9daab8;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
    }

    .nav .goal-nav > span {
      font: 8px var(--mono);
      color: #60748b;
    }

    .nav .goal-nav:hover,
    .nav .goal-nav[aria-expanded=true] {
      color: #ebdec5;
    }

    #goal-section {
      box-sizing: border-box;
      width: 100%;
      padding: 32px;
      border: 1px solid #bcac8150;
      border-radius: 4px;
      background: #0c121c;
      color: #edf0f3;
      scroll-margin-top: 106px;
    }

    body.goal-enabled #goal-section h2 {
      font: normal clamp(27px, 2.6vw, 34px)/1.2 Georgia, serif;
      letter-spacing: -.025em;
      margin: 0;
    }

    body.goal-enabled #goal-section .goal-description {
      color: #aebdcc;
      font-size: 15px;
      line-height: 1.8;
      margin: 14px 0 28px;
      max-width: 60ch;
    }

    body.goal-enabled #goal-section .goal-overview {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 220px;
      align-items: center;
      gap: 32px;
    }

    body.goal-enabled #goal-section .goal-kicker {
      display: block;
      color: #acbbc9;
      font: 12px/1.8 var(--mono);
      letter-spacing: .035em;
    }

    body.goal-enabled #goal-section .goal-target {
      display: block;
      margin: 12px 0 28px;
      font-size: clamp(32px, 4vw, 48px);
      font-weight: 350;
      line-height: 1.2;
      letter-spacing: -.045em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    body.goal-enabled #goal-section .goal-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px 32px;
      margin: 0;
    }

    body.goal-enabled #goal-section .goal-metrics dt {
      color: #aebdcc;
      font-size: 14px;
      margin-bottom: 10px;
    }

    body.goal-enabled #goal-section .goal-metrics dd {
      margin: 0;
      font-size: clamp(21px, 2.4vw, 29px);
      line-height: 1.3;
      letter-spacing: -.025em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    body.goal-enabled #goal-section .goal-dial {
      position: relative;
      width: 220px;
      height: 220px;
      display: grid;
      place-items: center;
      justify-self: center;
    }

    .goal-dial svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      fill: none;
      pointer-events: none;
    }

    .goal-dial .goal-dial-guide {
      stroke: #a4b5c51a;
      stroke-width: .6;
    }

    .goal-dial .goal-dial-track {
      stroke: #273541;
      stroke-width: 4;
    }

    .goal-dial .goal-dial-progress {
      stroke: #99dce4;
      stroke-width: 4;
      stroke-linecap: butt;
      transform: rotate(-90deg);
      transform-origin: 100px 100px;
    }

    body.goal-enabled #goal-section .goal-dial-label {
      position: relative;
      display: grid;
      gap: 8px;
      text-align: center;
      max-width: 150px;
    }

    body.goal-enabled #goal-section #goal-percent {
      color: #b1e3e7;
      font-size: 32px;
      font-weight: 350;
      letter-spacing: -.04em;
      font-variant-numeric: tabular-nums;
    }

    body.goal-enabled #goal-section #goal-progress-label {
      color: #aebdcc;
      font-size: 13px;
      line-height: 1.6;
    }

    body.goal-enabled #goal-section .goal-market {
      color: #a6b8c8;
      font: 12px/1.8 var(--mono);
      margin: 26px 0 0;
      overflow-wrap: anywhere;
      letter-spacing: .015em;
    }

    #goal-section .goal-market[data-warning=true] {
      color: #dec18d;
    }

    body.goal-enabled #goal-section .goal-storage {
      color: #cbb78f;
      font-size: 13px;
      line-height: 1.8;
      margin: 12px 0 0;
    }

    #goal-section .goal-storage:empty {
      display: none;
    }

    #goal-section .goal-editor {
      margin-top: 24px;
      border-top: 1px solid #a4b5c522;
    }

    #goal-section .goal-editor > summary {
      display: flex;
      align-items: center;
      gap: 16px;
      min-height: 48px;
      padding: 14px 0;
      list-style: none;
      color: #e1d6c0;
      font-size: 14px;
      cursor: pointer;
    }

    #goal-section .goal-editor > summary::-webkit-details-marker {
      display: none;
    }

    #goal-section .goal-editor > summary::after {
      content: "+";
      margin-left: auto;
      color: #cdb78c;
      font-size: 20px;
    }

    #goal-section .goal-editor[open] > summary::after {
      content: "−";
    }

    body.goal-enabled #goal-section form {
      max-width: 620px;
      padding: 8px 0 20px;
      border: 0;
    }

    body.goal-enabled #goal-section label {
      display: block;
      font-size: 14px;
      color: #d9e2e9;
      margin-bottom: 10px;
    }

    #goal-section .goal-form-row {
      display: flex;
      gap: 12px;
    }

    #goal-section input {
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
      min-height: 48px;
      border: 1px solid #a4b5c540;
      border-radius: 3px;
      padding: 10px 14px;
      background: #080f18;
      color: #edf0f3;
      font-family: inherit;
      font-size: 18px;
    }

    #goal-section .goal-save {
      min-height: 48px;
      padding: 10px 20px;
      white-space: nowrap;
      border: 1px solid #dccba5;
      border-radius: 3px;
      background: #d9c7a1;
      color: #151a1d;
      cursor: pointer;
      font-family: inherit;
    }

    #goal-section .goal-save:hover {
      background: #e8d9b9;
    }

    body.goal-enabled #goal-section .goal-footnote {
      border: 0;
      margin: 16px 0 0;
      padding: 0;
      color: #a6b5c4;
      font-size: 13px;
      line-height: 1.85;
      max-width: 80ch;
    }

    #goal-section :focus-visible,
    .nav .goal-nav:focus-visible {
      outline: 2px solid #99dce4;
      outline-offset: 4px;
    }

    footer .motion-toggle {
      flex-shrink: 0;
    }

    #view-investments #pf-root #goal-section {
      scroll-margin-top: 106px;
    }

    /* Existing ledger layout and controls. */

    #ledger-dialog {
      width: min(1080px, 95vw);
      max-height: 90dvh;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 25px;
      border: 1px solid #bcac8150;
      border-radius: 6px;
      background: #0c121c;
      color: #edf0f3;
      box-shadow: 0 35px 100px #0009;
    }

    #ledger-dialog::backdrop {
      background: #020509d9;
      backdrop-filter: blur(7px);
    }

    body:has(#ledger-dialog[open]) {
      overflow: hidden;
    }

    #ledger-dialog .ledger-dialog-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
    }

    #ledger-dialog button {
      min-height: 44px;
    }

    #view-investments #pf-root #ledger-dialog > .pf-panel {
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      box-shadow: none;
      animation: none;
      transform: none;
      opacity: 1;
    }

    #view-investments #pf-root #ledger-dialog > .pf-panel:before {
      display: none;
    }

    #ledger-dialog .pf-table {
      max-width: 100%;
      overflow-x: auto;
    }

    #ledger-dialog :focus-visible {
      outline: 2px solid #99dce4;
      outline-offset: 4px;
    }

    @media (max-width: 1100px) {
      .nav .goal-nav > span {
        display: none;
      }
    }

    @media (max-width: 850px) {
      .nav .goal-nav {
        font-size: 11px;
      }
    }

    @media (max-width: 700px) {
      body.goal-enabled #goal-section .goal-overview {
        grid-template-columns: minmax(0, 1fr) 170px;
        gap: 20px;
      }

      body.goal-enabled #goal-section .goal-dial {
        width: 170px;
        height: 170px;
      }

      body.goal-enabled #goal-section .goal-dial-label {
        max-width: 120px;
      }

      body.goal-enabled #goal-section #goal-percent {
        font-size: 27px;
      }

      body.goal-enabled #goal-section .goal-metrics {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 620px) {
      #ledger-dialog {
        padding: 20px;
        max-height: 92dvh;
      }

      .nav .goal-nav {
        font-size: 10px;
      }

      .nav .goal-nav > span {
        display: block;
        font-size: 7px;
      }

      #goal-section {
        padding: 23px;
      }

      #goal-section .goal-form-row {
        flex-wrap: wrap;
      }

      #goal-section .goal-save {
        width: 100%;
      }
    }

    @media (max-width: 420px) {
      body.goal-enabled #goal-section .goal-overview {
        grid-template-columns: 1fr;
      }

      body.goal-enabled #goal-section .goal-dial {
        width: 180px;
        height: 180px;
      }

      body.goal-enabled #goal-section .goal-metrics {
        grid-template-columns: 1fr;
        gap: 20px;
      }
    }
  `;

  document.head.append(style);

  const trigger = document.createElement('a');

  trigger.href = '#goal-section';
  trigger.innerHTML = '<span>03</span> Goal';

  nav.querySelector(
    'a[href="#pf-chart"]'
  )?.after(trigger);

  const holdingsLink = nav.querySelector(
    'a[href="#pf-holdings"]'
  );

  if (holdingsLink) {
    holdingsLink.innerHTML = '<span>04</span> Holdings';
  }

  const ledgerButton = document.createElement('button');

  ledgerButton.type = 'button';
  ledgerButton.className = 'goal-nav';

  ledgerButton.innerHTML =
    '<span aria-hidden="true">05</span> Ledger';

  ledgerButton.setAttribute('aria-haspopup', 'dialog');
  ledgerButton.setAttribute('aria-controls', 'ledger-dialog');
  ledgerButton.setAttribute('aria-expanded', 'false');

  ledgerButton.disabled = true;

  const oldLedgerLink = nav.querySelector(
    'a[href="#pf-trades"]'
  );

  if (oldLedgerLink) {
    oldLedgerLink.replaceWith(ledgerButton);
  } else {
    nav.append(ledgerButton);
  }

  const dialog = document.createElement('section');

  dialog.className = 'pf-panel';
  dialog.id = 'goal-section';

  dialog.setAttribute('aria-labelledby', 'goal-title');
  dialog.setAttribute('aria-describedby', 'goal-help');

  dialog.innerHTML = `
    <div class="goal-heading">
      <h2 id="goal-title">Goal</h2>
    </div>

    <p id="goal-help" class="goal-description">
      Progress towards your portfolio target.
    </p>

    <div class="goal-overview">
      <div>
        <span class="goal-kicker">
          <span id="goal-kind">Example target</span> / EUR
        </span>

        <strong class="goal-target" id="goal-target">—</strong>

        <dl class="goal-metrics">
          <div>
            <dt>Portfolio value</dt>
            <dd id="goal-current">—</dd>
          </div>

          <div>
            <dt>Remaining</dt>
            <dd id="goal-remaining">—</dd>
          </div>
        </dl>
      </div>

      <div
        class="goal-dial"
        id="goal-track"
        role="progressbar"
        aria-label="Progress towards portfolio target"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle
            class="goal-dial-guide"
            cx="100"
            cy="100"
            r="95"
          />

          <circle
            class="goal-dial-track"
            cx="100"
            cy="100"
            r="82"
          />

          <circle
            class="goal-dial-progress"
            id="goal-arc"
            cx="100"
            cy="100"
            r="82"
            pathLength="100"
            stroke-dasharray="0 100"
          />
        </svg>

        <div class="goal-dial-label" aria-hidden="true">
          <strong id="goal-percent">—</strong>
          <span id="goal-progress-label">Awaiting valuation</span>
        </div>
      </div>
    </div>

    <p class="goal-market" id="goal-market">
      Waiting for portfolio data.
    </p>

    <p class="goal-storage" id="goal-storage" role="status"></p>

    <details class="goal-editor" id="goal-editor">
      <summary>Edit goal</summary>

      <form id="goal-form">
        <label for="goal-input">Your target in euros</label>

        <div class="goal-form-row">
          <input
            id="goal-input"
            name="target"
            type="number"
            inputmode="decimal"
            min="0.01"
            max="1000000000000"
            step="0.01"
            required
            aria-describedby="goal-storage"
          >

          <button class="goal-save" type="submit">
            Save goal
          </button>
        </div>
      </form>
    </details>

    <p class="goal-footnote">
      Based on portfolio market value, not a forecast. Progress can fall.
      SXR8 is excluded. Target is in nominal euros, before inflation.
    </p>
  `;

  document.querySelector(
    '#view-investments'
  ).after(dialog);

  const get = id => dialog.querySelector('#' + id);
  const input = get('goal-input');

  input.value = String(target);

  function priceLabel() {
    const quotes = ['VWCE', 'VFEA']
      .filter(asset =>
        summary?.rows?.[asset]?.shares > 0
      )
      .map(asset => summary.rows[asset].quote)
      .filter(Boolean);

    if (!quotes.length) {
      return summary?.date
        ? 'Price snapshot / ' + summary.date
        : 'Price date unavailable';
    }

    const oldest = [...quotes].sort((a, b) =>
      (a.asOf || a.date || '').localeCompare(
        b.asOf || b.date || ''
      )
    )[0];

    const label = quotes.every(q => q.type === 'delayed')
      ? 'Delayed quotes'
      : quotes.every(q => q.type === 'closing')
        ? 'Daily close'
        : quotes.every(q => q.type === 'manual')
          ? 'Manual snapshot'
          : 'Price snapshots';

    const timestamp = Date.parse(oldest.asOf);

    const time = Number.isFinite(timestamp)
      ? ' ' + new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Berlin',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date(timestamp)) + ' Berlin'
      : '';

    return (
      label + ' / ' +
      (oldest.date || 'date unavailable') +
      time
    );
  }

  function render() {
    get('goal-target').textContent = money(target);
    get('goal-kind').textContent = targetKind;
    get('goal-storage').textContent = storageNote;

    const value = summary?.value;
    const known = Number.isFinite(value) && value >= 0;
    const track = get('goal-track');

    get('goal-current').textContent =
      known ? money(value) : '—';

    if (known) {
      const progress = calculate(value, target);

      get('goal-percent').textContent =
        percent(progress.percent);

      get('goal-remaining').textContent =
        money(progress.remaining);

      get('goal-progress-label').textContent =
        value >= target
          ? 'Target reached at this valuation'
          : 'of your target';

      track.setAttribute(
        'aria-valuenow',
        String(progress.bar)
      );

      track.setAttribute(
        'aria-valuetext',
        percent(progress.percent) +
        ' of target; ' +
        money(progress.remaining) +
        ' remaining'
      );

      get('goal-arc').setAttribute(
        'stroke-dasharray',
        progress.bar + ' 100'
      );
    } else {
      get('goal-percent').textContent = '—';
      get('goal-remaining').textContent = '—';

      get('goal-progress-label').textContent = summary
        ? 'Valuation unavailable'
        : 'Awaiting valuation';

      track.removeAttribute('aria-valuenow');

      track.setAttribute(
        'aria-valuetext',
        'Portfolio valuation unavailable'
      );

      get('goal-arc').setAttribute(
        'stroke-dasharray',
        '0 100'
      );
    }

    const market = get('goal-market');

    const age = summary?.date
      ? Date.now() - Date.parse(
          summary.date + 'T12:00:00Z'
        )
      : NaN;

    const warning = !!summary && (
      !known ||
      summary.status === 'warning' ||
      age > 5 * 86400000
    );

    market.dataset.warning = String(warning);

    if (!summary) {
      market.textContent = 'Waiting for portfolio data.';
    } else if (!known) {
      market.textContent =
        'Valuation unavailable. Progress will resume ' +
        'when prices are available.';
    } else if (!summary.count) {
      market.textContent =
        'Add purchases in Ledger to start tracking.';
    } else {
      market.textContent = priceLabel() + (
        warning
          ? ' · Price warning — check market data'
          : ''
      );
    }
  }

  get('goal-form').addEventListener('submit', event => {
    event.preventDefault();

    const next = input.valueAsNumber;

    if (
      !input.reportValidity() ||
      !validTarget(next)
    ) return;

    target = next;

    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          target
        })
      );

      targetKind = 'Your target';
      storageNote = 'Goal saved in this browser.';
    } catch {
      targetKind = 'Target for this visit';

      storageNote =
        'Goal applied for this visit. ' +
        'Browser storage could not save it.';
    }

    render();
  });

  // Preserve the existing section and Ledger connections.

  document.addEventListener('northstar:ready', () => {
    const chart = document.getElementById('pf-chart')
      ?.closest('section');

    const ledger = document.getElementById('pf-trades')
      ?.closest('section');

    const root = document.getElementById('pf-root');

    if (chart) chart.after(dialog);

    [
      [chart, '02 / PERFORMANCE'],
      [dialog, '03 / GOAL'],
      [
        document.getElementById('pf-holdings')
          ?.closest('section'),
        '04 / HOLDINGS'
      ]
    ].forEach(([section, title]) => {
      if (!section) return;

      let label = section.querySelector(
        '.section-coordinate'
      );

      if (!label) {
        label = document.createElement('div');
        label.className = 'section-coordinate';
        section.prepend(label);
      }

      label.textContent = title;
    });

    if (!ledger || !root) return;

    const ledgerDialog = document.createElement('dialog');

    ledgerDialog.id = 'ledger-dialog';

    ledgerDialog.setAttribute(
      'aria-labelledby',
      'ledger-title'
    );

    const title = ledger.querySelector('h2');

    if (title) title.id = 'ledger-title';

    const heading = document.createElement('div');

    heading.className = 'ledger-dialog-heading';

    heading.innerHTML =
      '<span class="eyebrow">' +
      'NORTHSTAR / PRIVATE LEDGER' +
      '</span>';

    const close = document.createElement('button');

    close.type = 'button';
    close.textContent = 'Close ×';

    close.setAttribute(
      'aria-label',
      'Close transaction history'
    );

    close.setAttribute('autofocus', '');

    heading.append(close);
    ledgerDialog.append(heading, ledger);
    root.append(ledgerDialog);

    function openLedger() {
      if (!ledgerDialog.open) {
        ledgerDialog.showModal();
      }

      ledgerButton.setAttribute(
        'aria-expanded', 'true'
      );
    }

    ledgerButton.disabled = false;

    ledgerButton.addEventListener(
      'click', openLedger
    );

    close.addEventListener('click', () => {
      ledgerDialog.close();
    });

    ledgerDialog.addEventListener('close', () => {
      ledgerButton.setAttribute(
        'aria-expanded', 'false'
      );

      ledgerButton.focus({
        preventScroll: true
      });
    });

    document.addEventListener('click', event => {
      const link = event.target.closest?.(
        'a[href="#pf-trades"]'
      );

      if (
        !link ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) return;

      event.preventDefault();
      openLedger();
    });

    const followLedgerHash = () => {
      if (location.hash === '#pf-trades') {
        openLedger();
      }
    };

    addEventListener(
      'hashchange', followLedgerHash
    );

    requestAnimationFrame(() => {
      followLedgerHash();
      dispatchEvent(new Event('scroll'));
    });
  }, { once: true });

  document.addEventListener('northstar:summary', event => {
    summary = event.detail;
    render();
  });

  const motion = document.getElementById('motion-toggle');
  const footer = document.querySelector('main > footer');

  if (motion && footer) {
    footer.append(motion);
  }

  document.querySelector(
    '.hero-actions .quiet-link[href="#pf-trades"]'
  )?.remove();

  document.body.classList.add('goal-enabled');

  render();
})();
