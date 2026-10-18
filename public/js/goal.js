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

  if (!nav || document.getElementById('goal-dialog')) return;

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

    #goal-dialog {
      box-sizing: border-box;
      width: min(820px, 94vw);
      max-height: 90dvh;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 34px;
      border: 1px solid #bcac8150;
      border-radius: 6px;
      background: #0c121c;
      color: #edf0f3;
      box-shadow: 0 35px 100px #0009;
    }

    #goal-dialog::backdrop {
      background: #020509d9;
      backdrop-filter: blur(7px);
    }

    body:has(#goal-dialog[open]) {
      overflow: hidden;
    }

    #goal-dialog .goal-heading {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 20px;
    }

    #goal-dialog h2 {
      font: normal clamp(28px, 4vw, 40px)/1.15 Georgia, serif;
      letter-spacing: -.035em;
      margin: 14px 0 0;
    }

    #goal-dialog button {
      min-height: 44px;
      cursor: pointer;
      font-family: inherit;
    }

    #goal-dialog .goal-close {
      padding: 10px 14px;
      border: 1px solid #bdaf8e48;
      border-radius: 3px;
      background: transparent;
      color: #e4d7bd;
      flex-shrink: 0;
    }

    #goal-dialog .goal-description {
      color: #b4c0cd;
      font-size: 13px;
      line-height: 1.8;
      margin: 22px 0 28px;
    }

    #goal-dialog .goal-kicker {
      display: block;
      color: #aab9c8;
      font: 9px/1.7 var(--mono);
      letter-spacing: .12em;
    }

    #goal-dialog .goal-target {
      display: block;
      margin: 10px 0 26px;
      font-size: clamp(30px, 5vw, 52px);
      font-weight: 400;
      letter-spacing: -.045em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    #goal-dialog .goal-progress-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 15px;
    }

    #goal-dialog .goal-progress-heading strong {
      font-size: 24px;
      font-weight: 400;
      color: #99dce4;
    }

    #goal-dialog .goal-progress-heading span {
      font-size: 11px;
      color: #b4c0cd;
    }

    #goal-dialog .goal-track {
      height: 6px;
      border-radius: 3px;
      background: #a3b9cf1c;
      overflow: hidden;
      margin: 14px 0 24px;
    }

    #goal-dialog .goal-fill {
      height: 100%;
      width: 0;
      background: #99dce4;
      border-radius: 3px;
    }

    #goal-dialog .goal-metrics {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin: 0;
    }

    #goal-dialog .goal-metrics dt {
      color: #aab9c8;
      font-size: 11px;
      margin-bottom: 10px;
    }

    #goal-dialog .goal-metrics dd {
      margin: 0;
      font-size: clamp(20px, 3vw, 29px);
      letter-spacing: -.025em;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    #goal-dialog .goal-market {
      color: #a6b8c8;
      font: 10px/1.8 var(--mono);
      margin: 23px 0 28px;
    }

    #goal-dialog .goal-market[data-warning=true] {
      color: #dec18d;
    }

    #goal-dialog form {
      border-top: 1px solid #a4b5c522;
      padding-top: 24px;
    }

    #goal-dialog label {
      display: block;
      font-size: 12px;
      color: #d9e2e9;
      margin-bottom: 10px;
    }

    #goal-dialog .goal-form-row {
      display: flex;
      gap: 12px;
    }

    #goal-dialog input {
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

    #goal-dialog .goal-save {
      padding: 10px 20px;
      white-space: nowrap;
      border: 1px solid #dccba5;
      border-radius: 3px;
      background: #d9c7a1;
      color: #151a1d;
    }

    #goal-dialog .goal-save:hover {
      background: #e8d9b9;
    }

    #goal-dialog .goal-storage {
      min-height: 1.8em;
      color: #a8b9c9;
      font-size: 11px;
      line-height: 1.8;
      margin: 12px 0;
    }

    #goal-dialog .goal-footnote {
      border-top: 1px solid #a4b5c522;
      margin: 22px 0 0;
      padding-top: 18px;
      color: #a6b5c4;
      font-size: 11px;
      line-height: 1.8;
    }

    #goal-dialog :focus-visible,
    .nav .goal-nav:focus-visible {
      outline: 2px solid #99dce4;
      outline-offset: 4px;
    }

    footer .motion-toggle {
      flex-shrink: 0;
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
      .nav .goal-nav {
        font-size: 10px;
      }

      .nav .goal-nav > span {
        display: block;
        font-size: 7px;
      }

      #goal-dialog {
        padding: 23px;
        width: 95vw;
        max-height: 92dvh;
      }

      #goal-dialog .goal-heading {
        gap: 12px;
      }

      #goal-dialog .goal-metrics {
        gap: 16px;
      }

      #goal-dialog .goal-form-row {
        flex-wrap: wrap;
      }

      #goal-dialog .goal-save {
        width: 100%;
      }

      #goal-dialog .goal-target {
        font-size: 36px;
      }
    }

    @media(max-width: 380px) {
      #goal-dialog .goal-metrics {
        grid-template-columns: 1fr;
      }
    }
  `;

  document.head.append(style);

  const trigger = document.createElement('button');

  trigger.type = 'button';
  trigger.className = 'goal-nav';

  trigger.innerHTML =
    '<span aria-hidden="true">05</span> Goal';

  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'goal-dialog');
  trigger.setAttribute('aria-expanded', 'false');

  nav.append(trigger);

  const dialog = document.createElement('dialog');

  dialog.id = 'goal-dialog';
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

      <button
        type="button"
        class="goal-close"
        aria-label="Close goal"
        autofocus
      >
        Close ×
      </button>
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

  document.body.append(dialog);

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

  trigger.addEventListener('click', () => {
    render();

    if (!dialog.open) dialog.showModal();

    trigger.setAttribute('aria-expanded', 'true');
  });

  dialog.querySelector('.goal-close')
    .addEventListener('click', () => {
      dialog.close();
    });

  dialog.addEventListener('close', () => {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus({preventScroll: true});
  });

  document.addEventListener('northstar:summary', event => {
    summary = event.detail;

    if (dialog.open) render();
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
