/*
  NORTHSTAR portfolio engine
  Actual purchases / delayed EUR closing prices
  VWCE + VFEA holdings / SXR8 benchmark
*/

(() => {
  "use strict";

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

  const eur = value => new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR"
  }).format(value);

  const pct = value =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  const signedEuro = value =>
    `${value >= 0 ? "+" : "−"}${eur(Math.abs(value))}`;

  const html = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const sharesText = value =>
    value.toLocaleString("en-IE", {
      maximumFractionDigits: 10
    });

  let account = {
    trades: [],
    quotes: { VWCE: null, VFEA: null },
    quoteDate: ""
  };

  let feed = null;
  let feedError = "Market data not loaded yet";
  let range = "ALL";
  let chartMode = "capital";

  const visible = new Set(Object.keys(COLORS));

  // STORAGE: loading never writes or migrates saved purchases.

  function loadAccount() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY)
      );

      if (saved === null) return;

      if (!saved || !Array.isArray(saved.trades)) {
        throw Error("Invalid saved portfolio structure");
      }

      if (!saved.quotes || typeof saved.quotes !== "object") {
        saved.quotes = { VWCE: null, VFEA: null };
      }

      account = {
        ...saved,
        trades: NorthstarFinance.validateTrades(saved.trades)
      };
    } catch (error) {
      console.warn("Unable to load portfolio", error);

      el("pf-message").textContent =
        "Saved portfolio could not be read. Original storage " +
        "is untouched. Export the raw JSON backup before " +
        "replacing anything.";

      document.body.dataset.storageError = "true";
    }
  }

  // MARKET DATA

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
        NorthstarFinance.validDate(row[0]) &&
        Number.isFinite(Number(row[1])) &&
        Number(row[1]) > 0
      ).map(row => [row[0], Number(row[1])]);

      if (
        entries.length !== rows.length ||
        new Set(entries.map(row => row[0])).size !== entries.length
      ) {
        throw Error(`Invalid or duplicate prices for ${asset}`);
      }

      maps[asset] = new Map(entries);
    }

    const dates = [...maps.VWCE.keys()]
      .filter(date =>
        maps.VFEA.has(date) && maps.SXR8.has(date)
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
    document.dispatchEvent(new CustomEvent(
      "northstar:state",
      { detail: "loading" }
    ));

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    el("pf-feed").textContent = "Updating market prices…";
    el("pf-refresh").disabled = true;

    try {
      const response = await fetch(
        `${DATA_URL}?v=${Date.now()}`,
        {
          cache: "no-store",
          signal: controller.signal
        }
      );

      if (!response.ok) {
        throw Error(`Market feed HTTP ${response.status}`);
      }

      feed = parseFeed(await response.json());
      feedError = "";
    } catch (error) {
      feedError = error.message || "Market data unavailable";
    } finally {
      clearTimeout(timeout);

      document.dispatchEvent(new CustomEvent(
        "northstar:state",
        { detail: feedError ? "warning" : "updated" }
      ));

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

    const price = Number(account.quotes?.[asset]);

    return price > 0 ? {
      price,
      date: account.quoteDate,
      type: "manual"
    } : null;
  }

  // HOLDINGS: calculate using full saved share precision.

  function summary() {
    const rows = {};

    for (const asset of OWNED) {
      const trades = account.trades.filter(
        trade => trade.asset === asset
      );

      const invested = trades.reduce(
        (sum, trade) => sum + trade.amount, 0
      );

      const shares = trades.reduce(
        (sum, trade) => sum + trade.shares, 0
      );

      const candidate = currentQuote(asset);

      const quote =
        candidate &&
        trades.every(trade => trade.date <= candidate.date)
          ? candidate
          : null;

      const value = quote ? shares * quote.price : null;

      rows[asset] = {
        invested,
        shares,
        quote,
        value,
        profit: value === null ? null : value - invested
      };
    }

    const invested = OWNED.reduce(
      (sum, asset) => sum + rows[asset].invested, 0
    );

    const canValue =
      document.body.dataset.storageError !== "true" &&
      OWNED.every(asset =>
        rows[asset].invested === 0 || rows[asset].quote
      );

    const value = canValue
      ? OWNED.reduce(
          (sum, asset) => sum + (rows[asset].value || 0), 0
        )
      : null;

    return {
      rows,
      invested,
      value,
      profit: value === null ? null : value - invested
    };
  }

  function render() {
    const result = summary();

    el("pf-invested").textContent = eur(result.invested);
    el("pf-value").textContent =
      result.value === null ? "—" : eur(result.value);

    el("pf-pl").textContent =
      result.profit === null || !result.invested
        ? "—"
        : `${signedEuro(result.profit)} (${pct(
            result.profit / result.invested * 100
          )})`;

    el("pf-pl").style.color =
      result.profit === null
        ? ""
        : result.profit >= 0 ? "#65e5aa" : "#ff9292";

    el("pf-count").textContent = account.trades.length;

    el("pf-holdings").innerHTML = OWNED.map(asset => {
      const holding = result.rows[asset];

      return `
        <tr>
          <td style="color:${COLORS[asset]}"><b>${asset}</b></td>
          <td>${eur(holding.invested)}</td>
          <td>${sharesText(holding.shares)}</td>
          <td>${holding.quote ? eur(holding.quote.price) : "—"}</td>
          <td>${holding.value === null ? "—" : eur(holding.value)}</td>
          <td>${holding.profit === null ? "—" : signedEuro(holding.profit)}</td>
        </tr>
      `;
    }).join("");

    const allocationBase =
      result.value > 0 ? result.value : result.invested;

    const allocation = allocationBase
      ? (
          result.value > 0
            ? result.rows.VWCE.value
            : result.rows.VWCE.invested
        ) / allocationBase * 100
      : 0;

    el("pf-bar").style.background =
      `linear-gradient(to right,
        ${COLORS.VWCE} ${allocation}%,
        ${COLORS.VFEA} ${allocation}%)`;

    el("pf-allocation").textContent = result.invested
      ? `${result.value > 0 ? "Market value" : "Invested capital"} ` +
        `allocation · World ${allocation.toFixed(1)}% · ` +
        `Emerging ${(100 - allocation).toFixed(1)}%`
      : "No transactions imported";

    el("pf-trades").innerHTML = [...account.trades]
      .sort((first, second) =>
        second.date.localeCompare(first.date)
      )
      .map(trade => `
        <tr>
          <td>${trade.date}</td>
          <td style="color:${COLORS[trade.asset]}">${trade.asset}</td>
          <td>${eur(trade.amount)}</td>
          <td>${sharesText(trade.shares)}</td>
          <td>${html(trade.broker)}</td>
        </tr>
      `).join("");

    if (feed) {
      const age = Math.floor(
        (
          Date.now() -
          Date.parse(feed.latest + "T12:00:00Z")
        ) / 86400000
      );

      el("pf-feed").textContent =
        (feedError ? "Refresh failed; retained data · " : "") +
        `Automatic Xetra EUR daily closes · ${feed.latest}` +
        (age > 5 ? " · WARNING: potentially stale" : "");

      el("pf-prices").innerHTML = SYMBOLS.map(asset => `
        <div class="pf-quote">
          <small>${asset}${asset === "SXR8" ? " · BENCHMARK" : ""}</small>
          <strong style="color:${COLORS[asset]}">
            ${eur(feed.maps[asset].get(feed.latest))}
          </strong>
          <span>${feed.latest} · delayed close</span>
        </div>
      `).join("");
    } else {
      el("pf-feed").textContent =
        `Automatic prices unavailable: ${feedError}`;

      el("pf-prices").innerHTML = `
        <p class="pf-sub">
          ${
            result.value === null
              ? "Market value is unavailable."
              : "Showing previous manual price snapshots."
          }
        </p>
      `;
    }

    document.dispatchEvent(new CustomEvent(
      "northstar:summary",
      {
        detail: {
          ...result,
          count: account.trades.length,
          allocation,
          allocationBasis:
            result.value > 0 ? "Market value" : "Invested capital",
          date: feed?.latest || account.quoteDate,
          status: feedError ? "warning" : "idle"
        }
      }
    ));

    drawChart();
  }

  // MATCHED-CONTRIBUTION BENCHMARK
  // This is cumulative gain / contributions, not TWR.

  function seriesData() {
    if (!feed || !account.trades.length) return [];

    const { dates, maps } = feed;

    if (account.trades.some(trade =>
      trade.date < dates[0] || trade.date > feed.latest
    )) {
      return [];
    }

    const trades = account.trades.map(trade => {
      const tradeDay = dates.find(date => date >= trade.date);

      return tradeDay ? {
        ...trade,
        tradeDay,
        benchmarkShares:
          trade.amount / maps.SXR8.get(tradeDay)
      } : null;
    }).filter(Boolean);

    if (!trades.length) return [];

    const firstDay = trades.reduce(
      (earliest, trade) =>
        earliest < trade.tradeDay ? earliest : trade.tradeDay,
      trades[0].tradeDay
    );

    return dates
      .filter(day => day >= firstDay)
      .map(day => {
        const active = trades.filter(
          trade => trade.tradeDay <= day
        );

        if (!active.length) return null;

        const invested = active.reduce(
          (sum, trade) => sum + trade.amount, 0
        );

        const actualValue = active.reduce(
          (sum, trade) =>
            sum + trade.shares * maps[trade.asset].get(day),
          0
        );

        const benchmarkValue = active.reduce(
          (sum, trade) =>
            sum + trade.benchmarkShares * maps.SXR8.get(day),
          0
        );

        const record = {
          day,
          Portfolio: (actualValue / invested - 1) * 100,
          SXR8: (benchmarkValue / invested - 1) * 100
        };

        for (const asset of OWNED) {
          const buys = active.filter(
            trade => trade.asset === asset
          );

          const cost = buys.reduce(
            (sum, trade) => sum + trade.amount, 0
          );

          record[asset] = cost
            ? (
                buys.reduce(
                  (sum, trade) => sum + trade.shares, 0
                ) * maps[asset].get(day) / cost - 1
              ) * 100
            : null;
        }

        return record;
      })
      .filter(Boolean);
  }

  // INTERACTIVE SVG CHART

  function drawChart() {
    const target = el("pf-chart");
    const market = chartMode === "market";

    const data = market && feed
      ? feed.dates.map(day => ({
          day,
          ...Object.fromEntries(
            SYMBOLS.map(asset => [
              asset,
              feed.maps[asset].get(day)
            ])
          )
        }))
      : seriesData();

    el("pf-legend").querySelectorAll("button").forEach(button => {
      button.disabled =
        market && button.textContent === "Portfolio";

      button.title = button.disabled
        ? "Portfolio is available in Your capital view"
        : "Toggle this series";
    });

    if (!data.length) {
      const title = !feed
        ? "Awaiting market history"
        : !account.trades.length
          ? "Your capital, in perspective."
          : "Comparison needs complete price history";

      const message = !feed
        ? "Refresh to retry the daily closing-price feed."
        : !account.trades.length
          ? "Restore your purchases to compare your portfolio. ETF market returns are available above."
          : "A purchase falls outside the available history. No entry prices have been invented.";

      target.innerHTML = `
        <div class="pf-empty">
          <span class="empty-star">✧</span>
          <strong>${title}</strong>
          <p>${message}</p>
          ${
            feed && !account.trades.length
              ? '<a href="#pf-trades">Restore your portfolio ↗</a>'
              : ""
          }
        </div>
      `;

      el("pf-readout").textContent = "";
      el("pf-chart-note").textContent =
        "Actual closing prices only. SXR8 is a benchmark, " +
        "never an owned holding.";
      return;
    }

    const final = data.at(-1).day;
    const limit = new Date(final + "T12:00:00Z");
    const months = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };

    if (months[range]) {
      limit.setUTCMonth(limit.getUTCMonth() - months[range]);
    }

    const cutoff = limit.toISOString().slice(0, 10);

    let points = range === "ALL"
      ? data
      : data.filter(point => point.day >= cutoff);

    if (market) {
      const base = points[0];

      points = points.map(point => ({
        day: point.day,
        ...Object.fromEntries(
          SYMBOLS.map(asset => [
            asset,
            (point[asset] / base[asset] - 1) * 100
          ])
        )
      }));
    }

    const chosen = [...visible].filter(
      asset => !market || asset !== "Portfolio"
    );

    const values = points.flatMap(point =>
      chosen.map(asset => point[asset]).filter(Number.isFinite)
    );

    if (!values.length) {
      target.innerHTML =
        '<div class="pf-empty">Select at least one series above.</div>';
      el("pf-readout").textContent = "";
      return;
    }

    const minimum = Math.min(0, ...values);
    const maximum = Math.max(0, ...values);
    const padding = Math.max(.5, (maximum - minimum) * .13);
    const low = minimum - padding;
    const high = maximum + padding;

    const width = Math.max(300, target.clientWidth || 900);
    const height = width < 520 ? 285 : 340;
    const left = 48;
    const right = 16;
    const top = 18;
    const bottom = 34;

    const firstTime = Date.parse(points[0].day);
    const lastTime = Date.parse(final);

    const x = index =>
      left + (width - left - right) *
      (Date.parse(points[index].day) - firstTime) /
      Math.max(1, lastTime - firstTime);

    const y = value =>
      top + (height - top - bottom) *
      (high - value) / (high - low);

    let svg = "";

    for (let index = 0; index <= 4; index++) {
      const value = low + (high - low) * index / 4;

      svg += `
        <line
          x1="${left}" x2="${width - right}"
          y1="${y(value)}" y2="${y(value)}"
          stroke="#7299b31b"
        />
        <text
          x="${left - 9}" y="${y(value) + 4}"
          text-anchor="end" fill="#8da5b9" font-size="10"
        >${value.toFixed(1)}%</text>
      `;
    }

    svg += `
      <line
        x1="${left}" x2="${width - right}"
        y1="${y(0)}" y2="${y(0)}"
        stroke="#7299b34d" stroke-dasharray="3 5"
      />
    `;

    chosen.forEach(asset => {
      let path = "";
      let active = false;

      points.forEach((point, index) => {
        if (Number.isFinite(point[asset])) {
          path +=
            `${active ? "L" : "M"}` +
            `${x(index).toFixed(2)},${y(point[asset]).toFixed(2)} `;
          active = true;
        } else {
          active = false;
        }
      });

      svg += `
        <path
          class="chart-line" pathLength="1"
          d="${path}" fill="none"
          stroke="${COLORS[asset]}"
          stroke-width="${asset === "Portfolio" ? 2.5 : 1.7}"
          stroke-linejoin="round" stroke-linecap="round"
        />
      `;

      const end = points.at(-1)[asset];

      if (Number.isFinite(end)) {
        svg += `
          <circle
            cx="${x(points.length - 1)}" cy="${y(end)}"
            r="3" fill="${COLORS[asset]}"
          />
        `;
      }
    });

    const labelIndexes = [...new Set([
      0,
      Math.floor((points.length - 1) / 2),
      points.length - 1
    ])];

    for (const index of labelIndexes) {
      const anchor = index === 0
        ? "start"
        : index === points.length - 1 ? "end" : "middle";

      svg += `
        <text
          x="${x(index)}" y="${height - 8}"
          text-anchor="${anchor}"
          fill="#8da5b9" font-size="10"
        >${points[index].day}</text>
      `;
    }

    svg += `
      <g id="pf-crosshair" visibility="hidden">
        <line
          id="pf-cross-line"
          y1="${top}" y2="${height - bottom}"
          stroke="#c5e8ff88" stroke-dasharray="3 4"
        />
        ${chosen.map(asset => `
          <circle
            data-dot="${asset}" r="4"
            fill="${COLORS[asset]}"
            stroke="#08101b" stroke-width="2"
          />
        `).join("")}
      </g>
    `;

    target.innerHTML = `
      <svg
        viewBox="0 0 ${width} ${height}"
        role="img"
        aria-label="${market ? "ETF price returns" : "Profit relative to contributions"} history"
      >${svg}</svg>
      <input
        id="pf-scrub" class="chart-scrub"
        type="range" min="0" max="${points.length - 1}"
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
        Math.min(points.length - 1, position)
      );

      const point = points[index];

      el("pf-readout").innerHTML = `
        <time>${point.day}</time>
        ${chosen.map(asset => `
          <span>
            <i style="background:${COLORS[asset]}"></i>
            ${asset === "SXR8" ? "S&P 500" : asset}
            <b>${Number.isFinite(point[asset]) ? pct(point[asset]) : "—"}</b>
          </span>
        `).join("")}
      `;

      el("pf-crosshair").setAttribute(
        "visibility",
        cross ? "visible" : "hidden"
      );

      el("pf-cross-line").setAttribute("x1", x(index));
      el("pf-cross-line").setAttribute("x2", x(index));

      target.querySelectorAll("[data-dot]").forEach(dot => {
        const value = point[dot.dataset.dot];

        dot.setAttribute(
          "visibility",
          Number.isFinite(value) ? "visible" : "hidden"
        );

        if (Number.isFinite(value)) {
          dot.setAttribute("cx", x(index));
          dot.setAttribute("cy", y(value));
        }
      });

      el("pf-scrub").value = index;

      el("pf-scrub").setAttribute(
        "aria-valuetext",
        `${point.day}. ` + chosen.map(asset =>
          `${asset}: ${
            Number.isFinite(point[asset])
              ? pct(point[asset])
              : "unavailable"
          }`
        ).join(". ")
      );
    }

    const plot = target.querySelector("svg");
    let frame = 0;
    let pendingX = 0;

    function scrub(event) {
      pendingX = event.clientX;
      if (frame) return;

      frame = requestAnimationFrame(() => {
        frame = 0;

        const rect = plot.getBoundingClientRect();
        const position =
          (pendingX - rect.left) / rect.width * width;

        let closest = 0;

        for (let index = 1; index < points.length; index++) {
          if (
            Math.abs(x(index) - position) <
            Math.abs(x(closest) - position)
          ) {
            closest = index;
          }
        }

        show(closest);
      });
    }

    plot.addEventListener("pointermove", scrub);

    plot.addEventListener("pointerdown", event => {
      plot.setPointerCapture(event.pointerId);
      scrub(event);
    });

    plot.addEventListener("pointerleave", () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      show(points.length - 1, false);
    });

    el("pf-scrub").addEventListener("input", event => {
      show(Number(event.target.value));
    });

    show(points.length - 1, false);

    el("pf-chart-note").textContent = market
      ? `ETF closing-price returns in EUR, rebased to 0% on ${points[0].day}. ` +
        `These are market ETF returns, not your portfolio. History ends ${final}; ` +
        "selected windows are limited to available data."
      : "Cumulative profit ÷ contributed capital, not time-weighted return. " +
        `Window starts ${points[0].day}; returns remain since first purchase. ` +
        "SXR8 receives the same amounts on the same dates, priced at the next " +
        "available common close. Benchmark excludes fees and taxes; portfolio " +
        "includes only costs in saved purchase amounts. No intraday valuation is assumed.";
  }

  // IMPORT AND BACKUP

  function importCsv() {
    try {
      const raw = el("pf-csv").value.trim();
      const imported = raw.startsWith("{")
        ? JSON.parse(raw)
        : null;

      const trades = imported
        ? NorthstarFinance.validateTrades(imported.trades)
        : NorthstarFinance.parseCsv(raw);

      const next = imported
        ? { ...imported, trades }
        : { ...account, trades };

      if (!confirm(
        `Save ${trades.length} purchases in this browser? ` +
        "This replaces the current portfolio. " +
        "Export a backup first if needed."
      )) {
        return;
      }

      // Persist successfully before changing in-memory state.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      account = next;
      document.body.removeAttribute("data-storage-error");
      el("pf-csv").value = "";

      el("pf-message").textContent =
        `${trades.length} purchases saved privately in this browser.`;

      render();
    } catch (error) {
      el("pf-message").textContent = error.message;
    }
  }

  function downloadBackup(content, extension, type) {
    const url = URL.createObjectURL(
      new Blob([content], { type })
    );

    const link = document.createElement("a");
    link.href = url;

    link.download =
      `northstar-portfolio-${new Date().toISOString().slice(0, 10)}.${extension}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportCsv() {
    downloadBackup(
      NorthstarFinance.toCsv(account.trades),
      "csv",
      "text/csv;charset=utf-8"
    );
  }

  function exportJson() {
    try {
      downloadBackup(
        localStorage.getItem(STORAGE_KEY) || JSON.stringify(account),
        "json",
        "application/json"
      );
    } catch {
      el("pf-message").textContent =
        "Browser storage is inaccessible.";
    }
  }

  // INTERFACE

  function initialize() {
    const host = el("view-investments");

    if (!host || el("pf-root")) return;

    const root = document.createElement("div");
    root.id = "pf-root";

    root.innerHTML = `
      <div class="pf-micro">
        NORTHSTAR / INVESTMENT INTELLIGENCE 002
      </div>
      <h1>My Portfolio<span style="color:#56d5ef">.</span></h1>
      <p class="pf-sub">
        Actual purchases · VWCE + VFEA · S&P 500 benchmark
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
          <span class="pf-micro">HISTORY / XETRA EUR</span>
        </div>

        <div
          class="pf-controls pf-modes"
          id="pf-modes"
          aria-label="Return calculation"
        >
          <button
            type="button" data-mode="capital"
            class="active" aria-pressed="true"
          >Your capital</button>
          <button
            type="button" data-mode="market"
            aria-pressed="false"
          >ETF market returns</button>
        </div>

        <div class="pf-controls" id="pf-legend"></div>

        <div class="pf-controls" id="pf-periods">
          <button data-range="1M" type="button" aria-pressed="false">1M</button>
          <button data-range="3M" type="button" aria-pressed="false">3M</button>
          <button data-range="6M" type="button" aria-pressed="false">6M</button>
          <button data-range="1Y" type="button" aria-pressed="false">1Y</button>
          <button data-range="ALL" type="button" class="active" aria-pressed="true">ALL</button>
        </div>

        <div id="pf-readout" class="pf-readout" aria-live="off"></div>
        <div id="pf-chart"></div>
        <p id="pf-chart-note" class="pf-sub"></p>
      </section>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Automatic Market Prices</h2>
          <button type="button" id="pf-refresh">REFRESH DATA ↻</button>
        </div>
        <p class="pf-sub" id="pf-feed">Connecting to market data…</p>
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
          P/L uses the saved purchase amounts and full saved
          share precision. It may differ slightly from your
          brokers and excludes costs not captured in those amounts.
        </p>
      </section>

      <section class="pf-panel">
        <div class="pf-top">
          <h2>Transaction History</h2>
          <span class="pf-micro">PRIVATE / THIS BROWSER</span>
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
          <summary>Import or restore purchases</summary>
          <p class="pf-sub">
            Choose a CSV or JSON backup, or paste CSV below.
            Import replaces purchases only after confirmation.
            Nothing is uploaded to GitHub.
          </p>
          <label class="file-label">
            Choose backup
            <input
              id="pf-file" type="file"
              accept=".csv,.json,text/csv,application/json"
            >
          </label>
          <label for="pf-csv">Backup contents</label>
          <textarea
            id="pf-csv"
            placeholder="date,asset,invested,shares,price,broker"
          ></textarea>
          <button id="pf-import" type="button">
            IMPORT TRANSACTIONS
          </button>
        </details>

        <button id="pf-json" type="button">EXPORT JSON BACKUP ↓</button>
        <button id="pf-backup" type="button">EXPORT CSV ↓</button>

        <p class="pf-sub" id="pf-message" aria-live="polite">
          Your transactions are stored only in this browser.
          Save a backup.
        </p>
      </section>
    `;

    host.appendChild(root);
    document.dispatchEvent(new Event("northstar:ready"));

    el("pf-json").addEventListener("click", exportJson);

    el("pf-file").addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;

      if (file.size > 1048576) {
        el("pf-message").textContent = "Backup exceeds 1 MB.";
        return;
      }

      try {
        el("pf-csv").value = await file.text();
      } catch {
        el("pf-message").textContent = "Unable to read backup file.";
      }

      event.target.value = "";
    });

    el("pf-modes").addEventListener("click", event => {
      const button = event.target.closest("[data-mode]");
      if (!button) return;

      chartMode = button.dataset.mode;

      el("pf-modes").querySelectorAll("button").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });

      drawChart();
    });

    for (const asset of Object.keys(COLORS)) {
      const button = document.createElement("button");

      button.textContent = asset;
      button.className = "active";
      button.type = "button";
      button.style.borderLeft = `4px solid ${COLORS[asset]}`;
      button.setAttribute("aria-pressed", "true");

      button.addEventListener("click", () => {
        if (visible.has(asset)) {
          visible.delete(asset);
        } else {
          visible.add(asset);
        }

        button.classList.toggle("active", visible.has(asset));
        button.setAttribute(
          "aria-pressed",
          String(visible.has(asset))
        );

        drawChart();
      });

      el("pf-legend").appendChild(button);
    }

    el("pf-periods").addEventListener("click", event => {
      const button = event.target.closest("button[data-range]");
      if (!button) return;

      range = button.dataset.range;

      el("pf-periods").querySelectorAll("button").forEach(item => {
        item.classList.toggle("active", item === button);
        item.setAttribute("aria-pressed", String(item === button));
      });

      drawChart();
    });

    el("pf-import").addEventListener("click", importCsv);
    el("pf-backup").addEventListener("click", exportCsv);
    el("pf-refresh").addEventListener("click", refreshPrices);

    let resizeTimer;
    let lastWidth = 0;

    new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      if (width === lastWidth) return;

      lastWidth = width;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(drawChart, 120);
    }).observe(el("pf-chart"));

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
