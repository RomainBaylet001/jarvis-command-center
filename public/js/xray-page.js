
/*
  NORTHSTAR — PORTFOLIO X-RAY
  Interactive geographic look-through.

  Read-only portfolio access.
  VWCE + VFEA holdings.
  SXR8 benchmark excluded.
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const ASSETS = ["VWCE", "VFEA"];

  const STORAGE_KEY = "jarvis-private-portfolio-v1";

  const COUNTRY_URL = "./data/country-exposure.json";
  const PRICE_URL = "./data/etf-history.json";

  const WORLD_URL =
    "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";

  const COLORS = {
    VWCE: "#99dce4",
    VFEA: "#cdb78c"
  };

  /*
    ISO 3166-1 numeric codes for the countries currently
    reported in Vanguard's top-15 disclosures.

    Other countries use the geographic atlas names.
  */

  const ISO_NAMES = {
    "840": "United States",
    "392": "Japan",
    "158": "Taiwan",
    "826": "United Kingdom",
    "124": "Canada",
    "156": "China",
    "410": "South Korea",
    "250": "France",
    "756": "Switzerland",
    "276": "Germany",
    "036": "Australia",
    "356": "India",
    "528": "Netherlands",
    "724": "Spain",
    "380": "Italy",
    "076": "Brazil",
    "710": "South Africa",
    "682": "Saudi Arabia",
    "484": "Mexico",
    "784": "United Arab Emirates",
    "458": "Malaysia",
    "764": "Thailand",
    "792": "Turkey",
    "360": "Indonesia",
    "414": "Kuwait",
    "152": "Chile",
    "634": "Qatar"
  };

  const REGIONS = {
    "North America": [
      "United States",
      "Canada"
    ],

    "Europe": [
      "United Kingdom",
      "France",
      "Switzerland",
      "Germany",
      "Netherlands",
      "Spain",
      "Italy"
    ],

    "Asia-Pacific": [
      "Japan",
      "Taiwan",
      "China",
      "South Korea",
      "India",
      "Australia",
      "Malaysia",
      "Thailand",
      "Indonesia"
    ],

    "Latin America": [
      "Brazil",
      "Mexico",
      "Chile"
    ],

    "Middle East & Africa": [
      "South Africa",
      "Saudi Arabia",
      "United Arab Emirates",
      "Turkey",
      "Kuwait",
      "Qatar"
    ]
  };

  const REGION_COLORS = {
    "North America": "#87d2df",
    "Europe": "#a7b8c9",
    "Asia-Pacific": "#cdb78c",
    "Latin America": "#87b9a4",
    "Middle East & Africa": "#bb968a",
    "Other markets": "#536779"
  };

  /*
    Verified Vanguard snapshot, 30 September 2026.

    Used only when the automated country file
    cannot be loaded.
  */

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

  const euroFormatter = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  });

  const percentFormatter = new Intl.NumberFormat("en-IE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const money = value =>
    Number.isFinite(value)
      ? euroFormatter.format(value)
      : "—";

  const pct = value =>
    Number.isFinite(value)
      ? percentFormatter.format(value) + "%"
      : "—";

  const escapeHtml = value =>
    String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  const dateLabel = iso => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) {
      return "Unknown";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    }).format(new Date(iso + "T12:00:00Z"));
  };

  const countryKey = value =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  let issuer = null;
  let issuerStatus = "Verified issuer snapshot";

  let account = null;
  let accountError = "";

  let prices = null;
  let priceStatus = "Market prices not connected";

  let mode = "ALL";
  let selected = "";
  let expanded = false;

  let currentResult = null;

  let mapCountries = [];
  let mapReady = false;

  let motionPaused = false;

  /* ==========================================
     DATA VALIDATION
     ========================================== */

  function validateCountryData(payload) {
    if (!payload || !payload.funds) {
      throw Error("Missing issuer country data");
    }

    const clean = {
      funds: {},
      updatedAt: payload.updatedAt || ""
    };

    for (const asset of ASSETS) {
      const fund = payload.funds[asset];

      if (
        !fund ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fund.asOf || "") ||
        !fund.countries ||
        typeof fund.countries !== "object"
      ) {
        throw Error("Invalid " + asset + " country data");
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
        throw Error("Country allocations failed validation");
      }

      if (!("Other markets" in countries)) {
        countries["Other markets"] =
          Math.max(0, 100 - total);
      }

      clean.funds[asset] = {
        asOf: fund.asOf,
        countries
      };
    }

    return clean;
  }

  issuer = validateCountryData(FALLBACK);

  function readAccount() {
    accountError = "";

    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw === null) {
        return {
          trades: [],
          quotes: {},
          quoteDate: ""
        };
      }

      const saved = JSON.parse(raw);

      if (!saved || !Array.isArray(saved.trades)) {
        throw Error("Invalid saved portfolio structure");
      }

      const valid = saved.trades.every(trade =>
        trade &&
        ASSETS.includes(trade.asset) &&
        Number.isFinite(trade.amount) &&
        trade.amount > 0 &&
        Number.isFinite(trade.shares) &&
        trade.shares > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(trade.date || "")
      );

      if (!valid) {
        throw Error("Saved purchases failed validation");
      }

      return {
        trades: saved.trades,
        quotes: saved.quotes || {},
        quoteDate: saved.quoteDate || ""
      };

    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray: portfolio could not be read",
        error
      );

      accountError =
        "Saved portfolio could not be read. " +
        "Original browser storage was not changed.";

      return {
        trades: [],
        quotes: {},
        quoteDate: ""
      };
    }
  }

  /* ==========================================
     MARKET VALUATION
     ========================================== */

  function parsePrices(payload) {
    if (
      !payload ||
      payload.currency !== "EUR" ||
      !payload.prices
    ) {
      throw Error("Invalid EUR market feed");
    }

    const maps = {};

    for (const asset of ["VWCE", "VFEA", "SXR8"]) {
      const rows = payload.prices[asset];

      if (!Array.isArray(rows) || rows.length < 3) {
        throw Error("Missing " + asset + " price history");
      }

      const entries = rows.map(row => {
        if (
          !Array.isArray(row) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(row[0] || "") ||
          !Number.isFinite(Number(row[1])) ||
          Number(row[1]) <= 0
        ) {
          throw Error("Invalid market price");
        }

        return [row[0], Number(row[1])];
      });

      maps[asset] = new Map(entries);

      if (maps[asset].size !== rows.length) {
        throw Error("Duplicate market dates");
      }
    }

    const common = [...maps.VWCE.keys()]
      .filter(date =>
        maps.VFEA.has(date) &&
        maps.SXR8.has(date)
      )
      .sort();

    if (!common.length) {
      throw Error("No common ETF closing date");
    }

    const date = common[common.length - 1];

    return {
      date,
      quotes: {
        VWCE: maps.VWCE.get(date),
        VFEA: maps.VFEA.get(date)
      }
    };
  }

  function portfolioSnapshot() {
    const trades = account?.trades || [];
    const rows = {};

    let totalInvested = 0;

    for (const asset of ASSETS) {
      const own = trades.filter(
        trade => trade.asset === asset
      );

      const invested = own.reduce(
        (sum, trade) => sum + trade.amount,
        0
      );

      const shares = own.reduce(
        (sum, trade) => sum + trade.shares,
        0
      );

      const latestPurchase = own.reduce(
        (latest, trade) =>
          trade.date > latest ? trade.date : latest,
        ""
      );

      totalInvested += invested;

      let quote = null;
      let quoteDate = "";

      if (
        prices?.quotes[asset] > 0 &&
        prices.date >= latestPurchase
      ) {
        quote = prices.quotes[asset];
        quoteDate = prices.date;
      } else {
        const manual = Number(account?.quotes?.[asset]);

        if (
          manual > 0 &&
          account.quoteDate &&
          account.quoteDate >= latestPurchase
        ) {
          quote = manual;
          quoteDate = account.quoteDate;
        }
      }

      rows[asset] = {
        invested,
        shares,
        quote,
        quoteDate,
        marketValue:
          quote !== null ? shares * quote : null
      };
    }

    const hasHoldings = trades.length > 0;

    const canValue =
      hasHoldings &&
      !accountError &&
      ASSETS.every(asset =>
        rows[asset].invested === 0 ||
        rows[asset].marketValue !== null
      );

    const amounts = {};

    for (const asset of ASSETS) {
      amounts[asset] = canValue
        ? rows[asset].marketValue || 0
        : rows[asset].invested;
    }

    return {
      amounts,
      total: amounts.VWCE + amounts.VFEA,
      invested: totalInvested,
      market: canValue,
      hasHoldings,
      count: trades.length,
      basis: canValue
        ? "Market value"
        : "Invested capital",
      priceDate: canValue
        ? rows.VWCE.quoteDate || rows.VFEA.quoteDate
        : ""
    };
  }

  /* ==========================================
     GEOGRAPHIC CALCULATIONS
     ========================================== */

  function regionFor(country) {
    if (country === "Other markets") {
      return "Other markets";
    }

    for (const [region, countries] of Object.entries(
      REGIONS
    )) {
      if (countries.includes(country)) {
        return region;
      }
    }

    return "Other markets";
  }

  function calculate() {
    const portfolio = portfolioSnapshot();

    const weights = mode === "ALL"
      ? portfolio.amounts
      : {
          VWCE: mode === "VWCE" ? 1 : 0,
          VFEA: mode === "VFEA" ? 1 : 0
        };

    const totalWeight =
      weights.VWCE + weights.VFEA;

    const countries = new Map();

    if (totalWeight > 0) {
      for (const asset of ASSETS) {
        const factor = weights[asset] / totalWeight;

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

          const contribution = factor * weight;

          row.weight += contribution;
          row.parts[asset] += contribution;

          countries.set(name, row);
        }
      }
    }

    const countryRows = [...countries.values()]
      .filter(row => row.weight > 0.000001)
      .sort((a, b) => b.weight - a.weight);

    const regions = new Map();

    for (const country of countryRows) {
      const name = regionFor(country.name);

      const row = regions.get(name) || {
        name,
        weight: 0
      };

      row.weight += country.weight;
      regions.set(name, row);
    }

    const regionRows = [...regions.values()]
      .sort((a, b) => b.weight - a.weight);

    const value = mode === "ALL"
      ? portfolio.total
      : portfolio.amounts[mode];

    return {
      countries: countryRows,
      regions: regionRows,
      value,
      portfolio,
      totalWeight
    };
  }

  /* ==========================================
     UI HELPERS
     ========================================== */

  function findCountry(result, name) {
    const key = countryKey(name);

    return result.countries.find(
      row => countryKey(row.name) === key
    ) || null;
  }

  function formatIssuerDate() {
    const dates = ASSETS.map(
      asset => issuer.funds[asset].asOf
    );

    return dates[0] === dates[1]
      ? dateLabel(dates[0])
      : dates.map(dateLabel).join(" / ");
  }

  function chooseDefault(result) {
    if (selected || !result.countries.length) {
      return;
    }

    selected = result.countries.find(
      row => row.name !== "Other markets"
    )?.name || "";
  }

  function selectCountry(name) {
    selected = name;
    render();
  }

  /* ==========================================
     SUMMARY METRICS
     ========================================== */

  function renderMetrics(result) {
    const top = result.countries.find(
      row => row.name !== "Other markets"
    );

    const other = result.countries.find(
      row => row.name === "Other markets"
    );

    const count = result.countries.filter(
      row => row.name !== "Other markets"
    ).length;

    const meaningfulValue = result.value > 0;

    $("xray-value").textContent =
      meaningfulValue ? money(result.value) : "—";

    $("xray-value-note").textContent =
      accountError ||
      (
        mode !== "ALL"
          ? `${mode} holding · ${result.portfolio.basis.toLowerCase()}`
          : result.portfolio.hasHoldings
            ? result.portfolio.basis +
              (
                result.portfolio.priceDate
                  ? " · " + result.portfolio.priceDate
                  : " estimate"
              )
            : "No purchases saved in this browser"
      );

    $("xray-top-country").textContent =
      top?.name || "—";

    $("xray-top-percent").textContent =
      top
        ? pct(top.weight) + " of selected exposure"
        : "Awaiting portfolio allocation";

    $("xray-country-count").textContent =
      count ? String(count) : "—";

    $("xray-other").textContent =
      other ? pct(other.weight) : "—";

    $("xray-asof").textContent =
      formatIssuerDate();

    const oldest = ASSETS.map(
      asset => issuer.funds[asset].asOf
    ).sort()[0];

    const age = Math.floor(
      (
        Date.now() -
        Date.parse(oldest + "T12:00:00Z")
      ) / 86400000
    );

    const stale = age > 60;

    $("xray-data-status").textContent =
      issuerStatus +
      (stale ? " · Older than 60 days" : "");

    $("xray-method-status").textContent =
      "Country allocations as of " +
      formatIssuerDate() +
      " · " +
      (
        result.portfolio.market
          ? "Portfolio based on EUR price snapshots."
          : "Portfolio weights use invested capital when valuation is unavailable."
      ) +
      " Regional groupings are Northstar classifications.";

    $("xray-map-footnote").textContent =
      mode === "ALL"
        ? "Weighted portfolio exposure · issuer top-15 countries"
        : `${mode} underlying market allocation · issuer snapshot`;
  }

  /* ==========================================
     ETF FILTERS
     ========================================== */

  function renderFilters() {
    $("xray-filters")
      .querySelectorAll("[data-xray-mode]")
      .forEach(button => {
        const active =
          button.dataset.xrayMode === mode;

        button.classList.toggle(
          "active",
          active
        );

        button.setAttribute(
          "aria-pressed",
          String(active)
        );
      });
  }

  /* ==========================================
     INTERACTIVE WORLD MAP
     ========================================== */

  function svgElement(tag, attributes = {}) {
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg",
      tag
    );

    for (const [key, value] of Object.entries(
      attributes
    )) {
      node.setAttribute(key, String(value));
    }

    return node;
  }

  function colourFor(row, maximum) {
    if (!row || !window.d3) {
      return "#263441";
    }

    const worldShare = row.weight
      ? row.parts.VWCE / row.weight
      : 0.5;

    const base = d3.interpolateRgb(
      COLORS.VFEA,
      COLORS.VWCE
    )(worldShare);

    const strength =
      0.29 +
      0.71 * Math.sqrt(
        Math.min(1, row.weight / Math.max(1, maximum))
      );

    return d3.interpolateRgb(
      "#233644",
      base
    )(strength);
  }

  function renderMap(result) {
    if (!mapReady) return;

    const maximum = Math.max(
      1,
      ...result.countries
        .filter(row => row.name !== "Other markets")
        .map(row => row.weight)
    );

    for (const item of mapCountries) {
      const row = findCountry(result, item.name);
      const reported =
        !!row && row.name !== "Other markets";

      item.element.classList.toggle(
        "is-unreported",
        !reported
      );

      item.element.classList.toggle(
        "is-selected",
        countryKey(selected) === countryKey(item.name)
      );

      item.element.style.fill = reported
        ? colourFor(row, maximum)
        : "#263441";

      const description = reported
        ? `${item.name}: ${pct(row.weight)} exposure`
        : `${item.name}: not individually reported`;

      item.element.setAttribute(
        "aria-label",
        description
      );
    }
  }

  function showTooltip(event, name) {
    if (event.pointerType === "touch") {
      return;
    }

    const tooltip = $("xray-tooltip");
    const stage = $("xray-map-stage");

    const row = currentResult
      ? findCountry(currentResult, name)
      : null;

    tooltip.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>
        ${
          row
            ? pct(row.weight)
            : "Not individually reported"
        }
      </span>
      <small>
        ${
          row
            ? "Select to inspect allocation"
            : "No separate country weight disclosed"
        }
      </small>
    `;

    tooltip.hidden = false;

    const rect = stage.getBoundingClientRect();

    const x = Math.min(
      Math.max(12, event.clientX - rect.left + 16),
      Math.max(12, rect.width - 235)
    );

    const y = Math.min(
      Math.max(12, event.clientY - rect.top + 12),
      Math.max(12, rect.height - 100)
    );

    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip() {
    $("xray-tooltip").hidden = true;
  }

  function mapName(feature) {
    const code = String(feature.id ?? "")
      .padStart(3, "0");

    return ISO_NAMES[code] ||
      feature.properties?.name ||
      "Unknown country";
  }

  async function loadWorldMap() {
    const loading = $("xray-map-loading");

    try {
      if (!window.d3 || !window.topojson) {
        throw Error("Map libraries unavailable");
      }

      const response = await fetch(WORLD_URL);

      if (!response.ok) {
        throw Error("World geometry unavailable");
      }

      const topology = await response.json();

      if (!topology.objects?.countries) {
        throw Error("Invalid geographic atlas");
      }

      const geo = topojson.feature(
        topology,
        topology.objects.countries
      );

      const svg = $("xray-map");
      svg.replaceChildren();

      const projection = d3.geoNaturalEarth1()
        .fitExtent(
          [[25, 30], [975, 525]],
          { type: "Sphere" }
        );

      const path = d3.geoPath(projection);

      const sphere = svgElement("path", {
        class: "xray-sphere",
        d: path({ type: "Sphere" })
      });

      svg.append(sphere);

      const graticule = svgElement("path", {
        class: "xray-graticule",
        d: path(d3.geoGraticule10())
      });

      svg.append(graticule);

      const group = svgElement("g", {
        class: "xray-world-countries"
      });

      mapCountries = [];

      for (const feature of geo.features) {
        const name = mapName(feature);

        const country = svgElement("path", {
          class: "xray-country",
          d: path(feature),
          role: "button",
          tabindex: ISO_NAMES[
            String(feature.id ?? "").padStart(3, "0")
          ] ? "0" : "-1"
        });

        country.addEventListener(
          "pointerenter",
          event => showTooltip(event, name)
        );

        country.addEventListener(
          "pointermove",
          event => showTooltip(event, name)
        );

        country.addEventListener(
          "pointerleave",
          hideTooltip
        );

        country.addEventListener(
          "click",
          () => {
            hideTooltip();
            selectCountry(name);
          }
        );

        country.addEventListener(
          "keydown",
          event => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              selectCountry(name);
            }
          }
        );

        group.append(country);

        mapCountries.push({
          name,
          element: country
        });
      }

      svg.append(group);

      mapReady = true;
      loading.hidden = true;

      render();

    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray: map unavailable",
        error
      );

      loading.innerHTML = `
        <span style="color:#cdb78c">
          WORLD ATLAS UNAVAILABLE
        </span>
        <span>
          Country rankings remain available below.
        </span>
      `;
    }
  }

  /* ==========================================
     COUNTRY INSPECTOR
     ========================================== */

  function renderInspector(result) {
    const target = $("xray-inspector-content");

    if (!selected || !result.countries.length) {
      target.innerHTML = `
        <div class="xray-inspector-placeholder">
          <span class="xray-compass">✧</span>

          <h3 id="xray-inspector-title">
            ${
              mode === "ALL" && !result.portfolio.hasHoldings
                ? "Your map awaits."
                : "Select a country"
            }
          </h3>

          <p>
            ${
              accountError
                ? escapeHtml(accountError)
                : mode === "ALL" &&
                  !result.portfolio.hasHoldings
                  ? "Add your VWCE or VFEA purchases on the main dashboard, or select an ETF above to explore its geographic allocation."
                  : "Tap a country on the world map or choose one from the ranking."
            }
          </p>
        </div>
      `;

      return;
    }

    const row = findCountry(result, selected);

    if (!row) {
      target.innerHTML = `
        <div class="xray-inspector-country">
          <span class="xray-overline">
            COUNTRY / NOT SEPARATELY DISCLOSED
          </span>

          <h3 id="xray-inspector-title">
            ${escapeHtml(selected)}
          </h3>

          <p>
            This country does not have an individual
            weight in the available Vanguard top-15
            disclosures.
          </p>
        </div>

        <div class="xray-inspector-big">
          <strong>—</strong>
          <span>
            Exposure cannot be determined individually.
          </span>
        </div>

        <div class="xray-inspector-notice">
          A country without a published individual weight
          must not be interpreted as a country with zero
          exposure. Smaller positions are combined under
          “Other markets”.
        </div>
      `;

      return;
    }

    const implied = result.value > 0
      ? result.value * row.weight / 100
      : null;

    const contributionRows = ASSETS.map(asset => {
      const contribution = row.parts[asset];

      const share = row.weight > 0
        ? contribution / row.weight * 100
        : 0;

      return `
        <div class="xray-inspector-fund">

          <div>
            <span>${asset} CONTRIBUTION</span>
            <strong>
              ${pct(contribution)}
              <small>pp</small>
            </strong>
          </div>

          <div class="xray-fund-bar ${
            asset === "VWCE" ? "world" : "emerging"
          }">
            <span
              style="width:${Math.max(
                0,
                Math.min(100, share)
              )}%"
            ></span>
          </div>

        </div>
      `;
    }).join("");

    const type = row.name === "Other markets"
      ? "AGGREGATED MARKETS"
      : "COUNTRY EXPOSURE";

    target.innerHTML = `
      <div class="xray-inspector-country">

        <span class="xray-overline">
          ${type}
        </span>

        <h3 id="xray-inspector-title">
          ${escapeHtml(row.name)}
        </h3>

        <p>
          ${
            row.name === "Other markets"
              ? "Remaining markets not individually listed by the issuer."
              : mode === "ALL"
                ? "Combined exposure across your VWCE and VFEA holdings."
                : "Underlying country allocation within " + mode + "."
          }
        </p>

      </div>

      <div class="xray-inspector-big">
        <strong>${pct(row.weight)}</strong>

        <span>
          ${
            mode === "ALL"
              ? "of your analysed portfolio"
              : "of " + mode + " underlying exposure"
          }
        </span>
      </div>

      <div class="xray-inspector-eur">
        <span>IMPLIED CAPITAL ALLOCATED</span>
        <strong>${money(implied)}</strong>
      </div>

      <div class="xray-inspector-breakdown">
        <h4>
          CONTRIBUTION TO SELECTED EXPOSURE
        </h4>

        ${contributionRows}
      </div>

      <div class="xray-inspector-notice">
        ${
          row.name === "Other markets"
            ? "This figure cannot be allocated to individual countries on the map."
            : "Calculated from your ETF weighting and dated issuer allocations."
        }

        ${
          result.portfolio.market
            ? "EUR figures use available closing-price snapshots."
            : "EUR figures use invested capital where current valuation is unavailable."
        }
      </div>
    `;
  }

  /* ==========================================
     COUNTRY RANKING
     ========================================== */

  function renderCountryList(result) {
    const list = $("xray-country-list");
    const showAll = $("xray-show-all");

    if (!result.countries.length) {
      list.innerHTML = `
        <div class="xray-list-loading">
          ${
            accountError
              ? escapeHtml(accountError)
              : "No portfolio allocation yet. Choose VWCE or VFEA above to inspect the issuer's country weights."
          }
        </div>
      `;

      showAll.hidden = true;
      $("xray-export").disabled = true;
      return;
    }

    $("xray-export").disabled = false;

    const visible = expanded
      ? result.countries
      : result.countries.slice(0, 10);

    const maximum = Math.max(
      1,
      ...result.countries.map(row => row.weight)
    );

    list.innerHTML = visible.map((row, index) => {
      const width =
        Math.min(100, row.weight / maximum * 100);

      const implied = result.value > 0
        ? result.value * row.weight / 100
        : null;

      const dominant =
        row.parts.VFEA > row.parts.VWCE
          ? "VFEA"
          : "VWCE";

      const active =
        countryKey(row.name) === countryKey(selected);

      return `
        <button
          type="button"
          class="xray-country-row ${
            active ? "is-selected" : ""
          }"
          data-country="${escapeHtml(row.name)}"
          data-dominant="${dominant}"
          aria-pressed="${active}"
        >

          <span class="xray-rank-name">
            <span class="xray-rank-index">
              ${String(index + 1).padStart(2, "0")}
            </span>

            <span>
              ${escapeHtml(row.name)}
            </span>
          </span>

          <span class="xray-rank-bar">
            <span style="width:${width}%"></span>
          </span>

          <span class="xray-rank-value">
            <strong>${pct(row.weight)}</strong>
            <small>${money(implied)}</small>
          </span>

        </button>
      `;
    }).join("");

    showAll.hidden =
      result.countries.length <= 10;

    showAll.setAttribute(
      "aria-expanded",
      String(expanded)
    );

    showAll.textContent = expanded
      ? "SHOW TOP 10 ↑"
      : "EXPLORE ALL COUNTRIES ↓";
  }

  /* ==========================================
     REGIONAL BREAKDOWN
     ========================================== */

  function renderRegions(result) {
    const ring = $("xray-region-ring");
    const list = $("xray-region-list");

    if (!result.regions.length) {
      ring.style.background =
        "conic-gradient(#334451 0% 100%)";

      ring.setAttribute(
        "aria-label",
        "No regional allocation available"
      );

      list.innerHTML = `
        <div class="xray-list-loading">
          Regional allocation will appear here.
        </div>
      `;

      return;
    }

    const total = result.regions.reduce(
      (sum, row) => sum + row.weight,
      0
    );

    let position = 0;

    const segments = result.regions.map(row => {
      const colour =
        REGION_COLORS[row.name] || "#536779";

      const end =
        position + row.weight / total * 100;

      const segment =
        `${colour} ${position}% ${end}%`;

      position = end;

      return segment;
    });

    ring.style.background =
      `conic-gradient(${segments.join(",")})`;

    ring.setAttribute(
      "aria-label",
      result.regions.map(
        row => `${row.name}: ${pct(row.weight)}`
      ).join("; ")
    );

    list.innerHTML = result.regions.map(row => {
      const colour =
        REGION_COLORS[row.name] || "#536779";

      return `
        <div class="xray-region-row">

          <span class="xray-region-row-name">
            <i style="background:${colour}"></i>
            ${escapeHtml(row.name)}
          </span>

          <strong>${pct(row.weight)}</strong>

          <div class="xray-region-track">
            <span
              style="
                width:${Math.min(100, row.weight)}%;
                background:${colour};
              "
            ></span>
          </div>

        </div>
      `;
    }).join("");
  }

  /* ==========================================
     CENTRAL RENDER
     ========================================== */

  function render() {
    if (!$("xray-main")) return;

    const result = calculate();

    currentResult = result;

    chooseDefault(result);

    renderFilters();
    renderMetrics(result);
    renderMap(result);
    renderInspector(result);
    renderCountryList(result);
    renderRegions(result);
  }

  /* ==========================================
     CSV EXPORT
     ========================================== */

  function csvCell(value) {
    return '"' +
      String(value ?? "").replace(/"/g, '""') +
      '"';
  }

  function exportCsv() {
    if (!currentResult?.countries.length) return;

    const result = currentResult;

    const rows = [
      [
        "Country",
        "Region",
        "Weight (%)",
        "Implied EUR",
        "VWCE contribution (percentage points)",
        "VFEA contribution (percentage points)",
        "View",
        "Valuation basis",
        "VWCE issuer date",
        "VFEA issuer date"
      ]
    ];

    for (const row of result.countries) {
      const implied = result.value > 0
        ? result.value * row.weight / 100
        : "";

      rows.push([
        row.name,
        regionFor(row.name),
        row.weight.toFixed(6),
        implied === "" ? "" : implied.toFixed(2),
        row.parts.VWCE.toFixed(6),
        row.parts.VFEA.toFixed(6),
        mode === "ALL" ? "Portfolio" : mode,
        result.portfolio.basis,
        issuer.funds.VWCE.asOf,
        issuer.funds.VFEA.asOf
      ]);
    }

    const csv = rows.map(
      row => row.map(csvCell).join(",")
    ).join("\r\n");

    const blob = new Blob(
      ["\ufeff", csv],
      { type: "text/csv;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;

    link.download =
      "northstar-country-exposure-" +
      mode.toLowerCase() +
      "-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url),
      2000
    );
  }

  /* ==========================================
     REMOTE DATA LOADING
     ========================================== */

  async function fetchJson(url) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      15000
    );

    try {
      const response = await fetch(url, {
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        throw Error("HTTP " + response.status);
      }

      return await response.json();

    } finally {
      clearTimeout(timeout);
    }
  }

  async function loadIssuerData() {
    try {
      const payload = await fetchJson(COUNTRY_URL);

      issuer = validateCountryData(payload);

      issuerStatus =
        "Automated Vanguard disclosure connected";

    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray: using verified issuer fallback",
        error
      );

      issuerStatus =
        "Using verified September 2026 snapshot";
    }

    render();
  }

  async function loadPriceData() {
    try {
      const payload = await fetchJson(PRICE_URL);

      prices = parsePrices(payload);
      priceStatus = "EUR closing prices connected";

    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray: market feed unavailable",
        error
      );

      prices = null;
      priceStatus =
        "Price feed unavailable; invested capital fallback";
    }

    render();
  }

  /* ==========================================
     SAME ANIMATED SKY AS THE HOMEPAGE
     ========================================== */

  function setupSky() {
    const canvas = $("celestial-core");

    if (!canvas) return;

    const context = canvas.getContext("2d");

    if (!context) return;

    const reduced = matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const button = $("motion-toggle");

    const TAU = Math.PI * 2;

    let width = 0;
    let height = 0;
    let dpr = 1;

    let stars = [];

    let time = 0;
    let lastTime = 0;
    let lastPaint = 0;
    let frame = 0;

    let manuallyPaused = false;

    const wrap = (value, maximum) =>
      ((value % maximum) + maximum) % maximum;

    function isPaused() {
      return manuallyPaused || reduced.matches;
    }

    function resize() {
      width = innerWidth;
      height = innerHeight;

      dpr = Math.min(
        devicePixelRatio || 1,
        1.75
      );

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      /*
        Same seed, density, star layers and speeds
        as the Northstar celestial homepage.
      */

      let seed = 7341;

      const random = () =>
        ((seed = seed * 16807 % 2147483647) - 1) /
        2147483646;

      stars = Array.from({
        length: Math.max(
          100,
          Math.min(
            340,
            Math.round(width * height / 4200)
          )
        )
      }, () => {
        const layer = random() < 0.65
          ? 0
          : random() < 0.8 ? 1 : 2;

        return {
          x: random() * width,
          y: random() * height,
          layer,
          radius:
            0.3 + random() * 0.4 + layer * 0.12,
          alpha:
            0.18 + random() * 0.25 + layer * 0.07,
          phase: random() * TAU
        };
      });

      paint();
    }

    function paint() {
      context.setTransform(
        dpr, 0, 0, dpr, 0, 0
      );

      context.clearRect(
        0, 0, width, height
      );

      context.fillStyle = "#c4d4e2";

      for (const star of stars) {
        const speed = [0.6, 2, 4][star.layer];

        const x = wrap(
          star.x + time * speed,
          width
        );

        const y = wrap(
          star.y - time * speed * 0.16,
          height
        );

        const edge = Math.max(
          0,
          Math.min(
            1,
            x / 20,
            y / 20,
            (width - x) / 20,
            (height - y) / 20
          )
        );

        context.globalAlpha =
          star.alpha *
          edge *
          (
            0.9 +
            0.1 * Math.sin(
              time * 0.5 + star.phase
            )
          );

        context.beginPath();

        context.arc(
          x,
          y,
          star.radius,
          0,
          TAU
        );

        context.fill();
      }

      context.globalAlpha = 1;
    }

    function stop() {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }

      lastTime = 0;
    }

    function animate(now) {
      frame = 0;

      if (isPaused() || document.hidden) {
        stop();
        return;
      }

      if (lastTime) {
        time += Math.min(
          0.05,
          (now - lastTime) / 1000
        );
      }

      lastTime = now;

      if (now - lastPaint >= 45) {
        paint();
        lastPaint = now;
      }

      frame = requestAnimationFrame(animate);
    }

    function wake() {
      if (
        !frame &&
        !isPaused() &&
        !document.hidden
      ) {
        frame = requestAnimationFrame(animate);
      }
    }

    function updateMotion() {
      const paused = isPaused();

      motionPaused = paused;

      document.body.classList.toggle(
        "motion-paused",
        paused
      );

      button.setAttribute(
        "aria-pressed",
        String(paused)
      );

      button.setAttribute(
        "aria-label",
        paused
          ? "Resume ambient motion"
          : "Pause ambient motion"
      );

      button.querySelector("span").textContent =
        paused ? "OFF" : "ON";

      if (paused) {
        stop();
        paint();
      } else {
        wake();
      }
    }

    button.addEventListener("click", () => {
      manuallyPaused = !manuallyPaused;
      updateMotion();
    });

    reduced.addEventListener(
      "change",
      updateMotion
    );

    document.addEventListener(
      "visibilitychange",
      () => {
        document.body.classList.toggle(
          "tab-hidden",
          document.hidden
        );

        if (document.hidden) {
          stop();
        } else {
          wake();
        }
      }
    );

    addEventListener("resize", resize, {
      passive: true
    });

    resize();
    updateMotion();
  }

  /* ==========================================
     NAVIGATION
     ========================================== */

  function setupNavigation() {
    const nav = document.querySelector(".nav");

    if (!nav) return;

    function positionBeacon() {
      const active = nav.querySelector(
        "a.active"
      );

      if (!active) return;

      const bounds =
        active.getBoundingClientRect();

      const parent =
        nav.getBoundingClientRect();

      nav.style.setProperty(
        "--beacon-x",
        (bounds.left - parent.left) + "px"
      );

      nav.style.setProperty(
        "--beacon-width",
        bounds.width + "px"
      );
    }

    addEventListener(
      "resize",
      positionBeacon,
      { passive: true }
    );

    requestAnimationFrame(positionBeacon);
  }

  /* ==========================================
     INTERACTIONS
     ========================================== */

  function setupEvents() {
    $("xray-filters").addEventListener(
      "click",
      event => {
        const button = event.target.closest(
          "[data-xray-mode]"
        );

        if (!button) return;

        mode = button.dataset.xrayMode;
        selected = "";
        expanded = false;

        hideTooltip();
        render();
      }
    );

    $("xray-country-list").addEventListener(
      "click",
      event => {
        const button = event.target.closest(
          "[data-country]"
        );

        if (!button) return;

        selectCountry(button.dataset.country);

        if (mapReady) {
          $("xray-map-stage").scrollIntoView({
            behavior: motionPaused
              ? "instant"
              : "smooth",
            block: "nearest"
          });
        }
      }
    );

    $("xray-show-all").addEventListener(
      "click",
      () => {
        expanded = !expanded;
        renderCountryList(currentResult);
      }
    );

    $("xray-export").addEventListener(
      "click",
      exportCsv
    );
  }

  /* ==========================================
     INITIALIZATION
     ========================================== */

  function initialize() {
    account = readAccount();

    setupSky();
    setupNavigation();
    setupEvents();

    render();

    /*
      Independent loading:
      Map, issuer data and prices can complete
      in any order without blocking one another.
    */

    loadWorldMap();
    loadIssuerData();
    loadPriceData();

    /*
      Refresh browser-local holdings after returning
      from the main dashboard's transaction ledger.
    */

    addEventListener("pageshow", event => {
      if (!event.persisted) return;

      account = readAccount();
      loadPriceData();
      render();
    });
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
