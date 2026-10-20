/*
  NORTHSTAR / ember galaxy goal.
  Reads portfolio summaries.
  Saves only the separate goal setting.
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

  const targetMoney = value => new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
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

      if (saved?.version === 1 && validTarget(saved.target)) {
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
      color: #edf0f3;
      scroll-margin-top: 106px;
    }

    body.goal-enabled #view-investments #pf-root > #goal-section.goal-observatory {
      display: block;
      text-align: center;
      padding: 32px 24px;
      margin: 0 0 32px;
      border: 0;
      background: transparent;
      box-shadow: none;
    }

    body.goal-enabled #view-investments #pf-root > #goal-section.goal-observatory::before {
      display: none;
    }

    body.goal-enabled #view-investments #pf-root #goal-section h2 {
      margin: 0;
      font: normal 26px/1.2 Georgia, serif;
      letter-spacing: -.025em;
    }

    body.goal-enabled #goal-section .goal-overview {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0;
      max-width: 920px;
      margin: 0 auto;
    }

    body.goal-enabled #goal-section .goal-dial.goal-galaxy {
      position: relative;
      width: 100%;
      height: clamp(340px, 43vw, 500px);
      display: grid;
      place-items: center;
      margin: 12px auto 0;
      isolation: isolate;
    }

    #goal-section .goal-dial.goal-galaxy::before {
      display: none;
    }

    #goal-section .goal-galaxy-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
    }

    #goal-section .goal-dial.goal-galaxy > svg {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 270px;
      height: 270px;
      transform: translate(-50%, -50%);
      fill: none;
      overflow: visible;
      pointer-events: none;
      z-index: 1;
    }

    #goal-section .goal-dial-track {
      stroke: #8194a32b;
      stroke-width: 2;
    }

    #goal-section .goal-dial-progress {
      stroke: #99dce4;
      stroke-width: 2.6;
      stroke-linecap: butt;
      transform: rotate(-90deg);
      transform-origin: 100px 100px;
    }

    body.goal-enabled #goal-section .goal-dial.goal-galaxy .goal-dial-label {
      box-sizing: border-box;
      position: relative;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 7px;
      width: 180px;
      max-width: 180px;
      min-height: 145px;
      padding: 16px;
      border-radius: 50%;
      text-align: center;
      pointer-events: none;
      z-index: 2;
      background: radial-gradient(
        circle,
        #070b11e6 20%,
        #070b1180 55%,
        transparent 72%
      );
    }

    body.goal-enabled #goal-section #goal-percent {
      color: #b9e4e8;
      font-size: 38px;
      font-weight: 350;
      letter-spacing: -.035em;
      font-variant-numeric: tabular-nums;
    }

    body.goal-enabled #goal-section #goal-progress-label {
      color: #aebdcc;
      font-size: 12px;
      line-height: 1.5;
    }

    body.goal-enabled #goal-section .goal-kicker {
      display: block;
      color: #aab9c8;
      font: 11px/1.8 var(--mono);
      letter-spacing: .04em;
    }

    body.goal-enabled #goal-section .goal-target {
      display: block;
      margin: 6px 0 10px;
      color: #edf0f3;
      font-size: clamp(32px, 3.4vw, 44px);
      font-weight: 350;
      line-height: 1.2;
      letter-spacing: -.04em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    body.goal-enabled #goal-section .goal-remaining-line {
      margin: 0;
      color: #aebdcc;
      font-size: 15px;
      line-height: 1.8;
    }

    body.goal-enabled #goal-section #goal-remaining {
      color: #d6dfe6;
      font-weight: 400;
      font-variant-numeric: tabular-nums;
    }

    body.goal-enabled #goal-section .goal-warning,
    body.goal-enabled #goal-section .goal-storage {
      color: #d1bb90;
      font-size: 13px;
      line-height: 1.8;
      margin: 16px auto 0;
      max-width: 60ch;
    }

    #goal-section .goal-warning[hidden],
    #goal-section .goal-storage:empty {
      display: none;
    }

    body.goal-enabled #goal-section .goal-editor {
      margin: 24px auto 0;
      max-width: 480px;
      border-top: 1px solid #a4b5c51c;
      text-align: left;
    }

    #goal-section .goal-editor > summary {
      display: flex;
      align-items: center;
      gap: 16px;
      min-height: 48px;
      padding: 12px 0;
      list-style: none;
      color: #bcc8d2;
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
      padding: 12px 0 8px;
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

    body.goal-enabled #goal-section .goal-market,
    body.goal-enabled #goal-section .goal-footnote {
      color: #a6b5c4;
      font-size: 13px;
      line-height: 1.8;
      letter-spacing: 0;
      margin: 14px 0 0;
      padding: 0;
      border: 0;
      overflow-wrap: anywhere;
    }

    #goal-section .goal-market[data-warning=true] {
      color: #d1bb90;
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

      body.goal-enabled #view-investments #pf-root > #goal-section.goal-observatory {
        padding: 28px 16px;
        margin-bottom: 24px;
      }

      body.goal-enabled #goal-section .goal-dial.goal-galaxy {
        height: 300px;
      }

      #goal-section .goal-dial.goal-galaxy > svg {
        width: 230px;
        height: 230px;
      }

      body.goal-enabled #goal-section #goal-percent {
        font-size: 32px;
      }

      #goal-section .goal-form-row {
        flex-wrap: wrap;
      }

      #goal-section .goal-save {
        width: 100%;
      }
    }
  `;

  document.head.append(style);

  const trigger = document.createElement('a');
  trigger.href = '#goal-section';
  trigger.innerHTML = '<span>03</span> Goal';

  nav.querySelector('a[href="#pf-chart"]')?.after(trigger);

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
  dialog.className = 'pf-panel goal-observatory';
  dialog.id = 'goal-section';
  dialog.setAttribute('aria-labelledby', 'goal-title');
  dialog.setAttribute('aria-describedby', 'goal-help');

  dialog.innerHTML = `
    <div class="goal-heading">
      <h2 id="goal-title">Goal</h2>
    </div>

    <div class="goal-overview">
      <div
        class="goal-dial goal-galaxy"
        id="goal-track"
        role="progressbar"
        aria-label="Progress towards portfolio target"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <canvas
          class="goal-galaxy-canvas"
          id="goal-galaxy-canvas"
          aria-hidden="true"
        ></canvas>

        <svg viewBox="0 0 200 200" aria-hidden="true">
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
          <span id="goal-progress-label">of target</span>
        </div>
      </div>

      <div>
        <span class="goal-kicker" id="goal-kind">
          Example target
        </span>
        <strong class="goal-target" id="goal-target">—</strong>
        <p class="goal-remaining-line">
          <strong id="goal-remaining">—</strong> remaining
        </p>
      </div>
    </div>

    <p
      class="goal-warning"
      id="goal-warning"
      role="status"
      hidden
    ></p>

    <p class="goal-storage" id="goal-storage" role="status"></p>

    <details class="goal-editor" id="goal-editor">
      <summary>Edit goal &amp; details</summary>

      <form id="goal-form">
        <label for="goal-input">Target in euros</label>
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

      <span id="goal-current" hidden></span>

      <p class="goal-market" id="goal-market">
        Waiting for portfolio data.
      </p>

      <p class="goal-footnote" id="goal-help">
        Progress uses portfolio market value and can fall.
        SXR8 is excluded. The target is in euros, before
        inflation. This is not a forecast.
      </p>
    </details>
  `;

  document.querySelector('#view-investments').after(dialog);

  const get = id => dialog.querySelector('#' + id);
  const input = get('goal-input');
  input.value = String(target);

  function priceLabel() {
    const quotes = ['VWCE', 'VFEA']
      .filter(asset => summary?.rows?.[asset]?.shares > 0)
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

    return label + ' / ' +
      (oldest.date || 'date unavailable') + time;
  }

  function render() {
    get('goal-target').textContent = targetMoney(target);
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
        value >= target ? 'Reached' : 'of target';

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
        'stroke-dasharray', '0 100'
      );
    }

    const market = get('goal-market');

    const age = summary?.date
      ? Date.now() - Date.parse(summary.date + 'T12:00:00Z')
      : NaN;

    const warning = !!summary && (
      !known ||
      summary.status === 'warning' ||
      age > 5 * 86400000
    );

    market.dataset.warning = String(warning);

    const warningNote = get('goal-warning');

    warningNote.hidden =
      !summary || (known && summary.count > 0);

    warningNote.textContent = !known
      ? 'Valuation unavailable'
      : !summary?.count
        ? 'Add purchases in Ledger to start tracking.'
        : '';

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
          ? ' · Using available prices; see market status above'
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
        JSON.stringify({ version: 1, target })
      );

      targetKind = 'Your target';
      storageNote = '';
      get('goal-editor').open = false;
      get('goal-editor').querySelector('summary').focus();
    } catch {
      targetKind = 'Target for this visit';
      storageNote =
        'Goal applied for this visit. ' +
        'Browser storage could not save it.';
    }

    render();
  });

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

      let label = section.querySelector('.section-coordinate');

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
    ledgerDialog.setAttribute('aria-labelledby', 'ledger-title');

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
    close.setAttribute('aria-label', 'Close transaction history');
    close.setAttribute('autofocus', '');

    heading.append(close);
    ledgerDialog.append(heading, ledger);
    root.append(ledgerDialog);

    function openLedger() {
      if (!ledgerDialog.open) ledgerDialog.showModal();
      ledgerButton.setAttribute('aria-expanded', 'true');
    }

    ledgerButton.disabled = false;
    ledgerButton.addEventListener('click', openLedger);

    close.addEventListener('click', () => {
      ledgerDialog.close();
    });

    ledgerDialog.addEventListener('close', () => {
      ledgerButton.setAttribute('aria-expanded', 'false');
      ledgerButton.focus({ preventScroll: true });
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
      if (location.hash === '#pf-trades') openLedger();
    };

    addEventListener('hashchange', followLedgerHash);

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

  if (motion && footer) footer.append(motion);

  document.querySelector(
    '.hero-actions .quiet-link[href="#pf-trades"]'
  )?.remove();

  document.body.classList.add('goal-enabled');

  function setupGalaxy() {
    const canvas = get('goal-galaxy-canvas');
    if (!canvas) return;

    let context;

    try {
      context = canvas.getContext('2d');
    } catch {
      return;
    }

    if (!context) return;

    const reduced = matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const TAU = Math.PI * 2;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let time = 0;
    let previous = 0;
    let lastPaint = -Infinity;
    let frame = 0;
    let visible = !('IntersectionObserver' in window);
    let seed = 7341;

    const random = () =>
      ((seed = seed * 16807 % 2147483647) - 1) /
      2147483646;

    const particles = Array.from(
      { length: 1800 },
      (_, index) => {
        const radius = Math.sqrt(random());

        return {
          radius,
          angle:
            index % 3 * TAU / 3 +
            radius * 6.4 +
            (random() - .5) * .48,
          scatter: (random() - .5) * .13,
          size: .35 + random() * .85,
          alpha: .32 + random() * .65,
          phase: random() * TAU,
          colour: index % 7 === 0
            ? '#f0aa78'
            : index % 3 === 0
              ? '#e6cbb1'
              : '#b7cfdf',
          haze: index % 14 === 0
        };
      }
    );

    const clouds = Array.from({ length: 190 }, (_, index) => {
      const radius = .12 + Math.sqrt(random()) * .84;

      return {
        radius,
        angle: index % 3 * TAU / 3 + radius * 6.4,
        scatter: (random() - .5) * .055,
        size: 32 + random() * 64,
        alpha: .16 + random() * .24,
        palette: index % 8 < 4 ? 0 : index % 8 < 7 ? 1 : 2
      };
    });

    function makeGlow(colour) {
      const sprite = document.createElement('canvas');
      sprite.width = 48;
      sprite.height = 48;

      const c = sprite.getContext('2d');
      if (!c) return null;

      const glow = c.createRadialGradient(
        24, 24, 0,
        24, 24, 24
      );

      glow.addColorStop(0, `rgba(${colour}, .65)`);
      glow.addColorStop(.18, `rgba(${colour}, .38)`);
      glow.addColorStop(.55, `rgba(${colour}, .09)`);
      glow.addColorStop(1, `rgba(${colour}, 0)`);

      c.fillStyle = glow;
      c.fillRect(0, 0, 48, 48);

      return sprite;
    }

    const mist = [
      makeGlow('179, 66, 37'),
      makeGlow('190, 108, 53'),
      makeGlow('74, 107, 154')
    ];

    const sprite = makeGlow('202, 221, 237');

    function paint() {
      if (!width || !height) return;

      const c = context;

      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, width, height);

      const extent = Math.min(width * .48, 440);
      const scale = Math.min(1, width / 900);
      const centreX = width / 2;
      const centreY = height / 2;
      const tilt = -.24;
      const cosTilt = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);

      c.save();
      c.translate(centreX, centreY);
      c.rotate(tilt);
      c.scale(1, .48);

      const atmosphere = c.createRadialGradient(
        0, 0, 12,
        0, 0, extent
      );

      atmosphere.addColorStop(0, '#a95f2d30');
      atmosphere.addColorStop(.28, '#873b2628');
      atmosphere.addColorStop(.65, '#65232212');
      atmosphere.addColorStop(1, '#39192100');

      c.fillStyle = atmosphere;
      c.fillRect(
        -extent, -extent,
        extent * 2, extent * 2
      );
      c.restore();

      const clearRadius = Math.min(88, width * .18);
      const feather = Math.min(40, width * .08);

      function project(particle) {
        const radius = 12 + particle.radius * (extent - 12);
        const angle = particle.angle + time * .026;
        const diskX = Math.cos(angle) * radius;

        const diskY =
          Math.sin(angle) * radius * .48 +
          particle.scatter * extent * particle.radius;

        return {
          x: centreX + diskX * cosTilt - diskY * sinTilt,
          y: centreY + diskX * sinTilt + diskY * cosTilt
        };
      }

      const centreFade = (x, y) => Math.max(0, Math.min(1,
        (Math.hypot(x - centreX, y - centreY) - clearRadius) /
        Math.max(1, feather)
      ));

      for (const cloud of clouds) {
        const texture = mist[cloud.palette];
        if (!texture) continue;

        const { x, y } = project(cloud);
        const edge = Math.min(1, (1 - cloud.radius) * 6);
        const size = cloud.size * Math.max(.55, scale);

        c.globalAlpha =
          cloud.alpha * edge * centreFade(x, y);

        c.drawImage(
          texture,
          x - size / 2,
          y - size / 2,
          size,
          size
        );
      }

      for (const star of particles) {
        const { x, y } = project(star);
        const clearCentre = centreFade(x, y);

        const edge = Math.max(
          0,
          Math.min(1, (1 - star.radius) * 7)
        );

        const shimmer =
          .88 + .12 * Math.sin(time * .38 + star.phase);

        const alpha =
          star.alpha * clearCentre * edge * shimmer;

        if (alpha < .015) continue;

        if (star.haze && sprite) {
          const size =
            (10 + star.radius * 12) * Math.max(.6, scale);

          c.globalAlpha = alpha * .45;

          c.drawImage(
            sprite,
            x - size / 2,
            y - size / 2,
            size,
            size
          );
        }

        c.globalAlpha = alpha;
        c.fillStyle = star.colour;

        const size = Math.max(
          .55,
          star.size * Math.max(.6, scale)
        );

        c.fillRect(x, y, size, size);
      }

      c.globalAlpha = 1;
    }

    const paused = () =>
      reduced.matches ||
      document.body.classList.contains('motion-paused');

    const canAnimate = () =>
      visible && !document.hidden && !paused();

    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
    }

    function tick(now) {
      frame = 0;

      if (!canAnimate()) {
        previous = 0;
        return;
      }

      if (previous) {
        time += Math.min(.05, (now - previous) / 1000);
      }

      previous = now;

      if (now - lastPaint >= 1000 / 30) {
        paint();
        lastPaint = now;
      }

      frame = requestAnimationFrame(tick);
    }

    function sync() {
      if (!canAnimate()) {
        stop();

        if (visible && !document.hidden) paint();
      } else if (!frame) {
        previous = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function resize() {
      const box = canvas.getBoundingClientRect();

      width = box.width;
      height = box.height;
      dpr = Math.min(devicePixelRatio || 1, 1.5);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      paint();
      sync();
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        sync();
      }).observe(canvas);
    }

    if ('ResizeObserver' in window) {
      new ResizeObserver(resize).observe(canvas);
    }

    addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);

    let lastPaused = paused();

    new MutationObserver(() => {
      const next = paused();

      if (next !== lastPaused) {
        lastPaused = next;
        sync();
      }
    }).observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    resize();
  }

  render();
  setupGalaxy();
})();
