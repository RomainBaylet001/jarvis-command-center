
/*
 JARVIS PRIVATE PORTFOLIO v1
 Transactions saved locally in browser.
 No invented market prices.
*/

(() => {
  "use strict";

  const KEY = "jarvis-private-portfolio-v1";

  const COLORS = {
    Portfolio: "#f1f7ff",
    VWCE: "#4bdcf1",
    VFEA: "#f6ba49",
    SXR8: "#c296ff"
  };

  const euro = n =>
    new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR"
    }).format(n);

  const percent = n =>
    `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const safe = s =>
    String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);

  const $ = id => document.getElementById(id);

  let portfolio = {
    trades: [],
    quotes: { VWCE: null, VFEA: null },
    quoteDate: ""
  };

  let history = null;
  let period = "ALL";
  const selected = new Set(Object.keys(COLORS));

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (!saved || !Array.isArray(saved.trades)) return;

      portfolio.trades = saved.trades.filter(t =>
        /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
        ["VWCE", "VFEA"].includes(t.asset) &&
        Number.isFinite(t.amount) && t.amount > 0 &&
        Number.isFinite(t.shares) && t.shares > 0
      );

      for (const a of ["VWCE", "VFEA"]) {
        const p = Number(saved.quotes?.[a]);
        portfolio.quotes[a] = p > 0 ? p : null;
      }

      portfolio.quoteDate = saved.quoteDate || "";
    } catch {}
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(portfolio));
    } catch {
      $("pf-status").textContent =
        "Browser storage unavailable. Data was not saved.";
    }
  }

  function holdings() {
    const result = {};

    for (const asset of ["VWCE", "VFEA"]) {
      const transactions = portfolio.trades.filter(
        t => t.asset === asset
      );

      const invested = transactions.reduce(
        (s, t) => s + t.amount, 0
      );

      const shares = transactions.reduce(
        (s, t) => s + t.shares, 0
      );

      const price = portfolio.quotes[asset];

      result[asset] = {
        invested,
        shares,
        price,
        value: price ? shares * price : null
      };
    }

    return result;
  }

  function render() {
    const h = holdings();
    const invested = h.VWCE.invested + h.VFEA.invested;

    const quoted = ["VWCE", "VFEA"].every(a =>
      h[a].invested === 0 || h[a].price
    );

    const value = quoted
      ? (h.VWCE.value || 0) + (h.VFEA.value || 0)
      : null;

    const gain = invested && value !== null
      ? value - invested
      : null;

    $("pf-invested").textContent = euro(invested);

    $("pf-value").textContent =
      value === null ? "—" : euro(value);

    $("pf-profit").textContent =
      gain === null
        ? "—"
        : `${gain >= 0 ? "+" : ""}${euro(gain)} 
           (${percent(gain / invested * 100)})`;

    $("pf-profit").style.color =
      gain === null ? "" :
      gain >= 0 ? "#5be0a0" : "#f18c91";

    $("pf-count").textContent = portfolio.trades.length;

    $("pf-holdings").innerHTML =
      ["VWCE", "VFEA"].map(a => {
        const v = h[a];
        const gain = v.value === null
          ? null : v.value - v.invested;

        return `
          <tr>
            <td style="color:${COLORS[a]}"><b>${a}</b></td>
            <td>${euro(v.invested)}</td>
            <td>${v.shares.toFixed(2)}</td>
            <td>${v.price ? euro(v.price) : "—"}</td>
            <td>${v.value === null ? "—" : euro(v.value)}</td>
            <td>${gain === null ? "—" : euro(gain)}</td>
          </tr>`;
      }).join("");

    $("pf-world").value = portfolio.quotes.VWCE ?? "";
    $("pf-emerging").value = portfolio.quotes.VFEA ?? "";
    $("pf-date").value = portfolio.quoteDate;

    const share = invested
      ? h.VWCE.invested / invested * 100
      : 50;

    $("pf-allocation").style.background =
      `linear-gradient(to right,
       ${COLORS.VWCE} ${share}%,
       ${COLORS.VFEA} ${share}%)`;

    $("pf-alloc-text").textContent = invested
      ? `World ${share.toFixed(1)}% · Emerging ${(100-share).toFixed(1)}%`
      : "No investments imported";

    $("pf-transactions").innerHTML =
      [...portfolio.trades]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(t => `
        <tr>
          <td>${safe(t.date)}</td>
          <td style="color:${COLORS[t.asset]}">${t.asset}</td>
          <td>${euro(t.amount)}</td>
          <td>${t.shares.toFixed(4)}</td>
          <td>${safe(t.broker)}</td>
        </tr>
      `).join("");

    drawChart();
  }

  function importTransactions() {
    let lines = $("pf-csv").value.trim()
      .split(/\r?\n/)
      .filter(Boolean);

    if (/^date[,;\t]/i.test(lines[0])) lines.shift();

    const trades = [];

    for (let i = 0; i < lines.length; i++) {
      const fields = lines[i].split(/[,;\t]/)
        .map(x => x.trim());

      const [date, asset, amount, shares, price, broker] =
        fields;

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        !["VWCE", "VFEA"].includes(asset?.toUpperCase()) ||
        !(Number(amount) > 0) ||
        !(Number(shares) > 0) ||
        !(Number(price) > 0)
      ) {
        $("pf-status").textContent =
          `Invalid transaction at row ${i + 1}`;
        return;
      }

      trades.push({
        date,
        asset: asset.toUpperCase(),
        amount: Number(amount),
        shares: Number(shares),
        purchasePrice: Number(price),
        broker: (broker || "").slice(0, 40)
      });
    }

    if (!trades.length || trades.length > 1000) return;

    if (portfolio.trades.length &&
        !confirm("Replace existing transactions?")) return;

    portfolio.trades = trades;
    save();
    render();

    $("pf-csv").value = "";
    $("pf-status").textContent =
      `${trades.length} transactions imported privately.`;
  }

  function makeHistory(data) {
    if (!data?.prices) throw Error("Missing price history");

    const maps = {};

    for (const asset of ["VWCE", "VFEA", "SXR8"]) {
      const rows = data.prices[asset];

      if (!Array.isArray(rows) || rows.length < 3) {
        throw Error(`Missing prices for ${asset}`);
      }

      maps[asset] = new Map(
        rows
          .filter(r =>
            /^\d{4}-\d{2}-\d{2}$/.test(r[0]) &&
            Number(r[1]) > 0
          )
          .map(r => [r[0], Number(r[1])])
      );
    }

    return {
      maps,
      source: data.source || "Unknown provider"
    };
  }

  function performance() {
    if (!history || !portfolio.trades.length) return [];

    const m = history.maps;

    const dates = [...m.VWCE.keys()]
      .filter(d => m.VFEA.has(d) && m.SXR8.has(d))
      .sort();

    const trades = [...portfolio.trades]
      .sort((a, b) => a.date.localeCompare(b.date));

    const benchmarkBuys = trades.map(t => {
      const day = dates.find(d => d >= t.date);

      if (!day) return null;

      return {
        ...t,
        day,
        benchmarkShares: t.amount / m.SXR8.get(day)
      };
    });

    if (benchmarkBuys.some(x => !x)) return [];

    return dates
      .filter(d => d >= trades[0].date)
      .map(date => {
        const active = trades.filter(t => t.date <= date);
        const benchmark = benchmarkBuys.filter(
          t => t.day <= date
        );

        if (!active.length || !benchmark.length) return null;

        const invested = active.reduce(
          (s, t) => s + t.amount, 0
        );

        const value = ["VWCE", "VFEA"].reduce(
          (total, asset) => {
            const shares = active
              .filter(t => t.asset === asset)
              .reduce((s, t) => s + t.shares, 0);

            return total + shares * m[asset].get(date);
          }, 0
        );

        const benchmarkValue = benchmark.reduce(
          (s, t) => s + t.benchmarkShares, 0
        ) * m.SXR8.get(date);

        const result = {
          date,
          Portfolio: (value / invested - 1) * 100,
          SXR8: (benchmarkValue / invested - 1) * 100
        };

        for (const asset of ["VWCE", "VFEA"]) {
          const items = active.filter(t => t.asset === asset);

          const cost = items.reduce(
            (s, t) => s + t.amount, 0
          );

          const shares = items.reduce(
            (s, t) => s + t.shares, 0
          );

          result[asset] = cost
            ? (shares * m[asset].get(date) / cost - 1) * 100
            : null;
        }

        return result;
      })
      .filter(Boolean);
  }

  function drawChart() {
    const container = $("pf-chart");
    const data = performance();

    if (!data.length) {
      container.innerHTML = `
        <div class="pf-empty">
          <b>Historical market feed pending</b>
          <p>
            Your real holdings and P/L are available now.
            We will connect daily historical prices for
            VWCE, VFEA and SXR8 next.
          </p>
          <p>No simulated market returns are displayed.</p>
        </div>`;

      $("pf-chart-source").textContent =
        "Historical comparison not connected";
      return;
    }

    const end = data[data.length - 1].date;
    const cutoff = new Date(end + "T12:00:00Z");

    if (period === "1M") cutoff.setUTCMonth(
      cutoff.getUTCMonth() - 1
    );

    if (period === "3M") cutoff.setUTCMonth(
      cutoff.getUTCMonth() - 3
    );

    if (period === "6M") cutoff.setUTCMonth(
      cutoff.getUTCMonth() - 6
    );

    const points = period === "ALL"
      ? data
      : data.filter(
          row => row.date >= cutoff.toISOString().slice(0, 10)
        );

    const series = [...selected];
    const values = points.flatMap(
      row => series.map(k => row[k]).filter(Number.isFinite)
    );

    if (!values.length) {
      container.textContent = "Select an asset to display.";
      return;
    }

    const minimum = Math.floor(
      (Math.min(0, ...values) - 1) * 2
    ) / 2;

    const maximum = Math.ceil(
      (Math.max(0, ...values) + 1) * 2
    ) / 2;

    const W = 900, H = 320;
    const L = 64, R = 20, T = 20, B = 42;

    const x = i =>
      L + (W - L - R) * i / Math.max(1, points.length - 1);

    const y = v =>
      T + (H - T - B) *
      (maximum - v) / (maximum - minimum || 1);

    let svg = "";

    for (let i = 0; i <= 4; i++) {
      const v = minimum + (maximum - minimum) * i / 4;
      const py = y(v);

      svg += `
        <line x1="${L}" x2="${W-R}"
              y1="${py}" y2="${py}"
              stroke="#263e54" stroke-dasharray="3 5"/>
        <text x="${L-9}" y="${py+4}"
              fill="#91aabc" font-size="12"
              text-anchor="end">${v.toFixed(1)}%</text>`;
    }

    for (const asset of series) {
      const coords = points
        .map((row, i) =>
          Number.isFinite(row[asset])
            ? `${x(i)},${y(row[asset])}`
            : null
        )
        .filter(Boolean);

      svg += `
        <polyline points="${coords.join(" ")}"
          fill="none" stroke="${COLORS[asset]}"
          stroke-width="2.6"
          stroke-linejoin="round"
          stroke-linecap="round"/>`;
    }

    const labels = [
      0,
      Math.floor((points.length - 1) / 2),
      points.length - 1
    ];

    for (const i of [...new Set(labels)]) {
      svg += `
        <text x="${x(i)}" y="${H-12}"
              fill="#91aabc" font-size="12"
              text-anchor="middle">${points[i].date}</text>`;
    }

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}"
           role="img"
           aria-label="Portfolio performance comparison">
        ${svg}
      </svg>`;

    $("pf-chart-source").textContent =
      `Closing prices through ${end} · ${history.source} ·
       Matched contributions · Data may be delayed`;
  }

  function initialize() {
    const host = $("view-investments");
    if (!host || $("pf-root")) return;

    const style = document.createElement("style");

    style.textContent = `
      #view-investments > :not(#pf-root) {
        display:none!important;
      }

      #pf-root {color:#e4f0fb}
      #pf-root * {box-sizing:border-box}

      #pf-root h1 {
        font-size:clamp(27px,3vw,40px);
        margin:9px 0;
      }

      #pf-root h2 {font-size:17px;margin:0 0 14px}

      #pf-root .pf-sub {
        color:#91aabc;
        font-size:13px;
        line-height:1.7;
      }

      #pf-root .pf-micro {
        font-size:10px;
        color:#54cce8;
        letter-spacing:2px;
      }

      #pf-root .pf-grid {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin:23px 0;
      }

      #pf-root .pf-card,
      #pf-root .pf-panel {
        background:#0b1c2d;
        border:1px solid #203e54;
        border-radius:6px;
        padding:20px;
        min-width:0;
      }

      #pf-root .pf-card small {
        display:block;
        color:#91aabc;
        font-size:10px;
        letter-spacing:1px;
        margin-bottom:12px;
      }

      #pf-root .pf-card strong {
        font-size:clamp(16px,2vw,25px);
        overflow-wrap:anywhere;
      }

      #pf-root .pf-panel {margin:15px 0}

      #pf-root .pf-top {
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap:12px;
      }

      #pf-root button {
        background:#0c2b40;
        border:1px solid #28506b;
        color:#b6eaf6;
        padding:10px 13px;
        border-radius:4px;
        cursor:pointer;
        font-size:12px;
      }

      #pf-root button.active {
        background:#56d5ef;
        border-color:#56d5ef;
        color:#052030;
        font-weight:700;
      }

      #pf-root .pf-controls {
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        margin:15px 0;
      }

      #pf-root .pf-table {
        overflow-x:auto;
      }

      #pf-root table {
        width:100%;
        min-width:530px;
        border-collapse:collapse;
        font-size:13px;
      }

      #pf-root th,
      #pf-root td {
        text-align:left;
        padding:12px;
        border-bottom:1px solid #1d354a;
        white-space:nowrap;
      }

      #pf-root th {
        color:#91aabc;
        font-size:10px;
        letter-spacing:1px;
      }

      #pf-root input,
      #pf-root textarea {
        background:#061522;
        color:#e4f0fb;
        border:1px solid #2b4b64;
        border-radius:4px;
        padding:10px;
        font:inherit;
        font-size:13px;
        max-width:100%;
      }

      #pf-root textarea {
        display:block;
        width:100%;
        min-height:140px;
        margin:12px 0;
        font-family:monospace;
      }

      #pf-root .pf-fields {
        display:flex;
        align-items:end;
        flex-wrap:wrap;
        gap:12px;
      }

      #pf-root label {
        display:grid;
        gap:6px;
        color:#91aabc;
        font-size:12px;
      }

      #pf-root .pf-fields input {width:145px}

      #pf-root .pf-empty {
        padding:65px 12px;
        text-align:center;
        color:#91aabc;
        line-height:1.7;
      }

      #pf-root .pf-empty b {color:#e4f0fb}

      #pf-root #pf-chart svg {
        display:block;
        width:100%;
        height:auto;
      }

      #pf-root #pf-allocation {
        height:9px;
        border-radius:10px;
        margin:14px 0;
      }

      #pf-root summary {
        cursor:pointer;
        color:#56d5ef;
      }

      @media(max-width:950px) {
        #pf-root .pf-grid {
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:460px) {
        #pf-root .pf-panel,
        #pf-root .pf-card {padding:13px}
      }
    `;

    document.head.appendChild(style);

    const root = document.createElement("div");
    root.id = "pf-root";

    root.innerHTML = `
      <div class="pf-micro">
        NORTHSTAR / INVESTMENT INTELLIGENCE 002
      </div>
      <h1>My Portfolio<span style="color:#56d5ef">.</span></h1>
      <p class="pf-sub">
        Real transactions · World & Emerging Markets ·
        S&P 500 benchmark
      </p>

      <div class="pf-grid">
        <div class="pf-card">
          <small>TOTAL INVESTED</small>
          <strong id="pf-invested">—</strong>
        </div>
        <div class="pf-card">
          <small>MARKET VALUE*</small>
          <strong id="pf-value">—</strong>
        </div>
        <div class="pf-card">
          <small>UNREALIZED P/L*</small>
          <strong id="pf-profit">—</strong>
        </div>
        <div class="pf-card">
          <small>PURCHASES</small>
          <strong id="pf-count">0</strong>
        </div>
      </div>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Performance vs S&P 500</h2>
          <span class="pf-micro">PORTFOLIO / BENCHMARK</span>
        </div>

        <div id="pf-legend" class="pf-controls"></div>

        <div class="pf-controls" id="pf-periods">
          <button data-period="1M">1M</button>
          <button data-period="3M">3M</button>
          <button data-period="6M">6M</button>
          <button data-period="ALL" class="active">ALL</button>
        </div>

        <div id="pf-chart"></div>
        <p class="pf-sub" id="pf-chart-source"></p>
      </section>

      <section class="pf-panel">
        <h2>Current Holdings</h2>
        <div id="pf-allocation"></div>
        <p id="pf-alloc-text" class="pf-sub"></p>

        <div class="pf-table">
          <table>
            <thead>
              <tr>
                <th>ETF</th>
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
          *Prices are snapshots, not live quotes.
          Rounded share counts may produce slightly
          different values from your brokerage.
        </p>
      </section>

      <section class="pf-panel">
        <h2>Update Market Prices</h2>
        <p class="pf-sub">
          Temporary manual quotes until the automatic
          historical data connection is ready.
        </p>

        <div class="pf-fields">
          <label>
            VWCE price (€)
            <input id="pf-world" type="number"
                   min="0" step="0.0001">
          </label>

          <label>
            VFEA price (€)
            <input id="pf-emerging" type="number"
                   min="0" step="0.0001">
          </label>

          <label>
            Quote date
            <input id="pf-date" type="date">
          </label>

          <button id="pf-save-prices">
            SAVE PRICES
          </button>
        </div>
      </section>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Transaction History</h2>
          <span class="pf-micro">PRIVATE / LOCAL STORAGE</span>
        </div>

        <div class="pf-table">
          <table>
            <thead>
              <tr>
                <th>DATE</th>
                <th>ETF</th>
                <th>INVESTED</th>
                <th>SHARES</th>
                <th>BROKER</th>
              </tr>
            </thead>
            <tbody id="pf-transactions"></tbody>
          </table>
        </div>

        <details>
          <summary>Import transactions (CSV)</summary>

          <p class="pf-sub">
            Paste purchases below. This information
            stays in your browser, not in GitHub.
          </p>

          <textarea id="pf-csv"
            placeholder="date,asset,invested,shares,price,broker">
          </textarea>

          <button id="pf-import-button">
            IMPORT TRANSACTIONS
          </button>
        </details>

        <p id="pf-status" class="pf-sub"
           aria-live="polite">
          No brokerage connection.
        </p>
      </section>
    `;

    host.appendChild(root);

    for (const name of Object.keys(COLORS)) {
      const button = document.createElement("button");

      button.textContent = name;
      button.className = "active";
      button.style.borderLeft =
        `4px solid ${COLORS[name]}`;

      button.addEventListener("click", () => {
        if (selected.has(name)) selected.delete(name);
        else selected.add(name);

        button.classList.toggle(
          "active", selected.has(name)
        );

        drawChart();
      });

      $("pf-legend").appendChild(button);
    }

    $("pf-periods").addEventListener("click", event => {
      const button = event.target.closest(
        "button[data-period]"
      );

      if (!button) return;

      period = button.dataset.period;

      $("pf-periods").querySelectorAll("button")
        .forEach(b => b.classList.toggle(
          "active", b === button
        ));

      drawChart();
    });

    $("pf-save-prices").addEventListener("click", () => {
      const w = Number($("pf-world").value);
      const e = Number($("pf-emerging").value);
      const date = $("pf-date").value;

      if (!(w > 0) || !(e > 0) || !date) {
        $("pf-status").textContent =
          "Enter two valid prices and their date.";
        return;
      }

      portfolio.quotes = { VWCE: w, VFEA: e };
      portfolio.quoteDate = date;

      save();
      render();

      $("pf-status").textContent =
        "Price snapshot saved locally.";
    });

    $("pf-import-button").addEventListener(
      "click", importTransactions
    );

    load();
    render();

    fetch("./data/etf-history.json", {
      cache: "no-store"
    })
      .then(r => {
        if (!r.ok) throw Error("Historical feed unavailable");
        return r.json();
      })
      .then(data => {
        history = makeHistory(data);
        drawChart();
      })
      .catch(() => {
        // No invented history or fallback prices.
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded", initialize
    );
  } else {
    initialize();
  }
})();
