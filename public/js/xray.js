
/*
  NORTHSTAR — PORTFOLIO X-RAY
  Homepage geographic exposure preview.

  The full interactive experience lives in:
  ./xray.html

  Read-only. Never modifies saved transactions.
*/

(() => {
  "use strict";

  const ASSETS = ["VWCE", "VFEA"];
  const DATA_URL = "./data/country-exposure.json";

  const FALLBACK = {
    funds: {
      VWCE: {
        asOf: "2026-09-30",
        countries: {
          "United States": 62.24,
          "Japan": 6.06,
          "Taiwan": 3.54,
          "United Kingdom": 3.12,
          "Canada": 2.91,
          "China": 2.67,
          "South Korea": 2.60,
          "France": 1.89,
          "Switzerland": 1.88,
          "Germany": 1.78,
          "Australia": 1.53,
          "India": 1.50,
          "Netherlands": 1.18,
          "Spain": 0.84,
          "Italy": 0.75
        }
      },

      VFEA: {
        asOf: "2026-09-30",
        countries: {
          "Taiwan": 35.36,
          "China": 26.66,
          "India": 15.07,
          "Brazil": 4.48,
          "South Africa": 3.66,
          "Saudi Arabia": 3.10,
          "Mexico": 2.07,
          "United Arab Emirates": 1.72,
          "Malaysia": 1.51,
          "Thailand": 1.46,
          "Turkey": 0.79,
          "Indonesia": 0.68,
          "Kuwait": 0.66,
          "Chile": 0.65,
          "Qatar": 0.58
        }
      }
    }
  };

  const $ = id => document.getElementById(id);

  const euro = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  });

  const number = new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const money = value =>
    Number.isFinite(value) ? euro.format(value) : "—";

  const pct = value =>
    Number.isFinite(value)
      ? number.format(value) + "%"
      : "—";

  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  let issuer = null;
  let portfolio = null;
  let root = null;

  let sourceStatus = "Verified Vanguard snapshot";

  /* ==========================================
     COUNTRY DATA VALIDATION
     ========================================== */

  function validateCountryData(payload) {
    if (!payload || !payload.funds) {
      throw Error("Missing country allocations");
    }

    const result = {
      funds: {}
    };

    for (const asset of ASSETS) {
      const fund = payload.funds[asset];

      if (
        !fund ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fund.asOf || "") ||
        !fund.countries
      ) {
        throw Error("Invalid ETF country data");
      }

      const countries = {};
      let total = 0;

      for (const [name, raw] of Object.entries(
        fund.countries
      )) {
        const weight = Number(raw);

        if (
          !name ||
          !Number.isFinite(weight) ||
          weight < 0 ||
          weight > 100
        ) {
          throw Error("Invalid country weight");
        }

        countries[name] = weight;
        total += weight;
      }

      if (total < 80 || total > 100.3) {
        throw Error("Country weights failed validation");
      }

      if (!("Other markets" in countries)) {
        countries["Other markets"] =
          Math.max(0, 100 - total);
      }

      result.funds[asset] = {
        asOf: fund.asOf,
        countries
      };
    }

    return result;
  }

  issuer = validateCountryData(FALLBACK);

  /* ==========================================
     PORTFOLIO LOOK-THROUGH
     ========================================== */

  function calculate() {
    const market =
      Number.isFinite(portfolio?.value) &&
      portfolio.value > 0;

    const amounts = {};

    for (const asset of ASSETS) {
      const holding = portfolio?.rows?.[asset];

      const amount = market
        ? holding?.value
        : holding?.invested;

      amounts[asset] =
        Number.isFinite(amount) && amount > 0
          ? amount
          : 0;
    }

    const total =
      amounts.VWCE + amounts.VFEA;

    const countries = new Map();

    if (total > 0) {
      for (const asset of ASSETS) {
        const factor = amounts[asset] / total;

        for (const [name, weight] of Object.entries(
          issuer.funds[asset].countries
        )) {
          const row = countries.get(name) || {
            name,
            weight: 0,
            parts: {
              VWCE: 0,
              VFEA: 0
            }
          };

          const contribution =
            factor * weight;

          row.weight += contribution;
          row.parts[asset] += contribution;

          countries.set(name, row);
        }
      }
    }

    return {
      rows: [...countries.values()]
        .filter(row => row.weight > 0.000001)
        .sort((a, b) => b.weight - a.weight),

      total,
      market,
      hasHoldings: total > 0
    };
  }

  /* ==========================================
     DATES
     ========================================== */

  function asOfLabel() {
    const dates = ASSETS.map(
      asset => issuer.funds[asset].asOf
    ).sort();

    const date = dates[0];

    const formatted = new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC"
      }
    ).format(new Date(date + "T12:00:00Z"));

    return formatted;
  }

  /* ==========================================
     NAVIGATION
     ========================================== */

  function addNavigation() {
    const nav = document.querySelector(".nav");

    if (!nav) return;

    if (
      nav.querySelector('a[href="./xray.html"]')
    ) {
      return;
    }

    const link = document.createElement("a");

    link.href = "./xray.html";
    link.innerHTML = "<span>04</span> X-Ray";

    link.setAttribute(
      "aria-label",
      "Open Portfolio X-Ray world map"
    );

    const goal = nav.querySelector(
      'a[href="#goal-section"]'
    );

    const holdings = nav.querySelector(
      'a[href="#pf-holdings"]'
    );

    if (goal) {
      goal.after(link);
    } else if (holdings) {
      holdings.before(link);
    } else {
      nav.append(link);
    }

    if (holdings) {
      holdings.innerHTML =
        "<span>05</span> Holdings";
    }

    const ledgerNumber = nav.querySelector(
      ".goal-nav > span"
    );

    if (ledgerNumber) {
      ledgerNumber.textContent = "06";
    }

    const holdingsSection =
      document.getElementById("pf-holdings")
        ?.closest("section");

    const coordinate =
      holdingsSection?.querySelector(
        ".section-coordinate"
      );

    if (coordinate) {
      coordinate.textContent =
        "05 / HOLDINGS";
    }
  }

  /* ==========================================
     HOMEPAGE PREVIEW
     ========================================== */

  function build() {
    if (
      root ||
      document.getElementById("portfolio-xray")
    ) {
      return;
    }

    root = document.createElement("section");

    root.id = "portfolio-xray";
    root.className = "nxp-card";

    root.setAttribute(
      "aria-labelledby",
      "nxp-title"
    );

    root.innerHTML = `
      <div class="nxp-topline">

        <span>
          <i class="nxp-indicator"></i>
          NORTHSTAR / GEOGRAPHIC INTELLIGENCE
        </span>

        <span id="nxp-date">
          VERIFYING ISSUER DATA…
        </span>

      </div>

      <div class="nxp-grid">

        <div class="nxp-copy">

          <div class="nxp-eyebrow">
            04 / PORTFOLIO X-RAY
          </div>

          <h2 id="nxp-title">
            Invested worldwide.<br>
            <em>Understand it locally.</em>
          </h2>

          <p class="nxp-description">
            Look beyond your ETF names.
            Discover the countries behind your
            investments and explore where your
            capital is really allocated.
          </p>

          <a
            class="nxp-action"
            href="./xray.html"
          >

            EXPLORE THE WORLD MAP

            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path
                d="M3 13L13 3M3 3h10v10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.4"
              />
            </svg>

          </a>

        </div>

        <div class="nxp-preview">

          <div class="nxp-preview-heading">

            <div>
              <span>YOUR GLOBAL FOOTPRINT</span>
              <strong>Top country exposures</strong>
            </div>

            <span class="nxp-preview-index">
              01 — 03
            </span>

          </div>

          <div
            id="nxp-countries"
            class="nxp-countries"
            aria-live="polite"
          >
            <div class="nxp-empty">
              Connecting to portfolio data…
            </div>
          </div>

          <div class="nxp-preview-footer">

            <div class="nxp-legend">
              <span>
                <i class="nxp-world-dot"></i>
                VWCE
              </span>

              <span>
                <i class="nxp-emerging-dot"></i>
                VFEA
              </span>
            </div>

            <span id="nxp-basis">
              AWAITING VALUATION
            </span>

          </div>

        </div>

      </div>

      <div class="nxp-bottomline">

        <span id="nxp-source">
          VERIFIED VANGUARD COUNTRY ALLOCATIONS
        </span>

        <span>
          FULL ANALYSIS / INTERACTIVE ATLAS ↗
        </span>

      </div>
    `;

    const goal = document.getElementById(
      "goal-section"
    );

    const chart = document.getElementById(
      "pf-chart"
    )?.closest("section");

    const portfolioRoot = document.getElementById(
      "pf-root"
    );

    if (goal) {
      goal.after(root);
    } else if (chart) {
      chart.after(root);
    } else if (portfolioRoot) {
      portfolioRoot.prepend(root);
    } else {
      root = null;
      return;
    }

    addNavigation();
    render();
  }

  /* ==========================================
     PREVIEW RENDERING
     ========================================== */

  function render() {
    if (!root) return;

    const result = calculate();

    $("nxp-date").textContent =
      "COUNTRY DATA / " +
      asOfLabel().toUpperCase();

    $("nxp-source").textContent =
      sourceStatus.toUpperCase() +
      " · OTHER MARKETS GROUPED";

    $("nxp-basis").textContent =
      result.market
        ? "MARKET VALUE BASIS"
        : "INVESTED CAPITAL BASIS";

    const target = $("nxp-countries");

    if (!result.hasHoldings) {
      target.innerHTML = `
        <div class="nxp-empty">

          <span class="nxp-empty-symbol">✧</span>

          <strong>
            Your geography starts here.
          </strong>

          <p>
            Add VWCE or VFEA purchases in your
            Ledger to reveal your actual
            country exposure.
          </p>

        </div>
      `;

      $("nxp-basis").textContent =
        "NO HOLDINGS SAVED";

      return;
    }

    const top = result.rows
      .filter(row => row.name !== "Other markets")
      .slice(0, 3);

    const maximum = Math.max(
      1,
      ...top.map(row => row.weight)
    );

    target.innerHTML = top.map((row, index) => {
      const worldWidth = Math.max(
        0,
        Math.min(
          100,
          row.parts.VWCE / maximum * 100
        )
      );

      const emergingWidth = Math.max(
        0,
        Math.min(
          100,
          row.parts.VFEA / maximum * 100
        )
      );

      const estimatedValue =
        result.total * row.weight / 100;

      return `
        <div class="nxp-country">

          <div class="nxp-country-heading">

            <span class="nxp-country-name">

              <small>
                ${String(index + 1).padStart(2, "0")}
              </small>

              ${escapeHtml(row.name)}

            </span>

            <strong>
              ${pct(row.weight)}
            </strong>

          </div>

          <div
            class="nxp-country-track"
            aria-hidden="true"
          >

            <i
              class="nxp-country-world"
              style="width:${worldWidth}%"
            ></i>

            <i
              class="nxp-country-emerging"
              style="width:${emergingWidth}%"
            ></i>

          </div>

          <div class="nxp-country-value">
            <span>
              IMPLIED EXPOSURE
            </span>

            <span>
              ${money(estimatedValue)}
            </span>
          </div>

        </div>
      `;
    }).join("");
  }

  /* ==========================================
     ISSUER DATA REFRESH
     ========================================== */

  async function refreshIssuer() {
    try {
      const response = await fetch(DATA_URL, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw Error(
          "Issuer feed HTTP " + response.status
        );
      }

      issuer = validateCountryData(
        await response.json()
      );

      sourceStatus =
        "Automated Vanguard disclosure";

    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray preview:",
        error
      );

      sourceStatus =
        "Verified September 2026 snapshot";
    }

    render();
  }

  /* ==========================================
     DARK NORTHSTAR DESIGN
     ========================================== */

  const style = document.createElement("style");

  style.id = "northstar-xray-preview-style";

  style.textContent = `

    #portfolio-xray.nxp-card {
      position: relative;
      isolation: isolate;

      margin: 26px 0 35px;

      color: #edf0f3;

      border: 1px solid #a4b5c52a;

      background:
        linear-gradient(
          135deg,
          #111b28ed 0%,
          #0a111bed 58%,
          #0c141eed 100%
        );

      overflow: hidden;
    }

    #portfolio-xray.nxp-card::before {
      content: "";

      position: absolute;
      z-index: -1;

      width: 440px;
      height: 440px;

      right: -230px;
      top: -240px;

      border: 1px solid #cdb78c1e;
      border-radius: 50%;

      box-shadow:
        0 0 0 55px #cdb78c04,
        0 0 0 110px #cdb78c03;

      pointer-events: none;
    }

    #portfolio-xray *,
    #portfolio-xray *::before,
    #portfolio-xray *::after {
      box-sizing: border-box;
    }

    /* TOP COORDINATE */

    .nxp-topline,
    .nxp-bottomline {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;

      gap: 10px 25px;

      padding: 16px 28px;

      color: #718397;

      font: 8px/1.7 var(--mono, monospace);
      letter-spacing: .12em;
    }

    .nxp-topline {
      border-bottom: 1px solid #a4b5c51c;
    }

    .nxp-topline > span:first-child {
      display: inline-flex;
      align-items: center;
      gap: 11px;

      color: #aaaeaa;
    }

    .nxp-indicator {
      display: inline-block;

      width: 5px;
      height: 5px;

      border-radius: 50%;
      background: #cdb78c;

      box-shadow: 0 0 12px #cdb78c45;
    }

    /* TWO COLUMN LAYOUT */

    .nxp-grid {
      display: grid;

      grid-template-columns:
        minmax(0, 1.05fr)
        minmax(0, .95fr);

      min-height: 330px;
    }

    /* INTRODUCTION */

    .nxp-copy {
      min-width: 0;

      padding:
        clamp(28px, 3.7vw, 53px)
        clamp(24px, 3.7vw, 53px);

      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .nxp-eyebrow {
      margin-bottom: 18px;

      color: #cdb78c;

      font: 9px/1.6 var(--mono, monospace);
      letter-spacing: .15em;
    }

    #portfolio-xray h2 {
      margin: 0;

      color: #edf0f3;

      font-family: Georgia, "Times New Roman", serif;
      font-size: clamp(30px, 3.3vw, 47px);
      font-weight: 400;
      line-height: 1.14;
      letter-spacing: -.045em;
    }

    #portfolio-xray h2 em {
      color: #a6b3c0;
      font-weight: 400;
    }

    .nxp-description {
      max-width: 425px;

      margin: 20px 0 27px;

      color: #96a5b4;
      font-size: 12px;
      line-height: 1.85;
    }

    /* CTA */

    .nxp-action {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      gap: 23px;

      min-height: 45px;
      padding: 12px 16px;

      border: 1px solid #cdb78c;

      background: #cdb78c;
      color: #171b1f;

      font: 9px/1.5 var(--mono, monospace);
      font-weight: 600;
      letter-spacing: .075em;

      text-decoration: none;

      transition:
        background .2s ease,
        color .2s ease,
        transform .2s ease;
    }

    .nxp-action:hover {
      background: #ead5ac;
      border-color: #ead5ac;
      color: #10161a;

      transform: translateY(-2px);
    }

    .nxp-action:focus-visible {
      outline: 2px solid #99dce4;
      outline-offset: 4px;
    }

    /* RIGHT PREVIEW */

    .nxp-preview {
      min-width: 0;

      display: flex;
      flex-direction: column;

      padding: 29px 30px 23px;

      border-left: 1px solid #a4b5c521;

      background: #080f18a8;
    }

    .nxp-preview-heading {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;

      padding-bottom: 21px;
      border-bottom: 1px solid #a4b5c523;
    }

    .nxp-preview-heading > div > span {
      display: block;

      color: #9daaaf;

      font: 8px/1.6 var(--mono, monospace);
      letter-spacing: .14em;
    }

    .nxp-preview-heading strong {
      display: block;

      margin-top: 8px;

      color: #e9edef;

      font-family: Georgia, serif;
      font-size: 21px;
      font-weight: 400;
    }

    .nxp-preview-index {
      color: #6d7e90;

      font: 8px/1.6 var(--mono, monospace);
      white-space: nowrap;
    }

    .nxp-countries {
      display: grid;
      align-content: center;
      flex: 1;
      gap: 16px;

      padding: 22px 0;
    }

    /* COUNTRY ROW */

    .nxp-country {
      min-width: 0;
    }

    .nxp-country-heading {
      display: flex;
      justify-content: space-between;
      align-items: center;

      gap: 15px;
    }

    .nxp-country-name {
      display: flex;
      align-items: center;
      gap: 12px;

      color: #d6e2e9;
      font-size: 12px;
    }

    .nxp-country-name small {
      color: #667b8c;
      font: 8px var(--mono, monospace);
    }

    .nxp-country-heading > strong {
      color: #e7edf0;

      font: 11px var(--mono, monospace);
      font-variant-numeric: tabular-nums;
    }

    .nxp-country-track {
      display: flex;
      width: 100%;
      height: 4px;

      margin-top: 10px;

      background: #253440;
      overflow: hidden;
    }

    .nxp-country-track i {
      display: block;
      height: 100%;
      flex: 0 0 auto;

      transition: width .35s ease;
    }

    .nxp-country-world {
      background: #99dce4;
    }

    .nxp-country-emerging {
      background: #cdb78c;
    }

    .nxp-country-value {
      display: flex;
      justify-content: space-between;

      gap: 12px;
      margin-top: 7px;

      color: #738697;

      font: 8px/1.6 var(--mono, monospace);
      letter-spacing: .045em;
    }

    .nxp-country-value span:last-child {
      color: #9baab5;
      font-variant-numeric: tabular-nums;
    }

    /* EMPTY PORTFOLIO */

    .nxp-empty {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      justify-content: center;

      min-height: 190px;

      color: #91a0af;
      font-size: 12px;
      line-height: 1.7;
    }

    .nxp-empty-symbol {
      margin-bottom: 14px;

      color: #cdb78c;
      font-size: 30px;
    }

    .nxp-empty strong {
      color: #e3e9ed;

      font-family: Georgia, serif;
      font-size: 23px;
      font-weight: 400;
    }

    .nxp-empty p {
      max-width: 270px;
      margin: 10px 0 0;

      color: #8e9fad;
      font-size: 11px;
    }

    /* RIGHT FOOTER */

    .nxp-preview-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;

      gap: 12px;

      padding-top: 16px;

      border-top: 1px solid #a4b5c523;
    }

    .nxp-legend {
      display: flex;
      align-items: center;
      gap: 17px;
    }

    .nxp-legend > span {
      display: inline-flex;
      align-items: center;
      gap: 6px;

      color: #8295a4;

      font: 8px var(--mono, monospace);
    }

    .nxp-legend i {
      width: 7px;
      height: 7px;

      border-radius: 2px;
    }

    .nxp-world-dot {
      background: #99dce4;
    }

    .nxp-emerging-dot {
      background: #cdb78c;
    }

    #nxp-basis {
      color: #728696;

      font: 8px/1.5 var(--mono, monospace);
      letter-spacing: .05em;
    }

    /* BOTTOM COORDINATE */

    .nxp-bottomline {
      padding: 15px 28px;

      border-top: 1px solid #a4b5c521;
    }

    .nxp-bottomline > span:last-child {
      color: #c3b18f;
    }

    /* TABLET */

    @media (max-width: 1000px) {

      .nxp-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .nxp-preview {
        border-left: 0;
        border-top: 1px solid #a4b5c521;

        padding: 25px 28px;
      }

      .nxp-copy {
        padding: 33px 28px;
      }

      #portfolio-xray h2 {
        font-size: clamp(32px, 4.5vw, 44px);
      }

      .nxp-countries {
        max-width: 600px;
      }
    }

    /* MOBILE */

    @media (max-width: 620px) {

      #portfolio-xray.nxp-card {
        margin: 20px 0 28px;
      }

      .nxp-topline,
      .nxp-bottomline {
        padding: 14px 17px;
        font-size: 7px;
      }

      .nxp-copy {
        padding: 28px 18px;
      }

      .nxp-eyebrow {
        font-size: 8px;
      }

      #portfolio-xray h2 {
        font-size: 33px;
      }

      .nxp-description {
        font-size: 12px;
        margin: 17px 0 24px;
      }

      .nxp-action {
        width: 100%;
        justify-content: space-between;
      }

      .nxp-preview {
        padding: 24px 18px;
      }

      .nxp-preview-heading strong {
        font-size: 20px;
      }

      .nxp-preview-footer {
        gap: 12px;
      }

      .nav a[href="./xray.html"] {
        white-space: nowrap;
      }
    }

    @media (prefers-reduced-motion: reduce) {

      .nxp-action,
      .nxp-country-track i {
        transition: none;
      }
    }

  `;

  document.head.append(style);

  /* ==========================================
     EVENT CONNECTIONS
     ========================================== */

  document.addEventListener(
    "northstar:ready",
    () => {
      build();
      refreshIssuer();
    },
    { once: true }
  );

  document.addEventListener(
    "northstar:summary",
    event => {
      portfolio = event.detail;
      render();
    }
  );

})();
