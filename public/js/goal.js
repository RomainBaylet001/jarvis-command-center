/* NORTHSTAR / personal goal.
   Uses summary events; never edits purchases. */
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

  let storageNote =
    'Example target · save to keep it in this browser.';

  try {
    const raw = localStorage.getItem(KEY);

    if (raw !== null) {
      const saved = JSON.parse(raw);

      if (
        saved?.version === 1 &&
        validTarget(saved.target)
      ) {
        target = saved.target;
        storageNote = 'Target saved in this browser.';
      } else {
        storageNote =
          'Saved goal could not be read. Save a target ' +
          'to replace that goal setting.';
      }
    }
  } catch {
    storageNote =
      'Goal could not be loaded. You can still set ' +
      'a target for this visit.';
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

    #goal-section .goal-heading {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 20px;
    }

    #goal-section h2 {
      font: normal clamp(28px, 4vw, 40px)/1.15 Georgia, serif;
      letter-spacing: -.035em;
      margin: 14px 0 0;
    }

    #goal-section button {
      min-height: 44px;
      cursor: pointer;
      font-family: inherit;
    }

    #goal-section .goal-description {
      color: #b4c0cd;
      font-size: 13px;
      line-height: 1.8;
      margin: 22px 0 28px;
    }

    #goal-section .goal-kicker {
      display: block;
      color: #aab9c8;
      font: 9px/1.7 var(--mono);
      letter-spacing: .12em;
    }

    #goal-section .goal-target {
      display: block;
      margin: 10px 0 26px;
      font-size: clamp(30px, 5vw, 52px);
      font-weight: 400;
      letter-spacing: -.045em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    #goal-section .goal-progress-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 15px;
    }

    #goal-section .goal-progress-heading strong {
      font-size: 24px;
      font-weight: 400;
      color: #99dce4;
    }

    #goal-section .goal-progress-heading span {
      font-size: 11px;
      color: #b4c0cd;
    }

    #goal-section .goal-track {
      height: 6px;
      border-radius: 3px;
      background: #a3b9cf1c;
      overflow: hidden;
      margin: 14px 0 24px;
    }

    #goal-section .goal-fill {
      height: 100%;
      width: 0;
      background: #99dce4;
      border-radius: 3px;
    }

    #goal-section .goal-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin: 0;
    }

    #goal-section .goal-metrics dt {
      color: #aab9c8;
      font-size: 11px;
      margin-bottom: 10px;
    }

    #goal-section .goal-metrics dd {
      margin: 0;
      font-size: clamp(20px, 3vw, 29px);
      letter-spacing: -.025em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    #goal-section .goal-market {
      color: #a6b8c8;
      font: 10px/1.8 var(--mono);
      margin: 23px 0 28px;
    }

    #goal-section .goal-market[data-warning=true] {
      color: #dec18d;
    }

    #goal-section form {
      border-top: 1px solid #a4b5c522;
      padding-top: 24px;
      max-width: 620px;
    }

    #goal-section label {
      display: block;
      font-size: 12px;
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
      padding: 10px 20px;
      white-space: nowrap;
      border: 1px solid #dccba5;
      border-radius: 3px;
      background: #d9c7a1;
      color: #151a1d;
    }

    #goal-section .goal-save:hover {
      background: #e8d9b9;
    }

    #goal-section .goal-storage {
      min-height: 1.8em;
      color: #a8b9c9;
      font-size: 11px;
      line-height: 1.8;
      margin: 12px 0;
    }

    #goal-section .goal-footnote {
      border-top: 1px solid #a4b5c522;
      margin: 22px 0 0;
      padding-top: 18px;
      color: #a6b5c4;
      font-size: 11px;
      line-height: 1.8;
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

    @media(max-width: 1100px) {
      .nav .goal-nav > span {
        display: none;
      }
    }

    @media(max-width: 850px) {
      .nav .goal-nav {
        font-size: 11px;
      }
    }

    @media(max-width: 620px) {
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

      #goal-section .goal-heading {
        gap: 12px;
      }

      #goal-section .goal-metrics {
        gap: 16px;
      }

      #goal-section .goal-form-row {
        flex-wrap: wrap;
      }

      #goal-section .goal-save {
        width: 100%;
      }

      #goal-section .goal-target {
        font-size: 36px;
      }
    }

    @media(max-width: 380px) {
      #goal-section .goal-metrics {
        grid-template-columns: 1fr;
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

  dialog.className = 'pf-panel';
  dialog.id = 'goal-section';

  dialog.setAttribute('aria-labelledby', 'goal-title');
  dialog.setAttribute('aria-describedby', 'goal-help');

  dialog.innerHTML = `
    <div class="goal-heading">
      <div>
        <span class="eyebrow">
          NORTHSTAR / YOUR NEXT MILESTONE
        </span>

        <h2 id="goal-title">Your goal. In sight.</h2>
      </div>
    </div>

    <p id="goal-help" class="goal-description">
      Set a target in euros. Your progress follows the
      current value of your VWCE and VFEA holdings.
    </p>

    <span class="goal-kicker">
      PORTFOLIO TARGET / EUR
    </span>

    <strong class="goal-target" id="goal-target">—</strong>

    <div class="goal-progress-heading">
      <strong id="goal-percent">—</strong>

      <span id="goal-progress-label">
        Awaiting portfolio data
      </span>
    </div>

    <div
      class="goal-track"
      id="goal-track"
      role="progressbar"
      aria-label="Progress towards portfolio target"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="goal-fill"></div>
    </div>

    <dl class="goal-metrics">
      <div>
        <dt>Current portfolio value</dt>
        <dd id="goal-current">—</dd>
      </div>

      <div>
        <dt>Remaining to target</dt>
        <dd id="goal-remaining">—</dd>
      </div>
    </dl>

    <p class="goal-market" id="goal-market">
      Waiting for portfolio data.
    </p>

    <form id="goal-form">
      <label for="goal-input">
        Your target in euros
      </label>

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

      <p
        class="goal-storage"
        id="goal-storage"
        role="status"
      ></p>
    </form>

    <p class="goal-footnote">
      Progress uses portfolio market value, including gains
      and losses. It can go down as well as up. SXR8 is
      excluded. This is a nominal euro target, not an
      inflation-adjusted forecast or a promised completion date.
    </p>
  `;

  document.querySelector('#view-investments').after(dialog);

  const get = id => dialog.querySelector('#' + id);
  const input = get('goal-input');

  input.value = String(target);
  get('goal-storage').textContent = storageNote;

  function render() {
    get('goal-target').textContent = money(target);

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

      track.firstElementChild.style.width =
        progress.bar + '%';
    } else {
      get('goal-percent').textContent = '—';
      get('goal-remaining').textContent = '—';

      get('goal-progress-label').textContent = summary
        ? 'Valuation unavailable'
        : 'Awaiting portfolio data';

      track.removeAttribute('aria-valuenow');

      track.setAttribute(
        'aria-valuetext',
        'Portfolio valuation unavailable'
      );

      track.firstElementChild.style.width = '0%';
    }

    const market = get('goal-market');
    const heroDate = document.getElementById('hero-date');
    const date = summary?.date;

    const age = date
      ? Date.now() - Date.parse(date + 'T12:00:00Z')
      : NaN;

    market.dataset.warning = String(
      !!summary && (
        !known ||
        summary.status === 'warning' ||
        age > 5 * 86400000
      )
    );

    if (!summary) {
      market.textContent = 'Waiting for portfolio data.';
    } else if (!known) {
      market.textContent =
        'Portfolio value unavailable. Progress will resume ' +
        'when a valid valuation is available.';
    } else if (!summary.count) {
      market.textContent =
        'No purchases saved in this browser. ' +
        'Add purchases in Ledger to start tracking.';
    } else {
      market.textContent = (
        heroDate?.textContent.trim() ||
        (
          date
            ? 'LATEST CLOSE / ' + date
            : 'Price date unavailable'
        )
      ) + ' · daily prices, not live quotes';
    }
  }

  get('goal-form').addEventListener('submit', event => {
    event.preventDefault();

    const next = input.valueAsNumber;

    if (
      !input.reportValidity() ||
      !validTarget(next)
    ) {
      return;
    }

    target = next;

    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          target
        })
      );

      storageNote =
        'Goal saved in this browser. ' +
        'Your purchases have not changed.';
    } catch {
      storageNote =
        'Goal applied for this visit, but browser storage ' +
        'could not save it.';
    }

    get('goal-storage').textContent = storageNote;
    render();
  });

  document.addEventListener('northstar:ready', () => {
    const chart = document.getElementById('pf-chart')
      ?.closest('section');

    const ledger = document.getElementById('pf-trades')
      ?.closest('section');

    const root = document.getElementById('pf-root');

    if (chart) chart.after(dialog);

    /*
      Existing navigation holds references to these sections.
      Update the labels without replacing those sections.
    */
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

    /*
      Move existing elements, retaining their IDs and
      the financial engine's event handlers.
    */
    function openLedger() {
      if (!ledgerDialog.open) {
        ledgerDialog.showModal();
      }

      ledgerButton.setAttribute('aria-expanded', 'true');
    }

    ledgerButton.disabled = false;

    ledgerButton.addEventListener('click', openLedger);

    close.addEventListener('click', () => {
      ledgerDialog.close();
    });

    ledgerDialog.addEventListener('close', () => {
      ledgerButton.setAttribute('aria-expanded', 'false');
      ledgerButton.focus({preventScroll: true});
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
      ) {
        return;
      }

      event.preventDefault();
      openLedger();
    });

    const followLedgerHash = () => {
      if (location.hash === '#pf-trades') {
        openLedger();
      }
    };

    addEventListener('hashchange', followLedgerHash);

    requestAnimationFrame(() => {
      followLedgerHash();
      dispatchEvent(new Event('scroll'));
    });
  }, {once: true});

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

  render();
})();
