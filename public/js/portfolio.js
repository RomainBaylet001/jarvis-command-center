
/*
  JARVIS PORTFOLIO ENGINE v2
  Automatic ETF closing prices
  Private browser transaction storage
  VWCE / VFEA / SXR8 benchmark
*/

(() => {
  "use strict";

  // Do not change this key: it preserves your 11 purchases.
  const STORAGE_KEY = "jarvis-private-portfolio-v1";
  const DATA_URL = "./data/etf-history.json";
  const OWNED = ["VWCE", "VFEA"];
  const SYMBOLS = ["VWCE", "VFEA", "SXR8"];

  const COLORS = {
    Portfolio: "#f1f7ff",
    VWCE: "#4bdcf1",
    VFEA: "#f6ba49",
    SXR8: "#c296ff"
  };

  const el = id => document.getElementById(id);

  const eur = n => new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR"
  }).format(n);

  const pct = n =>
    `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  const signedEuro = n =>
    `${n >= 0 ? "+" : "−"}${eur(Math.abs(n))}`;

  const html = v =>
    String(v ?? "").replace(/[&<>"']/g, x => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[x]);

  let account = {
    trades: [],
    quotes: { VWCE: null, VFEA: null },
    quoteDate: ""
  };

  let feed = null;
  let feedError = "Market data not loaded yet";
  let range = "ALL";

  const visible = new Set(Object.keys(COLORS));

  // -----------------------------------------
  // PRIVATE TRANSACTION STORAGE
  // -----------------------------------------

  function loadAccount() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      if (!saved || !Array.isArray(saved.trades)) {
        return;
      }

      account.trades = saved.trades.filter(t =>
        /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
        OWNED.includes(t.asset) &&
        Number(t.amount) > 0 &&
        Number(t.shares) > 0
      ).map(t => ({
        date: t.date,
        asset: t.asset,
        amount: Number(t.amount),
        shares: Number(t.shares),
        broker: String(t.broker || ""),
        purchasePrice: Number(t.purchasePrice) || 0
      }));

      account.quotes = saved.quotes || account.quotes;
      account.quoteDate = saved.quoteDate || "";

    } catch (error) {
      console.warn("Unable to load portfolio", error);
    }
  }

  function saveAccount() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(account)
      );
      return true;
    } catch {
      el("pf-message").textContent =
        "Unable to save. Export a portfolio backup.";
      return false;
    }
  }

  // -----------------------------------------
  // AUTOMATIC MARKET DATA
  // -----------------------------------------

  function parseFeed(json) {
    if (json.currency !== "EUR" || !json.prices) {
      throw Error("Invalid EUR market data file");
    }

    const maps = {};

    for (const asset of SYMBOLS) {
      const rows = json.prices[asset];

      if (!Array.isArray(rows) || rows.length < 3) {
        throw Error(`Missing prices for ${asset}`);
      }

      const entries = rows.filter(row =>
        Array.isArray(row) &&
        /^\d{4}-\d{2}-\d{2}$/.test(row[0]) &&
        Number.isFinite(Number(row[1])) &&
        Number(row[1]) > 0
      ).map(row => [
        row[0],
        Number(row[1])
      ]);

      maps[asset] = new Map(entries);
    }

    // Use one common trading date.
    const dates = [...maps.VWCE.keys()]
      .filter(d =>
        maps.VFEA.has(d) &&
        maps.SXR8.has(d)
      )
      .sort();

    if (dates.length < 3) {
      throw Error("No common ETF trading dates");
    }

    return {
      maps,
      dates,
      latest: dates[dates.length - 1],
      updated: json.updatedAt || "",
      source: json.source || "Market provider"
    };
  }

  async function refreshPrices() {
    el("pf-feed").textContent =
      "Updating market prices…";

    el("pf-refresh").disabled = true;

    try {
      const response = await fetch(
        `${DATA_URL}?v=${Date.now()}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw Error(`Market feed HTTP ${response.status}`);
      }

      feed = parseFeed(await response.json());
      feedError = "";

    } catch (error) {
      feedError =
        error.message || "Market data unavailable";
    } finally {
      el("pf-refresh").disabled = false;
      render();
    }
  }

  function currentQuote(asset) {
    if (feed) {
      return {
        price: feed.maps[asset].get(feed.latest),
        date: feed.latest,
        type: "closing"
      };
    }

    // Retain old manual snapshots only as fallback.
    const price = Number(account.quotes?.[asset]);

    return price > 0 ? {
      price,
      date: account.quoteDate,
      type: "manual"
    } : null;
  }

  // -----------------------------------------
  // HOLDINGS AND PORTFOLIO VALUE
  // -----------------------------------------

  function summary() {
    const rows = {};

    for (const asset of OWNED) {
      const trades = account.trades.filter(
        t => t.asset === asset
      );

      const invested = trades.reduce(
        (sum, t) => sum + t.amount, 0
      );

      const shares = trades.reduce(
        (sum, t) => sum + t.shares, 0
      );

      const quote = currentQuote(asset);

      const value = quote
        ? shares * quote.price
        : null;

      rows[asset] = {
        invested,
        shares,
        quote,
        value,
        profit: value === null
          ? null
          : value - invested
      };
    }

    const invested = OWNED.reduce(
      (s, a) => s + rows[a].invested, 0
    );

    const canValue = OWNED.every(a =>
      rows[a].invested === 0 || rows[a].quote
    );

    const value = canValue
      ? OWNED.reduce(
          (s, a) => s + (rows[a].value || 0), 0
        )
      : null;

    return {
      rows,
      invested,
      value,
      profit: value === null
        ? null
        : value - invested
    };
  }

  function render() {
    const s = summary();

    el("pf-invested").textContent =
      eur(s.invested);

    el("pf-value").textContent =
      s.value === null ? "—" : eur(s.value);

    el("pf-pl").textContent =
      s.profit === null || !s.invested
        ? "—"
        : `${signedEuro(s.profit)} (${pct(
            s.profit / s.invested * 100
          )})`;

    el("pf-pl").style.color =
      s.profit === null
        ? ""
        : s.profit >= 0
          ? "#65e5aa"
          : "#ff9292";

    el("pf-count").textContent =
      account.trades.length;

    el("pf-holdings").innerHTML =
      OWNED.map(asset => {
        const v = s.rows[asset];

        return `
          <tr>
            <td style="color:${COLORS[asset]}">
              <b>${asset}</b>
            </td>
            <td>${eur(v.invested)}</td>
            <td>${v.shares.toFixed(4)}</td>
            <td>${v.quote ? eur(v.quote.price) : "—"}</td>
            <td>${v.value === null ? "—" : eur(v.value)}</td>
            <td>${v.profit === null
              ? "—"
              : signedEuro(v.profit)}</td>
          </tr>`;
      }).join("");

    const allocation = s.invested
      ? s.rows.VWCE.invested / s.invested * 100
      : 50;

    el("pf-bar").style.background =
      `linear-gradient(to right,
        ${COLORS.VWCE} ${allocation}%,
        ${COLORS.VFEA} ${allocation}%)`;

    el("pf-allocation").textContent = s.invested
      ? `World ${allocation.toFixed(1)}% · Emerging ${
          (100 - allocation).toFixed(1)
        }%`
      : "No transactions imported";

    el("pf-trades").innerHTML =
      [...account.trades]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(t => `
          <tr>
            <td>${t.date}</td>
            <td style="color:${COLORS[t.asset]}">
              ${t.asset}
            </td>
            <td>${eur(t.amount)}</td>
            <td>${t.shares.toFixed(4)}</td>
            <td>${html(t.broker)}</td>
          </tr>
        `).join("");

    // Latest closing prices, including S&P 500.
    if (feed) {
      const age = Math.floor(
        (
          Date.now() -
          Date.parse(feed.latest + "T12:00:00Z")
        ) / 86400000
      );

      const warning = age > 5
        ? " · WARNING: potentially stale"
        : "";

      el("pf-feed").textContent =
        `Automatic Xetra EUR daily closes · ${
          feed.latest
        }${warning}`;

      el("pf-prices").innerHTML =
        SYMBOLS.map(asset => `
          <div class="pf-quote">
            <small>
              ${asset}${
                asset === "SXR8" ? " · BENCHMARK" : ""
              }
            </small>
            <strong style="color:${COLORS[asset]}">
              ${eur(feed.maps[asset].get(feed.latest))}
            </strong>
            <span>
              ${feed.latest} · delayed close
            </span>
          </div>
        `).join("");

    } else {
      el("pf-feed").textContent =
        `Automatic prices unavailable: ${feedError}`;

      el("pf-prices").innerHTML = `
        <p class="pf-sub">
          ${
            s.value === null
              ? "Market value is unavailable."
              : "Showing previous manual price snapshots."
          }
        </p>`;
    }

    drawChart();
  }

  // -----------------------------------------
  // S&P 500 BENCHMARK COMPARISON
  // -----------------------------------------

  function seriesData() {
    if (!feed || !account.trades.length) {
      return [];
    }

    const { dates, maps } = feed;

    const trades = account.trades.map(t => {
      const tradeDay = dates.find(
        d => d >= t.date
      );

      return tradeDay ? {
        ...t,
        tradeDay,
        benchmarkShares:
          t.amount / maps.SXR8.get(tradeDay)
      } : null;

    }).filter(Boolean);

    if (!trades.length) return [];

    const firstDay = trades.reduce(
      (earliest, t) =>
        earliest < t.tradeDay
          ? earliest
          : t.tradeDay,
      trades[0].tradeDay
    );

    return dates
      .filter(day => day >= firstDay)
      .map(day => {
        const active = trades.filter(
          t => t.tradeDay <= day
        );

        if (!active.length) return null;

        const invested = active.reduce(
          (s, t) => s + t.amount, 0
        );

        const actualValue = active.reduce(
          (s, t) =>
            s + t.shares * maps[t.asset].get(day),
          0
        );

        const benchmarkValue = active.reduce(
          (s, t) =>
            s + t.benchmarkShares *
              maps.SXR8.get(day),
          0
        );

        const record = {
          day,
          Portfolio:
            (actualValue / invested - 1) * 100,
          SXR8:
            (benchmarkValue / invested - 1) * 100
        };

        for (const asset of OWNED) {
          const buys = active.filter(
            t => t.asset === asset
          );

          const cost = buys.reduce(
            (s, t) => s + t.amount, 0
          );

          record[asset] = cost
            ? (
                buys.reduce(
                  (s, t) => s + t.shares, 0
                ) * maps[asset].get(day) / cost - 1
              ) * 100
            : null;
        }

        return record;
      })
      .filter(Boolean);
  }

  // -----------------------------------------
  // CUSTOM MULTI-ASSET SVG CHART
  // -----------------------------------------

  function drawChart() {
    const target = el("pf-chart");
    const data = seriesData();

    if (!data.length) {
      target.innerHTML = `
        <div class="pf-empty">
          ${
            feed
              ? "Import transactions to see your comparison."
              : "Waiting for historical market data…"
          }
        </div>`;

      el("pf-chart-note").textContent =
        "No invented market prices.";
      return;
    }

    const final = data[data.length - 1].day;
    const limit = new Date(final + "T12:00:00Z");

    if (range === "1M") {
      limit.setUTCMonth(limit.getUTCMonth() - 1);
    }
    if (range === "3M") {
      limit.setUTCMonth(limit.getUTCMonth() - 3);
    }
    if (range === "6M") {
      limit.setUTCMonth(limit.getUTCMonth() - 6);
    }

    const points = range === "ALL"
      ? data
      : data.filter(p =>
          p.day >= limit.toISOString().slice(0, 10)
        );

    const chosen = [...visible];

    const values = points.flatMap(p =>
      chosen.map(k => p[k]).filter(Number.isFinite)
    );

    if (!values.length) {
      target.innerHTML = `
        <div class="pf-empty">
          Select a line to display the chart.
        </div>`;
      return;
    }

    const low = Math.floor(
      (Math.min(0, ...values) - 1) * 2
    ) / 2;

    const high = Math.ceil(
      (Math.max(0, ...values) + 1) * 2
    ) / 2;

    const W = 920;
    const H = 320;
    const L = 67;
    const R = 20;
    const T = 18;
    const B = 40;

    const X = i =>
      L + (W - L - R) *
      i / Math.max(1, points.length - 1);

    const Y = v =>
      T + (H - T - B) *
      (high - v) / (high - low || 1);

    let svg = "";

    // Grid and percentage labels.
    for (let i = 0; i <= 4; i++) {
      const n = low + (high - low) * i / 4;

      svg += `
        <line
          x1="${L}" x2="${W - R}"
          y1="${Y(n)}" y2="${Y(n)}"
          stroke="#284056"
          stroke-dasharray="3 5"
        />
        <text
          x="${L - 8}"
          y="${Y(n) + 4}"
          text-anchor="end"
          fill="#91aabc"
          font-size="12"
        >${n.toFixed(1)}%</text>`;
    }

    // Each ETF has its own color.
    for (const asset of chosen) {
      const segments = [];
      let current = [];

      points.forEach((p, i) => {
        if (Number.isFinite(p[asset])) {
          current.push(
            `${X(i)},${Y(p[asset])}`
          );
        } else if (current.length) {
          segments.push(current);
          current = [];
        }
      });

      if (current.length) {
        segments.push(current);
      }

      svg += segments.map(seg => `
        <polyline
          points="${seg.join(" ")}"
          fill="none"
          stroke="${COLORS[asset]}"
          stroke-width="2.6"
          stroke-linejoin="round"
          stroke-linecap="round"
        />`).join("");
    }

    // Date labels.
    const indexes = [
      0,
      Math.floor((points.length - 1) / 2),
      points.length - 1
    ];

    for (const i of [...new Set(indexes)]) {
      svg += `
        <text
          x="${X(i)}"
          y="${H - 12}"
          text-anchor="middle"
          font-size="12"
          fill="#91aabc"
        >${points[i].day}</text>`;
    }

    target.innerHTML = `
      <svg
        viewBox="0 0 ${W} ${H}"
        role="img"
        aria-label="Portfolio and S&P 500 comparison"
      >${svg}</svg>`;

    el("pf-chart-note").textContent =
      `As of ${final} · Cumulative gain relative to
      contributions · SXR8 simulates matching
      contributions at daily closing prices.
      Excludes fees and taxes. This is not
      a time-weighted return.`;
  }

  // -----------------------------------------
  // TRANSACTION IMPORT AND BACKUP
  // -----------------------------------------

  function importCsv() {
    let lines = el("pf-csv").value.trim()
      .split(/\r?\n/)
      .filter(Boolean);

    if (lines.length &&
        /^date[,;\t]/i.test(lines[0])) {
      lines.shift();
    }

    if (!lines.length || lines.length > 1000) {
      el("pf-message").textContent =
        "Paste between 1 and 1,000 transactions.";
      return;
    }

    const trades = [];

    for (const [index, line] of lines.entries()) {
      const [
        date, code, amount, shares, price, broker
      ] = line.split(/[,;\t]/).map(t => t.trim());

      const asset = (code || "").toUpperCase();

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !OWNED.includes(asset) ||
        !(Number(amount) > 0) ||
        !(Number(shares) > 0) ||
        !(Number(price) > 0)
      ) {
        el("pf-message").textContent =
          `Invalid transaction at row ${index + 1}`;
        return;
      }

      trades.push({
        date,
        asset,
        amount: Number(amount),
        shares: Number(shares),
        purchasePrice: Number(price),
        broker: String(broker || "").slice(0, 80)
      });
    }

    if (
      account.trades.length &&
      !confirm("Replace your existing transactions?")
    ) {
      return;
    }

    account.trades = trades;

    if (saveAccount()) {
      el("pf-csv").value = "";
      el("pf-message").textContent =
        `${trades.length} transactions saved privately.`;
    }

    render();
  }

  function exportCsv() {
    const lines = [
      "date,asset,invested,shares,price,broker"
    ];

    for (const t of account.trades) {
      lines.push([
        t.date,
        t.asset,
        t.amount,
        t.shares,
        t.purchasePrice || "",
        String(t.broker).replace(/[,;\t\r\n]/g, " ")
      ].join(","));
    }

    const link = document.createElement("a");

    link.href = URL.createObjectURL(
      new Blob([lines.join("\n")], {
        type: "text/csv;charset=utf-8"
      })
    );

    link.download = "jarvis-portfolio-backup.csv";
    link.click();

    setTimeout(
      () => URL.revokeObjectURL(link.href),
      1000
    );
  }

  // -----------------------------------------
  // DASHBOARD INTERFACE
  // -----------------------------------------

  function initialize() {
    const host = el("view-investments");

    if (!host || el("pf-root")) return;

    const css = document.createElement("style");

    css.textContent = `
      #view-investments > :not(#pf-root) {
        display:none!important
      }

      #pf-root {color:#e4f0fb}
      #pf-root * {box-sizing:border-box}

      #pf-root h1 {
        font-size:clamp(28px,3vw,40px);
        margin:10px 0
      }

      #pf-root h2 {
        font-size:17px;
        margin:0 0 14px
      }

      #pf-root .pf-sub {
        color:#91aabc;
        font-size:12px;
        line-height:1.7
      }

      #pf-root .pf-micro {
        color:#56d5ef;
        font-size:10px;
        letter-spacing:2px
      }

      #pf-root .pf-grid {
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:12px;
        margin:22px 0
      }

      #pf-root .pf-card,
      #pf-root .pf-panel {
        background:#0b1c2d;
        border:1px solid #203e54;
        border-radius:6px;
        padding:20px;
        min-width:0
      }

      #pf-root .pf-card small,
      #pf-root .pf-quote small {
        display:block;
        color:#91aabc;
        font-size:10px;
        letter-spacing:1px;
        margin-bottom:12px
      }

      #pf-root .pf-card strong {
        display:block;
        font-size:clamp(16px,2vw,25px);
        overflow-wrap:anywhere
      }

      #pf-root .pf-panel {margin:14px 0}

      #pf-root .pf-top {
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        flex-wrap:wrap
      }

      #pf-root button {
        background:#0c2b40;
        border:1px solid #28506b;
        color:#b6eaf6;
        padding:10px 13px;
        border-radius:4px;
        cursor:pointer;
        font-size:12px
      }

      #pf-root button.active {
        background:#56d5ef;
        color:#052030;
        border-color:#56d5ef;
        font-weight:700
      }

      #pf-root button:disabled {
        opacity:.5;
        cursor:wait
      }

      #pf-root .pf-controls {
        display:flex;
        gap:8px;
        flex-wrap:wrap;
        margin:14px 0
      }

      #pf-root .pf-table {overflow-x:auto}

      #pf-root table {
        width:100%;
        min-width:560px;
        border-collapse:collapse;
        font-size:13px
      }

      #pf-root th,
      #pf-root td {
        text-align:left;
        padding:12px;
        border-bottom:1px solid #1d354a;
        white-space:nowrap
      }

      #pf-root th {
        font-size:10px;
        color:#91aabc;
        letter-spacing:1px
      }

      #pf-root .pf-bar {
        height:9px;
        border-radius:8px;
        margin:13px 0
      }

      #pf-root .pf-prices {
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:10px;
        margin-top:14px
      }

      #pf-root .pf-quote {
        padding:14px;
        background:#071725;
        border:1px solid #203e54;
        border-radius:5px
      }

      #pf-root .pf-quote strong {
        display:block;
        font-size:21px;
        margin-bottom:9px
      }

      #pf-root .pf-quote span {
        font-size:11px;
        color:#91aabc
      }

      #pf-root .pf-empty {
        text-align:center;
        padding:65px 12px;
        color:#91aabc;
        font-size:14px
      }

      #pf-root #pf-chart svg {
        display:block;
        width:100%;
        height:auto
      }

      #pf-root summary {
        cursor:pointer;
        color:#56d5ef;
        margin:18px 0
      }

      #pf-root textarea {
        width:100%;
        min-height:145px;
        display:block;
        background:#061522;
        color:#e4f0fb;
        border:1px solid #2b4b64;
        padding:12px;
        font:13px monospace;
        margin:12px 0
      }

      @media(max-width:950px) {
        #pf-root .pf-grid {
          grid-template-columns:repeat(2,minmax(0,1fr))
        }
      }

      @media(max-width:600px) {
        #pf-root .pf-card,
        #pf-root .pf-panel {
          padding:13px
        }

        #pf-root .pf-prices {
          grid-template-columns:1fr
        }
      }
    `;

    document.head.appendChild(css);

    const root = document.createElement("div");
    root.id = "pf-root";

    root.innerHTML = `
      <div class="pf-micro">
        NORTHSTAR / INVESTMENT INTELLIGENCE 002
      </div>

      <h1>
        My Portfolio<span style="color:#56d5ef">.</span>
      </h1>

      <p class="pf-sub">
        Actual purchases · VWCE + VFEA ·
        S&P 500 benchmark
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
          <h2>Performance vs S&P 500</h2>
          <span class="pf-micro">
            YOUR CAPITAL / MATCHED CONTRIBUTIONS
          </span>
        </div>

        <div class="pf-controls" id="pf-legend"></div>

        <div class="pf-controls" id="pf-periods">
          <button data-range="1M" type="button">1M</button>
          <button data-range="3M" type="button">3M</button>
          <button data-range="6M" type="button">6M</button>
          <button data-range="ALL"
            type="button" class="active">ALL</button>
        </div>

        <div id="pf-chart"></div>
        <p id="pf-chart-note" class="pf-sub"></p>
      </section>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Automatic Market Prices</h2>
          <button type="button" id="pf-refresh">
            REFRESH DATA ↻
          </button>
        </div>

        <p class="pf-sub" id="pf-feed">
          Connecting to market data…
        </p>

        <div id="pf-prices" class="pf-prices"></div>

        <p class="pf-sub">
          *Latest available Xetra EUR daily closing prices,
          NOT intraday live quotes. Source: Yahoo Finance
          via GitHub Actions. Updates on weekdays if
          the workflow succeeds.
        </p>
      </section>

      <section class="pf-panel">
        <h2>Current Holdings</h2>

        <div class="pf-bar" id="pf-bar"></div>
        <p class="pf-sub" id="pf-allocation"></p>

        <div class="pf-table">
          <table>
            <thead>
              <tr>
                <th>ETF</th>
                <th>INVESTED</th>
                <th>SHARES</th>
                <th>CLOSE*</th>
                <th>VALUE*</th>
                <th>P/L*</th>
              </tr>
            </thead>
            <tbody id="pf-holdings"></tbody>
          </table>
        </div>

        <p class="pf-sub">
          P/L uses the saved purchase amounts and rounded
          share quantities. It may differ slightly from
          your brokers and excludes costs not captured
          in those amounts.
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
                <th>ETF</th>
                <th>INVESTED</th>
                <th>SHARES</th>
                <th>BROKER</th>
              </tr>
            </thead>
            <tbody id="pf-trades"></tbody>
          </table>
        </div>

        <details>
          <summary>
            Import or replace transactions (CSV)
          </summary>

          <p class="pf-sub">
            Paste your CSV below.
            Nothing is uploaded to GitHub.
          </p>

          <textarea id="pf-csv"
            placeholder="date,asset,invested,shares,price,broker">
          </textarea>

          <button id="pf-import" type="button">
            IMPORT TRANSACTIONS
          </button>
        </details>

        <button id="pf-backup" type="button">
          EXPORT PORTFOLIO BACKUP ↓
        </button>

        <p class="pf-sub" id="pf-message"
           aria-live="polite">
          Your transactions are stored only in
          this browser. Save a backup.
        </p>
      </section>
    `;

    host.appendChild(root);

    // Individual line selection.
    for (const asset of Object.keys(COLORS)) {
      const button = document.createElement("button");

      button.textContent = asset;
      button.className = "active";
      button.type = "button";
      button.style.borderLeft =
        `4px solid ${COLORS[asset]}`;

      button.setAttribute("aria-pressed", "true");

      button.addEventListener("click", () => {
        if (visible.has(asset)) {
          visible.delete(asset);
        } else {
          visible.add(asset);
        }

        button.classList.toggle(
          "active",
          visible.has(asset)
        );

        button.setAttribute(
          "aria-pressed",
          String(visible.has(asset))
        );

        drawChart();
      });

      el("pf-legend").appendChild(button);
    }

    // Timeframe selection.
    el("pf-periods").addEventListener(
      "click", event => {
        const button = event.target.closest(
          "button[data-range]"
        );

        if (!button) return;

        range = button.dataset.range;

        el("pf-periods")
          .querySelectorAll("button")
          .forEach(b => {
            b.classList.toggle(
              "active",
              b === button
            );
          });

        drawChart();
      }
    );

    el("pf-import").addEventListener(
      "click", importCsv
    );

    el("pf-backup").addEventListener(
      "click", exportCsv
    );

    el("pf-refresh").addEventListener(
      "click", refreshPrices
    );

    loadAccount();
    render();
    refreshPrices();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }
})();
