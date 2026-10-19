/* NORTHSTAR / transaction editor.
   Saves through the portfolio engine. */
(() => {
  'use strict';

  const KEY = 'jarvis-private-portfolio-v1';
  const $ = id => document.getElementById(id);

  const money = value => new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR'
  }).format(value);

  function today() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());

    const part = type =>
      parts.find(item => item.type === type).value;

    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function initialize() {
    const history = $('pf-trades');
    const panel = history?.closest('section');

    if (!panel || $('trade-editor')) return;

    let snapshot = null;
    let editing = null;
    let editRaw = null;
    let undo = null;

    const style = document.createElement('style');

    style.textContent = `
      #view-investments #pf-root #ledger-dialog {
        box-sizing: border-box;
        padding: clamp(20px, 3vw, 34px);
      }

      #view-investments #pf-root #ledger-dialog .pf-top {
        margin: 0 0 20px;
      }

      #view-investments #pf-root #ledger-dialog .pf-top h2 {
        font-size: clamp(25px, 2.6vw, 32px);
        margin: 0;
      }

      #view-investments #pf-root #ledger-dialog .trade-editor {
        margin: 20px 0 24px;
        border: 1px solid #a4b5c52d;
        border-radius: 8px;
        background: #101923;
        overflow: hidden;
      }

      #view-investments #pf-root #ledger-dialog .trade-editor > summary {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        min-height: 58px;
        padding: 16px 20px;
        list-style: none;
        cursor: pointer;
        color: #ebdec5;
        font-family: inherit;
        font-size: 15px;
        font-weight: 500;
        line-height: 1.5;
      }

      #view-investments #pf-root #ledger-dialog .trade-editor > summary::-webkit-details-marker {
        display: none;
      }

      #view-investments #pf-root #ledger-dialog .trade-editor > summary::after {
        content: '+';
        color: #d9c7a1;
        font-size: 22px;
        font-weight: 300;
        line-height: 1;
      }

      #view-investments #pf-root #ledger-dialog .trade-editor[open] > summary {
        border-bottom: 1px solid #a4b5c51c;
      }

      #view-investments #pf-root #ledger-dialog .trade-editor[open] > summary::after {
        content: '−';
      }

      #view-investments #pf-root #ledger-dialog #trade-form {
        display: block;
        width: auto;
        max-width: none;
        margin: 0;
        padding: 20px;
        border: 0;
      }

      #view-investments #pf-root #ledger-dialog .trade-help {
        margin: 0 0 22px;
        max-width: 68ch;
        color: #b5c2cf;
        font-size: 14px;
        line-height: 1.7;
      }

      #view-investments #pf-root #ledger-dialog .trade-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 20px 24px;
        width: 100%;
        min-width: 0;
      }

      #view-investments #pf-root #ledger-dialog .trade-field {
        display: flex;
        flex-direction: column;
        gap: 9px;
        min-width: 0;
        margin: 0;
        padding: 0;
      }

      #view-investments #pf-root #ledger-dialog .trade-field label {
        display: block;
        margin: 0;
        padding: 0;
        color: #c3ced8;
        font-size: 14px;
        line-height: 1.5;
      }

      #view-investments #pf-root #ledger-dialog .trade-field input,
      #view-investments #pf-root #ledger-dialog .trade-field select {
        box-sizing: border-box;
        display: block;
        flex: none;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        height: 50px;
        min-height: 50px;
        margin: 0;
        padding: 11px 13px;
        border: 1px solid #a4b5c538;
        border-radius: 5px;
        background-color: #080f18;
        color: #edf0f3;
        font-family: inherit;
        font-size: 16px;
        line-height: normal;
        text-align: left;
        color-scheme: dark;
        box-shadow: inset 0 1px 2px #0002;
      }

      #view-investments #pf-root #ledger-dialog input[type=date] {
        appearance: none;
        -webkit-appearance: none;
        overflow: hidden;
      }

      #view-investments #pf-root #ledger-dialog input[type=date]::-webkit-date-and-time-value {
        min-width: 0;
        text-align: left;
      }

      #view-investments #pf-root #ledger-dialog .trade-field input:focus,
      #view-investments #pf-root #ledger-dialog .trade-field select:focus {
        border-color: #99dce4;
      }

      #view-investments #pf-root #ledger-dialog .trade-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin: 24px 0 0;
        padding-top: 20px;
        border-top: 1px solid #a4b5c51c;
      }

      #view-investments #pf-root #ledger-dialog .trade-actions button,
      #view-investments #pf-root #ledger-dialog .trade-row-actions button,
      #view-investments #pf-root #ledger-dialog #trade-undo {
        min-height: 44px;
        margin: 0;
        padding: 11px 16px;
        border: 1px solid #a4b5c538;
        border-radius: 5px;
        background: #0c151f;
        color: #d3dde5;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        cursor: pointer;
        white-space: nowrap;
      }

      #view-investments #pf-root #ledger-dialog #trade-submit {
        min-width: 150px;
        border-color: #dccba5;
        background: #d9c7a1;
        color: #151a1d;
        font-weight: 600;
      }

      #view-investments #pf-root #ledger-dialog #trade-submit:hover {
        background: #e8d9b9;
      }

      #view-investments #pf-root #ledger-dialog #trade-submit:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      #view-investments #pf-root #ledger-dialog .trade-status {
        margin: 12px 0;
        color: #b7c7d5;
        font-size: 14px;
        line-height: 1.7;
      }

      #view-investments #pf-root #ledger-dialog .trade-status:empty {
        display: none;
      }

      #view-investments #pf-root #ledger-dialog .trade-status[data-error=true] {
        color: #f1a7a7;
      }

      #view-investments #pf-root #ledger-dialog .trade-undo {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 14px;
        margin: 16px 0;
      }

      #view-investments #pf-root #ledger-dialog .trade-undo[hidden] {
        display: none;
      }

      #view-investments #pf-root #ledger-dialog .trade-undo span {
        font-size: 14px;
        color: #b7c7d5;
      }

      #view-investments #pf-root #ledger-dialog .trade-row-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }

      #view-investments #pf-root #ledger-dialog .trade-row-actions button {
        padding: 9px 13px;
      }

      #view-investments #pf-root #ledger-dialog .trade-row-actions .trade-delete {
        color: #e9aaaa;
        border-color: #c7878738;
        background: transparent;
      }

      #view-investments #pf-root #ledger-dialog .trade-row-actions button:hover {
        border-color: #99dce480;
        background: #99dce40a;
      }

      #view-investments #pf-root #ledger-dialog .trade-row-actions .trade-delete:hover {
        border-color: #c7878790;
        background: #c787870d;
      }

      #view-investments #pf-root #ledger-dialog #trade-editor :focus-visible,
      #view-investments #pf-root #ledger-dialog .trade-row-actions :focus-visible {
        outline: 2px solid #99dce4;
        outline-offset: 3px;
      }

      @media(max-width: 620px) {
        #view-investments #pf-root #ledger-dialog .trade-fields {
          grid-template-columns: minmax(0, 1fr);
          gap: 18px;
        }

        #view-investments #pf-root #ledger-dialog #trade-form {
          padding: 17px;
        }

        #view-investments #pf-root #ledger-dialog .trade-editor > summary {
          padding: 15px 17px;
        }
      }
    `;

    document.head.append(style);

    const editor = document.createElement('details');
    editor.id = 'trade-editor';
    editor.className = 'trade-editor';

    editor.innerHTML = `
      <summary id="trade-editor-title">
        Add a purchase +
      </summary>

      <form id="trade-form">
        <p class="trade-help">
          Enter the figures from your broker.
          Total paid can include fees.
          Only VWCE and VFEA are owned assets;
          SXR8 remains a benchmark.
        </p>

        <div class="trade-fields">
          <div class="trade-field">
            <label for="trade-date">Purchase date</label>
            <input
              id="trade-date"
              name="date"
              type="date"
              required
            >
          </div>

          <div class="trade-field">
            <label for="trade-asset">ETF</label>
            <select id="trade-asset" name="asset" required>
              <option value="VWCE">VWCE · World</option>
              <option value="VFEA">VFEA · Emerging Markets</option>
            </select>
          </div>

          <div class="trade-field">
            <label for="trade-amount">Total paid (€)</label>
            <input
              id="trade-amount"
              name="amount"
              type="number"
              inputmode="decimal"
              min="0.01"
              step="0.01"
              required
            >
          </div>

          <div class="trade-field">
            <label for="trade-shares">Shares purchased</label>
            <input
              id="trade-shares"
              name="shares"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
              required
            >
          </div>

          <div class="trade-field">
            <label for="trade-price">
              Unit purchase price (€) · optional
            </label>
            <input
              id="trade-price"
              name="price"
              type="number"
              inputmode="decimal"
              min="0"
              step="any"
            >
          </div>

          <div class="trade-field">
            <label for="trade-broker">Broker · optional</label>
            <input
              id="trade-broker"
              name="broker"
              type="text"
              maxlength="120"
              autocomplete="off"
            >
          </div>
        </div>

        <div class="trade-actions">
          <button id="trade-submit" type="submit">
            Save purchase
          </button>
          <button id="trade-cancel" type="button">
            Cancel
          </button>
        </div>
      </form>
    `;

    panel.querySelector('.pf-top').after(editor);

    const status = document.createElement('p');
    status.id = 'trade-status';
    status.className = 'trade-status';
    status.setAttribute('role', 'status');
    editor.after(status);

    const undoBar = document.createElement('div');
    undoBar.className = 'trade-undo';
    undoBar.hidden = true;

    undoBar.innerHTML = `
      <span>Last change saved.</span>
      <button type="button" id="trade-undo">
        Undo last change
      </button>
    `;

    status.after(undoBar);

    function message(text, error = false) {
      status.textContent = text;
      status.dataset.error = String(error);
    }

    function read() {
      const raw = localStorage.getItem(KEY);
      const data = raw === null
        ? { trades: [] }
        : JSON.parse(raw);

      if (!data || !Array.isArray(data.trades)) {
        throw Error(
          'Saved purchases could not be read. ' +
          'Export your JSON backup before making changes.'
        );
      }

      const trades = NorthstarFinance.validateTrades(data.trades);
      return { raw, trades };
    }

    function reset(close = true) {
      editing = null;
      editRaw = null;
      $('trade-form').reset();

      $('trade-date').max = today();
      $('trade-date').value = today();

      $('trade-editor-title').textContent = 'Add a purchase +';
      $('trade-submit').textContent = 'Save purchase';

      if (close) editor.open = false;
    }

    function updateHistory() {
      try {
        snapshot = read();
        $('trade-submit').disabled = false;
      } catch (error) {
        snapshot = null;
        $('trade-submit').disabled = true;
        message(error.message, true);
      }

      if (undo && snapshot?.raw !== undo.expectedRaw) {
        undo = null;
        undoBar.hidden = true;
      }

      const table = history.closest('table');

      if (!table.querySelector('[data-trade-actions-heading]')) {
        const heading = document.createElement('th');
        heading.dataset.tradeActionsHeading = '';
        heading.scope = 'col';
        heading.textContent = 'ACTIONS';
        table.querySelector('thead tr').append(heading);
      }

      history.querySelectorAll('[data-trade-actions]')
        .forEach(cell => cell.remove());

      const rows = [...history.rows];

      if (!snapshot?.trades.length) {
        rows.forEach(row => {
          if (row.cells.length === 1) {
            row.cells[0].colSpan = 6;
          }
        });
        return;
      }

      const sorted = snapshot.trades
        .map((trade, index) => ({ trade, index }))
        .sort((a, b) =>
          b.trade.date.localeCompare(a.trade.date)
        );

      rows.forEach((row, position) => {
        const item = sorted[position];
        if (!item || row.cells.length < 5) return;

        const cell = document.createElement('td');
        cell.dataset.tradeActions = '';

        const actions = document.createElement('div');
        actions.className = 'trade-row-actions';

        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';

        edit.setAttribute(
          'aria-label',
          `Edit ${item.trade.asset} purchase dated ${item.trade.date}`
        );

        edit.addEventListener('click', () => {
          startEdit(item.index);
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'trade-delete';
        remove.textContent = 'Delete';

        remove.setAttribute(
          'aria-label',
          `Delete ${item.trade.asset} purchase dated ${item.trade.date}`
        );

        remove.addEventListener('click', () => {
          deleteTrade(item.index);
        });

        actions.append(edit, remove);
        cell.append(actions);
        row.append(cell);
      });
    }

    function startEdit(index) {
      if (!snapshot?.trades[index]) return;

      const trade = snapshot.trades[index];
      editing = index;
      editRaw = snapshot.raw;

      $('trade-date').max = today();
      $('trade-date').value = trade.date;
      $('trade-asset').value = trade.asset;
      $('trade-amount').value = String(trade.amount);
      $('trade-shares').value = String(trade.shares);

      $('trade-price').value = trade.purchasePrice
        ? String(trade.purchasePrice)
        : '';

      $('trade-broker').value = trade.broker;
      $('trade-editor-title').textContent = 'Edit purchase';
      $('trade-submit').textContent = 'Save changes';

      editor.open = true;

      message(
        'Editing this purchase. Nothing changes until you save.'
      );

      $('trade-date').focus({ preventScroll: true });
      editor.scrollIntoView({
        block: 'nearest',
        behavior: 'auto'
      });
    }

    function save(
      trades,
      expectedRaw,
      description,
      restoring = false
    ) {
      let handled = false;
      const before = snapshot?.trades;

      const request = new CustomEvent(
        'northstar:save-transactions',
        {
          detail: {
            trades,
            expectedRaw,

            success(raw) {
              handled = true;

              undo = !restoring && before
                ? { trades: before, expectedRaw: raw }
                : null;

              undoBar.hidden = !undo;

              reset();
              updateHistory();
              message(description);

              (
                undo
                  ? $('trade-undo')
                  : $('trade-editor-title')
              ).focus({ preventScroll: true });
            },

            error(text) {
              handled = true;
              message(text, true);
            }
          }
        }
      );

      document.dispatchEvent(request);

      if (!handled) {
        message(
          'The portfolio editor is not connected yet. ' +
          'Finish updating the portfolio file before saving.',
          true
        );
      }
    }

    $('trade-form').addEventListener('submit', event => {
      event.preventDefault();

      $('trade-shares').setCustomValidity('');

      if (!($('trade-shares').valueAsNumber > 0)) {
        $('trade-shares').setCustomValidity(
          'Enter a share quantity greater than zero.'
        );
      }

      $('trade-date').max = today();

      if (!$('trade-form').reportValidity()) return;

      if (!snapshot) {
        return message(
          'Saved portfolio unavailable. ' +
          'Export your backup before making changes.',
          true
        );
      }

      if (editRaw !== null && editRaw !== snapshot.raw) {
        return message(
          'Purchases changed since you opened this form. ' +
          'Cancel and reopen it before saving.',
          true
        );
      }

      const existing = editing === null
        ? {}
        : snapshot.trades[editing];

      if (editing !== null && !existing) {
        return message(
          'This purchase is no longer available. ' +
          'Cancel and reopen the form.',
          true
        );
      }

      const trade = {
        ...existing,
        date: $('trade-date').value,
        asset: $('trade-asset').value,
        amount: $('trade-amount').valueAsNumber,
        shares: $('trade-shares').valueAsNumber,
        purchasePrice: $('trade-price').value === ''
          ? 0
          : $('trade-price').valueAsNumber,
        broker: $('trade-broker').value.trim()
      };

      const next = [...snapshot.trades];

      if (editing === null) {
        next.push(trade);
      } else {
        next[editing] = trade;
      }

      save(
        next,
        editRaw === null ? snapshot.raw : editRaw,
        editing === null
          ? 'Purchase added. Portfolio and Goal updated.'
          : 'Purchase updated. Portfolio and Goal recalculated.'
      );
    });

    $('trade-shares').addEventListener('input', () => {
      $('trade-shares').setCustomValidity('');
    });

    $('trade-cancel').addEventListener('click', () => {
      reset();
      message('No changes saved.');
    });

    editor.addEventListener('toggle', () => {
      if (editor.open && editing === null) {
        editRaw = snapshot?.raw ?? null;
        $('trade-date').max = today();
      }
    });

    function deleteTrade(index) {
      const trade = snapshot?.trades[index];
      if (!trade) return;

      if (!confirm(
        `Delete the ${trade.asset} purchase dated ` +
        `${trade.date} for ${money(trade.amount)}? ` +
        'You can undo this change during this visit.'
      )) {
        return;
      }

      save(
        snapshot.trades.filter(
          (_, position) => position !== index
        ),
        snapshot.raw,
        'Purchase deleted. Use Undo last change to restore it.'
      );
    }

    $('trade-undo').addEventListener('click', () => {
      if (!undo) return;

      save(
        undo.trades,
        undo.expectedRaw,
        'Last change undone. Portfolio restored.',
        true
      );
    });

    document.addEventListener(
      'northstar:summary',
      updateHistory
    );

    addEventListener('storage', event => {
      if (event.key !== KEY && event.key !== null) return;

      undo = null;
      undoBar.hidden = true;

      updateHistory();

      message(
        'Purchases changed in another tab. ' +
        'Reopen any edit form before saving.',
        true
      );
    });

    reset();
    updateHistory();
  }

  if ($('pf-trades')) {
    initialize();
  } else {
    document.addEventListener(
      'northstar:ready',
      initialize,
      { once: true }
    );
  }
})();
