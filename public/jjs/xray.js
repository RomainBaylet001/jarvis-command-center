
/*
  NORTHSTAR — PORTFOLIO X-RAY
  Geographic look-through for VWCE and VFEA.
  Read-only: never changes transactions.
*/
(() => {
  "use strict";

  const ASSETS = ["VWCE", "VFEA"];
  const DATA_URL = "./data/country-exposure.json";

  const SOURCES = {
    VWCE: "https://global.vanguard.com/it-it/investment-products/etf/equities/9679/ftse-all-world-ucits-etf-usd-accumulating-usd-accumulating",
    VFEA: "https://global.vanguard.com/it-it/investment-products/etf/equities/9678/ftse-emerging-markets-ucits-etf-usd-accumulating"
  };

  // Official Vanguard disclosures, 30 September 2026.
  // The published market table lists the 15 largest
  // countries. The remainder is labelled "Other markets".
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

  const REGIONS = {
    "North America": [
      "United States", "Canada"
    ],
    "Europe": [
      "United Kingdom", "France", "Switzerland",
      "Germany", "Netherlands", "Spain", "Italy"
    ],
    "Asia-Pacific": [
      "Japan", "Taiwan", "China", "South Korea",
      "India", "Australia", "Malaysia",
      "Thailand", "Indonesia"
    ],
    "Latin America": [
      "Brazil", "Mexico", "Chile"
    ],
    "Middle East & Africa": [
      "South Africa", "Saudi Arabia",
      "United Arab Emirates", "Turkey",
      "Kuwait", "Qatar"
    ]
  };

  const REGION_COLORS = {
    "North America": "#24566b",
    "Europe": "#7799a6",
    "Asia-Pacific": "#b99a6c",
    "Latin America": "#6e9d90",
    "Middle East & Africa": "#b67d72",
    "Other markets": "#d9d3c7"
  };

  const euro = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  });

  const number = new Intl.NumberFormat("en-IE", {
    maximumFractionDigits: 2
  });

  const money = value =>
    Number.isFinite(value) ? euro.format(value) : "—";

  const pct = value => number.format(value) + "%";

  const escapeHtml = value =>
    String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const dateLabel = iso => {
    const date = new Date(iso + "T12:00:00Z");

    return Number.isNaN(date.getTime())
      ? "Unknown"
      : new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "UTC"
        }).format(date);
  };

  let issuer = null;
  let portfolio = null;
  let root = null;
  let mode = "ALL";
  let grouping = "country";
  let expanded = false;
  let selected = "";
  let dataStatus = "Verified issuer snapshot";

  function validateData(payload) {
    if (!payload || !payload.funds) return null;

    const result = { funds: {} };

    for (const asset of ASSETS) {
      const fund = payload.funds[asset];

      if (
        !fund ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fund.asOf || "") ||
        !fund.countries
      ) return null;

      let total = 0;
      const countries = {};

      for (const [country, raw] of Object.entries(
        fund.countries
      )) {
        const weight = Number(raw);

        if (
          !country ||
          !Number.isFinite(weight) ||
          weight < 0 ||
          weight > 100
        ) return null;

        countries[country] = weight;
        total += weight;
      }

      if (total < 80 || total > 100.3) return null;

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

  issuer = validateData(FALLBACK);

  function regionFor(country) {
    return Object.keys(REGIONS).find(region =>
      REGIONS[region].includes(country)
    ) || "Other markets";
  }

  function getValues() {
    const rows = portfolio?.rows || {};
    const market = Number.isFinite(portfolio?.value);

    const amounts = {};

    for (const asset of ASSETS) {
      const holding = rows[asset];

      const value = market
        ? holding?.value
        : holding?.invested;

      amounts[asset] =
        Number.isFinite(value) && value > 0
          ? value
          : 0;
    }

    return {
      amounts,
      market,
      total: amounts.VWCE + amounts.VFEA
    };
  }

  function calculate() {
    const valuation = getValues();

    const weights = mode === "ALL"
      ? valuation.amounts
      : {
          VWCE: mode === "VWCE" ? 1 : 0,
          VFEA: mode === "VFEA" ? 1 : 0
        };

    const totalWeight = weights.VWCE + weights.VFEA;
    const countries = new Map();

    if (totalWeight > 0) {
      for (const asset of ASSETS) {
        const factor = weights[asset] / totalWeight;

        for (const [country, weight] of Object.entries(
          issuer.funds[asset].countries
        )) {
          const row = countries.get(country) || {
            name: country,
            weight: 0,
            parts: { VWCE: 0, VFEA: 0 }
          };

          const contribution = factor * weight;

          row.weight += contribution;
          row.parts[asset] += contribution;

          countries.set(country, row);
        }
      }
    }

    const countryRows = [...countries.values()].sort(
      (a, b) => b.weight - a.weight
    );

    const regions = new Map();

    for (const country of countryRows) {
      const name = regionFor(country.name);

      const row = regions.get(name) || {
        name,
        weight: 0,
        parts: { VWCE: 0, VFEA: 0 }
      };

      row.weight += country.weight;

      for (const asset of ASSETS) {
        row.parts[asset] += country.parts[asset];
      }

      regions.set(name, row);
    }

    return {
      countries: countryRows,
      regions: [...regions.values()].sort(
        (a, b) => b.weight - a.weight
      ),
      value: mode === "ALL"
        ? valuation.total
        : valuation.amounts[mode],
      hasHoldings: valuation.total > 0,
      market: valuation.market
    };
  }

  function makeRing(regions) {
    if (!regions.length) {
      return "conic-gradient(#e1e7e3 0% 100%)";
    }

    let position = 0;

    const stops = regions.map(region => {
      const colour =
        REGION_COLORS[region.name] || "#d9d3c7";

      const end = Math.min(
        100,
        position + region.weight
      );

      const segment =
        `${colour} ${position}% ${end}%`;

      position = end;
      return segment;
    });

    return "conic-gradient(" + stops.join(",") + ")";
  }

  function render() {
    if (!root) return;

    const result = calculate();

    const rows = grouping === "country"
      ? result.countries
      : result.regions;

    const mainCountries = result.countries.filter(
      item => item.name !== "Other markets"
    );

    const dates = ASSETS.map(
      asset => issuer.funds[asset].asOf
    );

    const oldest = [...dates].sort()[0];

    const daysOld = Math.floor(
      (
        Date.now() -
        Date.parse(oldest + "T12:00:00Z")
      ) / 86400000
    );

    root.querySelector("#nx-asof").textContent =
      dates[0] === dates[1]
        ? dateLabel(oldest)
        : dates.map(dateLabel).join(" / ");

    root.querySelector("#nx-feed").textContent =
      dataStatus +
      (daysOld > 60 ? " · OLD DATA" : "");

    root.querySelector("#nx-feed").dataset.stale =
      String(daysOld > 60);

    root.querySelector("#nx-chart-title").textContent =
      grouping === "country"
        ? "Country exposure"
        : "Regional exposure";

    root.querySelector("#nx-basis").textContent =
      mode !== "ALL"
        ? mode + " / FUND COMPOSITION"
        : !result.hasHoldings
          ? "ADD PURCHASES TO CALCULATE"
          : (
              result.market
                ? "MARKET VALUE / "
                : "INVESTED CAPITAL / "
            ) + money(result.value);

    const stats = root.querySelector("#nx-stats");

    const top = mainCountries.slice(0, 3);

    stats.innerHTML = top.length
      ? top.map((item, index) => `
          <article class="nx-stat">
            <span>
              0${index + 1} /
              ${escapeHtml(item.name.toUpperCase())}
            </span>
            <strong>${pct(item.weight)}</strong>
            <small>
              ${
                result.hasHoldings
                  ? money(result.value * item.weight / 100)
                  : "Fund allocation"
              }
            </small>
          </article>
        `).join("")
      : `<p class="nx-empty">
          Add VWCE or VFEA purchases in Ledger
          to calculate portfolio exposure.
        </p>`;

    root.querySelectorAll("[data-fund]").forEach(
      button => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.fund === mode)
        );
      }
    );

    root.querySelectorAll("[data-group]").forEach(
      button => {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.group === grouping)
        );
      }
    );

    const visible = expanded || grouping === "region"
      ? rows
      : rows.filter(
          item => item.name !== "Other markets"
        ).slice(0, 8);

    const maximum = Math.max(
      1,
      ...rows.map(item => item.weight)
    );

    root.querySelector("#nx-bars").innerHTML =
      visible.length
        ? visible.map(item => {
            const world =
              item.parts.VWCE / maximum * 100;

            const emerging =
              item.parts.VFEA / maximum * 100;

            return `
              <button
                type="button"
                class="nx-line ${
                  item.name === selected ? "chosen" : ""
                }"
                data-item="${escapeHtml(item.name)}"
                aria-pressed="${
                  item.name === selected
                }"
              >
                <span class="nx-country">
                  ${escapeHtml(item.name)}
                </span>
                <span class="nx-rail">
                  <span
                    class="nx-world"
                    style="width:${world}%"
                  ></span>
                  <span
                    class="nx-emerging"
                    style="width:${emerging}%"
                  ></span>
                </span>
                <strong>${pct(item.weight)}</strong>
              </button>
            `;
          }).join("")
        : `<p class="nx-empty">
            No holdings recorded.
            Select VWCE or VFEA to see
            an individual fund breakdown.
          </p>`;

    const more = root.querySelector("#nx-more");

    more.hidden =
      grouping !== "country" || rows.length <= 8;

    more.textContent = expanded
      ? "SHOW FEWER MARKETS ↑"
      : "EXPLORE ALL MARKETS ↓";

    root.querySelector("#nx-ring").style.background =
      makeRing(result.regions);

    root.querySelector("#nx-regions").innerHTML =
      result.regions.map(item => `
        <div>
          <span>
            <i style="background:${
              REGION_COLORS[item.name] || "#d9d3c7"
            }"></i>
            ${escapeHtml(item.name)}
          </span>
          <strong>${pct(item.weight)}</strong>
        </div>
      `).join("");

    const focused =
      rows.find(item => item.name === selected) ||
      rows.find(item => item.name !== "Other markets") ||
      rows[0];

    if (focused) selected = focused.name;

    root.querySelector("#nx-focus").innerHTML =
      focused
        ? `
          <span class="nx-overline">
            SELECTED EXPOSURE
          </span>
          <h4>${escapeHtml(focused.name)}</h4>
          <div class="nx-focus-value">
            ${pct(focused.weight)}
            <small>
              ${
                result.hasHoldings
                  ? money(
                      result.value *
                      focused.weight / 100
                    )
                  : "of the selected allocation"
              }
            </small>
          </div>
          <div class="nx-contributions">
            ${ASSETS.map(asset => `
              <div>
                <span>
                  <i class="nx-dot ${
                    asset === "VWCE"
                      ? "world"
                      : "emerging"
                  }"></i>
                  ${asset}
                </span>
                <strong>
                  ${pct(focused.parts[asset])}
                </strong>
                <small>
                  ${
                    result.hasHoldings
                      ? money(
                          result.value *
                          focused.parts[asset] / 100
                        )
                      : "No position value"
                  }
                </small>
              </div>
            `).join("")}
          </div>
        `
        : "";

    root.querySelector("#nx-note").textContent =
      `Issuer disclosures: VWCE ${dateLabel(dates[0])}; ` +
      `VFEA ${dateLabel(dates[1])}. ` +
      `Other markets includes omitted smaller countries ` +
      `and rounding. Country exposure is based on ` +
      `investee-market classification, not sales revenue. ` +
      `SXR8 benchmark excluded.`;
  }

  function build() {
    if (document.getElementById("portfolio-xray")) {
      return;
    }

    root = document.createElement("section");
    root.id = "portfolio-xray";
    root.className = "nx-section";

    root.setAttribute(
      "aria-labelledby",
      "nx-title"
    );

    root.innerHTML = `
      <div class="section-coordinate">
        04 / PORTFOLIO X-RAY
      </div>

      <div class="nx-shell">
        <div class="nx-eyebrow">
          <span class="nx-spark">✳</span>
          NORTHSTAR / LOOK THROUGH YOUR ETFs
          <span class="nx-reference">NS—04</span>
        </div>

        <div class="nx-intro">
          <div>
            <h2 id="nx-title">
              The geography of
              <em>your wealth.</em>
            </h2>
            <p>
              One portfolio. Thousands of companies.
              A clearer view of where your capital
              is actually invested.
            </p>
          </div>

          <div class="nx-snapshot">
            <span>ISSUER SNAPSHOT</span>
            <strong id="nx-asof">—</strong>
            <small id="nx-feed">
              Loading country data…
            </small>
          </div>
        </div>

        <div class="nx-stats" id="nx-stats"></div>

        <div class="nx-workspace">
          <div class="nx-primary">
            <header class="nx-panel-heading">
              <div>
                <span class="nx-overline">
                  GEOGRAPHIC ALLOCATION
                </span>
                <h3 id="nx-chart-title">
                  Country exposure
                </h3>
              </div>
              <span class="nx-basis" id="nx-basis"></span>
            </header>

            <div class="nx-toolbar">
              <div class="nx-segments">
                <button
                  type="button"
                  data-fund="ALL"
                  aria-pressed="true"
                >Portfolio</button>
                <button
                  type="button"
                  data-fund="VWCE"
                  aria-pressed="false"
                >VWCE</button>
                <button
                  type="button"
                  data-fund="VFEA"
                  aria-pressed="false"
                >VFEA</button>
              </div>

              <div class="nx-segments">
                <button
                  type="button"
                  data-group="country"
                  aria-pressed="true"
                >Countries</button>
                <button
                  type="button"
                  data-group="region"
                  aria-pressed="false"
                >Regions</button>
              </div>
            </div>

            <div class="nx-list-heading">
              <span>MARKET</span>
              <span>EXPOSURE</span>
            </div>

            <div class="nx-bars" id="nx-bars"></div>

            <button
              class="nx-more"
              id="nx-more"
              type="button"
            >
              EXPLORE ALL MARKETS ↓
            </button>

            <div class="nx-legend">
              <span>
                <i class="nx-dot world"></i>
                VWCE / World
              </span>
              <span>
                <i class="nx-dot emerging"></i>
                VFEA / Emerging
              </span>
            </div>
          </div>

          <aside class="nx-aside">
            <header class="nx-aside-heading">
              <span class="nx-overline">
                REGIONAL LENS
              </span>
              <span>GLOBAL / 01</span>
            </header>

            <div class="nx-ring" id="nx-ring">
              <div>
                <small>YOUR CAPITAL</small>
                <strong>GLOBAL</strong>
              </div>
            </div>

            <div
              class="nx-regions"
              id="nx-regions"
            ></div>

            <div
              class="nx-focus"
              id="nx-focus"
              aria-live="polite"
            ></div>
          </aside>
        </div>

        <footer class="nx-footnote">
          <p id="nx-note"></p>

          <div>
            <a
              href="${SOURCES.VWCE}"
              target="_blank"
              rel="noopener noreferrer"
            >VWCE SOURCE ↗</a>

            <a
              href="${SOURCES.VFEA}"
              target="_blank"
              rel="noopener noreferrer"
            >VFEA SOURCE ↗</a>
          </div>
        </footer>
      </div>
    `;

    const goal = document.getElementById(
      "goal-section"
    );

    const portfolioRoot = document.getElementById(
      "pf-root"
    );

    if (goal) {
      goal.after(root);
    } else if (portfolioRoot) {
      portfolioRoot.append(root);
    } else {
      root = null;
      return;
    }

    const nav = document.querySelector(".nav");
    const goalLink = nav?.querySelector(
      'a[href="#goal-section"]'
    );

    if (goalLink) {
      const link = document.createElement("a");

      link.href = "#portfolio-xray";
      link.innerHTML = "<span>04</span> X-Ray";
      goalLink.after(link);
    }

    const holdingsLink = nav?.querySelector(
      'a[href="#pf-holdings"]'
    );

    if (holdingsLink) {
      holdingsLink.innerHTML =
        "<span>05</span> Holdings";
    }

    const ledgerNumber = nav?.querySelector(
      ".goal-nav > span"
    );

    if (ledgerNumber) {
      ledgerNumber.textContent = "06";
    }

    const holdingsSection = document.getElementById(
      "pf-holdings"
    )?.closest("section");

    const holdingsCoordinate =
      holdingsSection?.querySelector(
        ".section-coordinate"
      );

    if (holdingsCoordinate) {
      holdingsCoordinate.textContent =
        "05 / HOLDINGS";
    }

    root.addEventListener("click", event => {
      const button = event.target.closest("button");

      if (!button) return;

      if (button.dataset.fund) {
        mode = button.dataset.fund;
        selected = "";
        expanded = false;
      } else if (button.dataset.group) {
        grouping = button.dataset.group;
        selected = "";
        expanded = false;
      } else if (button.dataset.item) {
        selected = button.dataset.item;
      } else if (button.id === "nx-more") {
        expanded = !expanded;
      } else {
        return;
      }

      render();
    });

    render();
  }

  async function refreshIssuer() {
    try {
      const response = await fetch(DATA_URL, {
        cache: "no-cache"
      });

      if (!response.ok) {
        throw Error("Country file unavailable");
      }

      const next = validateData(
        await response.json()
      );

      if (!next) {
        throw Error("Invalid country file");
      }

      issuer = next;
      dataStatus = "Vanguard / AUTOMATED";
    } catch {
      dataStatus =
        "VERIFIED SNAPSHOT / REFRESH PENDING";
    }

    render();
  }

  const style = document.createElement("style");
  style.id = "northstar-xray-style";

  style.textContent = `
    #portfolio-xray {
      scroll-margin-top: 108px;
      width: 100%;
      margin: 20px 0 44px;
    }

    #portfolio-xray * {
      box-sizing: border-box;
    }

    #portfolio-xray .section-coordinate {
      margin-bottom: 18px;
    }

    .nx-shell {
      background: #f6f4ee;
      color: #203541;
      border: 1px solid #ffffff66;
      border-radius: 12px;
      padding: clamp(22px, 3.6vw, 54px);
      box-shadow: 0 24px 80px #00000030;
      overflow: hidden;
      font-family: inherit;
    }

    .nx-eyebrow,
    .nx-overline {
      font-family: var(--mono, monospace);
      font-size: 10px;
      font-weight: 600;
      letter-spacing: .12em;
      color: #758784;
    }

    .nx-eyebrow {
      display: flex;
      align-items: center;
      gap: 10px;
      padding-bottom: 24px;
      border-bottom: 1px solid #d8deda;
    }

    .nx-eyebrow .nx-reference {
      margin-left: auto;
      color: #aeb9b4;
    }

    .nx-spark {
      color: #a68c62;
      font-size: 19px;
    }

    .nx-intro {
      display: flex;
      justify-content: space-between;
      align-items: end;
      gap: 30px;
      padding: 32px 0 38px;
    }

    .nx-intro h2 {
      margin: 0 0 15px;
      max-width: 640px;
      font: 400 clamp(32px, 4.3vw, 56px)/1.05 Georgia, serif;
      letter-spacing: -.045em;
      color: #193442;
    }

    .nx-intro h2 em {
      font-weight: 400;
      color: #aa8c62;
    }

    .nx-intro p {
      max-width: 580px;
      margin: 0;
      font-size: 13px;
      line-height: 1.8;
      color: #71827e;
    }

    .nx-snapshot {
      min-width: 190px;
      display: grid;
      gap: 6px;
      text-align: right;
    }

    .nx-snapshot span {
      font: 10px var(--mono, monospace);
      letter-spacing: .12em;
      color: #81918d;
    }

    .nx-snapshot strong {
      font: 400 19px Georgia, serif;
      color: #294754;
    }

    .nx-snapshot small {
      font-size: 10px;
      color: #97a39e;
    }

    .nx-snapshot small[data-stale="true"] {
      color: #b77859;
    }

    .nx-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }

    .nx-stat {
      min-width: 0;
      padding: 23px 24px;
      border: 1px solid #e5e9e5;
      border-radius: 8px;
      background: #fff;
    }

    .nx-stat span,
    .nx-stat small {
      display: block;
      font: 10px/1.7 var(--mono, monospace);
      color: #91a09b;
    }

    .nx-stat strong {
      display: block;
      margin: 11px 0 7px;
      font: 400 clamp(30px, 3.5vw, 44px) Georgia, serif;
      letter-spacing: -.045em;
      color: #20465a;
    }

    .nx-workspace {
      display: grid;
      grid-template-columns: minmax(0, 1.65fr) minmax(270px, 1fr);
      gap: 12px;
    }

    .nx-primary,
    .nx-aside {
      min-width: 0;
      padding: clamp(20px, 2.7vw, 32px);
      background: #fff;
      border: 1px solid #e6ebe6;
      border-radius: 8px;
    }

    .nx-panel-heading,
    .nx-aside-heading {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 12px;
    }

    .nx-panel-heading h3 {
      margin: 9px 0 0;
      color: #204253;
      font: 400 29px Georgia, serif;
      letter-spacing: -.035em;
    }

    .nx-basis {
      max-width: 210px;
      text-align: right;
      font: 10px/1.7 var(--mono, monospace);
      color: #83938e;
    }

    .nx-toolbar {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 10px;
      padding: 27px 0 22px;
    }

    .nx-segments {
      display: flex;
      gap: 3px;
      padding: 3px;
      border: 1px solid #dce5df;
      border-radius: 7px;
      background: #f7f9f7;
    }

    .nx-segments button {
      appearance: none;
      border: 0;
      min-height: 36px;
      padding: 0 12px;
      border-radius: 5px;
      background: transparent;
      color: #80908d;
      font: 600 11px system-ui, sans-serif;
      cursor: pointer;
    }

    .nx-segments button[aria-pressed="true"] {
      background: #fff;
      color: #284b5b;
      box-shadow: 0 1px 6px #1a383b19;
    }

    .nx-list-heading {
      display: flex;
      justify-content: space-between;
      padding: 13px 6px;
      border-bottom: 1px solid #e5ebe6;
      font: 10px var(--mono, monospace);
      letter-spacing: .12em;
      color: #9aa6a0;
    }

    .nx-bars {
      min-height: 100px;
    }

    .nx-line {
      display: grid;
      grid-template-columns:
        minmax(105px, 1fr)
        minmax(80px, 2fr)
        67px;
      gap: 13px;
      align-items: center;
      width: 100%;
      min-height: 44px;
      padding: 7px;
      border: 1px solid transparent;
      border-radius: 5px;
      background: transparent;
      color: #3b5660;
      text-align: left;
      cursor: pointer;
      font-family: inherit;
    }

    .nx-line:hover,
    .nx-line.chosen {
      background: #f5f8f5;
      border-color: #e6ece6;
    }

    .nx-country {
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .nx-rail {
      display: flex;
      width: 100%;
      height: 9px;
      overflow: hidden;
      border-radius: 20px;
      background: #edf1ed;
    }

    .nx-world {
      background: #347c89;
      transition: width .4s ease;
    }

    .nx-emerging {
      background: #c39d69;
      transition: width .4s ease;
    }

    .nx-line strong {
      color: #294958;
      text-align: right;
      font: 600 12px var(--mono, monospace);
    }

    .nx-more {
      display: block;
      margin: 19px auto;
      padding: 9px;
      border: 0;
      background: transparent;
      color: #4f7882;
      font: 600 11px var(--mono, monospace);
      cursor: pointer;
    }

    .nx-more[hidden] {
      display: none;
    }

    .nx-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 20px;
      padding-top: 18px;
      border-top: 1px solid #e7ede8;
      font-size: 11px;
      color: #82918c;
    }

    .nx-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 8px;
      border-radius: 50%;
    }

    .nx-dot.world {
      background: #347c89;
    }

    .nx-dot.emerging {
      background: #c39d69;
    }

    .nx-aside-heading > span:last-child {
      font: 10px var(--mono, monospace);
      color: #aab6ae;
    }

    .nx-ring {
      position: relative;
      display: grid;
      place-items: center;
      width: min(235px, 78%);
      aspect-ratio: 1;
      margin: 38px auto;
      border-radius: 50%;
      background: #e1e7e3;
    }

    .nx-ring::after {
      content: "";
      position: absolute;
      inset: 18px;
      border-radius: 50%;
      background: #fff;
    }

    .nx-ring > div {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 5px;
      text-align: center;
    }

    .nx-ring small {
      font: 9px var(--mono, monospace);
      letter-spacing: .12em;
      color: #98a7a1;
    }

    .nx-ring strong {
      font: 400 24px Georgia, serif;
      color: #254a5a;
    }

    .nx-regions {
      display: grid;
      gap: 14px;
      padding-bottom: 25px;
      border-bottom: 1px solid #e4eae5;
    }

    .nx-regions > div {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: #71817e;
      font-size: 11px;
    }

    .nx-regions span {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .nx-regions i {
      width: 8px;
      height: 8px;
      border-radius: 2px;
    }

    .nx-regions strong {
      color: #294958;
      font: 600 11px var(--mono, monospace);
    }

    .nx-focus {
      padding-top: 25px;
    }

    .nx-focus h4 {
      margin: 10px 0;
      color: #244759;
      font: 400 27px Georgia, serif;
    }

    .nx-focus-value {
      color: #347c89;
      font: 400 34px Georgia, serif;
    }

    .nx-focus-value small {
      display: block;
      margin-top: 6px;
      color: #9aa9a2;
      font: 11px var(--mono, monospace);
    }

    .nx-contributions {
      display: grid;
      gap: 14px;
      margin-top: 24px;
    }

    .nx-contributions > div {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 5px;
      font: 12px var(--mono, monospace);
      color: #617875;
    }

    .nx-contributions strong {
      color: #284756;
    }

    .nx-contributions small {
      grid-column: 1 / -1;
      margin-left: 16px;
      color: #9aaba4;
    }

    .nx-footnote {
      display: flex;
      justify-content: space-between;
      gap: 22px;
      flex-wrap: wrap;
      padding-top: 24px;
      color: #81938c;
      font-size: 10px;
      line-height: 1.8;
    }

    .nx-footnote p {
      max-width: 700px;
      margin: 0;
    }

    .nx-footnote a {
      display: inline-block;
      margin-left: 12px;
      color: #4f7378;
    }

    .nx-empty {
      padding: 26px 12px;
      color: #879790;
      font-size: 13px;
      line-height: 1.7;
    }

    #portfolio-xray button:focus-visible,
    #portfolio-xray a:focus-visible {
      outline: 2px solid #347c89;
      outline-offset: 3px;
    }

    @media (max-width: 980px) {
      .nx-workspace {
        grid-template-columns: 1fr;
      }

      .nx-aside {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px 24px;
      }

      .nx-aside-heading {
        grid-column: 1 / -1;
      }

      .nx-ring {
        width: min(200px, 80%);
        margin: 12px auto;
      }

      .nx-focus {
        grid-column: 1 / -1;
        border-top: 1px solid #e4eae5;
      }

      .nx-regions {
        border-bottom: 0;
      }
    }

    @media (max-width: 650px) {
      .nx-shell {
        padding: 18px;
      }

      .nx-intro {
        display: block;
      }

      .nx-snapshot {
        margin-top: 24px;
        text-align: left;
      }

      .nx-stats {
        grid-template-columns: 1fr 1fr;
      }

      .nx-stat {
        padding: 16px;
      }

      .nx-stat:last-child {
        display: none;
      }

      .nx-stat strong {
        font-size: 30px;
      }

      .nx-panel-heading {
        display: block;
      }

      .nx-basis {
        display: block;
        max-width: none;
        margin-top: 13px;
        text-align: left;
      }

      .nx-toolbar {
        display: grid;
      }

      .nx-segments {
        width: max-content;
        max-width: 100%;
      }

      .nx-line {
        grid-template-columns:
          minmax(90px, 1fr)
          minmax(65px, 1fr)
          55px;
        gap: 8px;
      }

      .nx-country {
        font-size: 11px;
      }

      .nx-line strong {
        font-size: 10px;
      }

      .nx-primary,
      .nx-aside {
        padding: 17px;
      }

      .nx-aside {
        display: block;
      }

      .nx-regions {
        border-bottom: 1px solid #e4eae5;
      }

      .nx-footnote {
        display: block;
      }

      .nx-footnote > div {
        margin-top: 14px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .nx-world,
      .nx-emerging {
        transition: none;
      }
    }
  `;

  document.head.append(style);

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
