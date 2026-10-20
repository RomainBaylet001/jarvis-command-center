/*
  NORTHSTAR — Portfolio X-Ray
  Read-only geographic exposure and investment atlas.
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
    "North America": ["United States", "Canada"],
    Europe: [
      "United Kingdom", "France", "Switzerland", "Germany",
      "Netherlands", "Spain", "Italy"
    ],
    "Asia-Pacific": [
      "Japan", "Taiwan", "China", "South Korea", "India",
      "Australia", "Malaysia", "Thailand", "Indonesia"
    ],
    "Latin America": ["Brazil", "Mexico", "Chile"],
    "Middle East & Africa": [
      "South Africa", "Saudi Arabia", "United Arab Emirates",
      "Turkey", "Kuwait", "Qatar"
    ]
  };

  const REGION_COLORS = {
    "North America": "#87d2df",
    Europe: "#a7b8c9",
    "Asia-Pacific": "#cdb78c",
    "Latin America": "#87b9a4",
    "Middle East & Africa": "#bb968a",
    "Other markets": "#536779"
  };

  // Retained fallback snapshot from the existing application.
  const FALLBACK = {
    funds: {
      VWCE: {
        asOf: "2026-09-30",
        countries: {
          "United States": 62.24,
          Japan: 6.06,
          Taiwan: 3.54,
          "United Kingdom": 3.12,
          Canada: 2.91,
          China: 2.67,
          "South Korea": 2.60,
          France: 1.89,
          Switzerland: 1.88,
          Germany: 1.78,
          Australia: 1.53,
          India: 1.50,
          Netherlands: 1.18,
          Spain: 0.84,
          Italy: 0.75
        }
      },
      VFEA: {
        asOf: "2026-09-30",
        countries: {
          Taiwan: 35.36,
          China: 26.66,
          India: 15.07,
          Brazil: 4.48,
          "South Africa": 3.66,
          "Saudi Arabia": 3.10,
          Mexico: 2.07,
          "United Arab Emirates": 1.72,
          Malaysia: 1.51,
          Thailand: 1.46,
          Turkey: 0.79,
          Indonesia: 0.68,
          Kuwait: 0.66,
          Chile: 0.65,
          Qatar: 0.58
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
    Number.isFinite(value) ? euroFormatter.format(value) : "—";

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
  let priceLoading = false;
  let priceAttempt = 0;
  let priceTimer = 0;
  let mode = "ALL";
  let selected = "";
  let expanded = false;
  let currentResult = null;
  let mapCountries = [];
  let mapReady = false;

  let motionPaused = matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // DATA VALIDATION

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

      for (const [name, raw] of Object.entries(fund.countries)) {
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
        countries["Other markets"] = Math.max(0, 100 - total);
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
        return { trades: [], quotes: {}, quoteDate: "" };
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

      return { trades: [], quotes: {}, quoteDate: "" };
    }
  }

  // MARKET VALUATION

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
        maps.VFEA.has(date) && maps.SXR8.has(date)
      )
      .sort();

    if (!common.length) {
      throw Error("No common ETF closing date");
    }

    const date = common[common.length - 1];
    const quotes = {};

    for (const asset of ASSETS) {
      const candidate = payload.quotes?.[asset];
      const timestamp = Date.parse(candidate?.asOf);
      const price = Number(candidate?.price);

      quotes[asset] =
        candidate &&
        validPriceDate(candidate.date) &&
        candidate.date >= date &&
        Number.isFinite(price) &&
        price > 0 &&
        Number.isFinite(timestamp) &&
        timestamp <= Date.now() + 300000 &&
        berlinDate(timestamp) === candidate.date &&
        ["delayed", "closing"].includes(candidate.type)
          ? {
              price,
              date: candidate.date,
              asOf: new Date(timestamp).toISOString(),
              type: candidate.type
            }
          : {
              price: maps[asset].get(date),
              date,
              type: "closing"
            };
    }

    const raw = payload.market;

    const sessions = Array.isArray(raw?.sessions)
      ? raw.sessions.filter(session =>
          validPriceDate(session.date) &&
          Number.isFinite(Date.parse(session.open)) &&
          Number.isFinite(Date.parse(session.close)) &&
          Date.parse(session.open) < Date.parse(session.close) &&
          berlinDate(Date.parse(session.open)) === session.date
        ).sort((a, b) => a.date.localeCompare(b.date))
      : [];

    const market =
      raw?.timezone === "Europe/Berlin" &&
      validPriceDate(raw.calendarStart) &&
      validPriceDate(raw.calendarEnd) &&
      sessions.length
        ? { ...raw, sessions }
        : null;

    return { date, quotes, market };
  }

  function validPriceDate(value) {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value + "T12:00:00Z")) &&
      new Date(value + "T12:00:00Z")
        .toISOString()
        .slice(0, 10) === value
    );
  }

  function berlinDate(timestamp = Date.now()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date(timestamp));

    const part = type =>
      parts.find(item => item.type === type).value;

    return (
      part("year") + "-" +
      part("month") + "-" +
      part("day")
    );
  }

  function marketState(now = Date.now()) {
    const market = prices?.market;
    const today = berlinDate(now);

    if (
      !market ||
      today < market.calendarStart ||
      today > market.calendarEnd
    ) {
      return { known: false, open: false };
    }

    const session = market.sessions.find(
      item => item.date === today
    );

    return {
      known: true,
      open:
        !!session &&
        now >= Date.parse(session.open) &&
        now < Date.parse(session.close),
      previous: [...market.sessions].reverse().find(
        item => Date.parse(item.close) <= now
      )
    };
  }

  function quoteStale(quote, now = Date.now()) {
    if (!quote || !validPriceDate(quote.date)) {
      return true;
    }

    const state = marketState(now);
    const timestamp = Date.parse(quote.asOf);

    if (!state.known) {
      return (
        now - Date.parse(quote.date + "T12:00:00Z")
      ) > 5 * 86400000;
    }

    if (state.open) {
      return (
        !Number.isFinite(timestamp) ||
        now - timestamp > 90 * 60000
      );
    }

    const last = state.previous;

    if (!last) return false;
    if (quote.date < last.date) return true;

    return (
      quote.type === "delayed" &&
      now > Date.parse(last.close) + 60 * 60000 &&
      timestamp < Date.parse(last.close) - 30 * 60000
    );
  }

  function valuationLabel(portfolio) {
    if (!portfolio.market) {
      return portfolio.hasHoldings
        ? "Invested capital estimate"
        : "No saved holdings";
    }

    const quotes = ASSETS.filter(asset =>
      portfolio.rows[asset].shares > 0 &&
      (mode === "ALL" || mode === asset)
    ).map(asset => portfolio.rows[asset].quoteInfo);

    if (!quotes.length) return "No holding in this ETF";

    const oldest = [...quotes].sort((a, b) =>
      (a.asOf || a.date).localeCompare(b.asOf || b.date)
    )[0];

    const kind = quotes.every(q => q.type === "closing")
      ? "Daily close"
      : quotes.every(q => q.type === "delayed")
        ? "Delayed quotes"
        : quotes.every(q => q.type === "manual")
          ? "Manual snapshot"
          : "Mixed price snapshots";

    const time = oldest.asOf
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Berlin",
          hour: "2-digit",
          minute: "2-digit"
        }).format(new Date(oldest.asOf)) + " Berlin"
      : "";

    return (
      kind + " · " + dateLabel(oldest.date) +
      (time ? " " + time : "") +
      (quotes.some(q => quoteStale(q)) ? " · STALE" : "")
    );
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
        (sum, trade) => sum + trade.amount, 0
      );

      const shares = own.reduce(
        (sum, trade) => sum + trade.shares, 0
      );

      const latestPurchase = own.reduce(
        (latest, trade) =>
          trade.date > latest ? trade.date : latest,
        ""
      );

      totalInvested += invested;

      let quote = null;
      let quoteDate = "";
      let quoteInfo = null;

      if (
        prices?.quotes[asset]?.price > 0 &&
        prices.quotes[asset].date >= latestPurchase
      ) {
        quoteInfo = prices.quotes[asset];
        quote = quoteInfo.price;
        quoteDate = quoteInfo.date;
      } else {
        const manual = Number(account?.quotes?.[asset]);

        if (
          Number.isFinite(manual) &&
          manual > 0 &&
          validPriceDate(account.quoteDate) &&
          account.quoteDate >= latestPurchase
        ) {
          quote = manual;
          quoteDate = account.quoteDate;
          quoteInfo = {
            price: manual,
            date: quoteDate,
            type: "manual"
          };
        }
      }

      rows[asset] = {
        invested,
        shares,
        quote,
        quoteDate,
        quoteInfo,
        marketValue: quote !== null ? shares * quote : null
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
      rows,
      amounts,
      total: amounts.VWCE + amounts.VFEA,
      invested: totalInvested,
      market: canValue,
      hasHoldings,
      count: trades.length,
      basis: canValue ? "Market value" : "Invested capital",
      priceDate: canValue
        ? ASSETS.filter(asset => rows[asset].shares > 0)
            .map(asset => rows[asset].quoteDate)
            .sort()[0] || ""
        : ""
    };
  }

  // GEOGRAPHIC CALCULATIONS

  function regionFor(country) {
    if (country === "Other markets") {
      return "Other markets";
    }

    for (const [region, countries] of Object.entries(REGIONS)) {
      if (countries.includes(country)) return region;
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

    const totalWeight = weights.VWCE + weights.VFEA;
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
            parts: { VWCE: 0, VFEA: 0 }
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

    return {
      countries: countryRows,
      regions: [...regions.values()]
        .sort((a, b) => b.weight - a.weight),
      value: mode === "ALL"
        ? portfolio.total
        : portfolio.amounts[mode],
      portfolio,
      totalWeight
    };
  }

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
    if (selected || !result.countries.length) return;

    selected = result.countries.find(
      row => row.name !== "Other markets"
    )?.name || "";
  }

  // LINKED SELECTION

  function selectCountry(name, origin = "map") {
    selected = name;

    const result = currentResult || calculate();

    const position = result.countries.findIndex(
      row => countryKey(row.name) === countryKey(name)
    );

    if (position >= 10) expanded = true;

    renderMap(result);
    renderInspector(result);
    renderCountryList(result);
    updateAtlas(result);

    const row = findCountry(result, name);

    $("atlas-live").textContent = name + (
      row
        ? ": " + pct(row.weight) + " disclosed exposure."
        : ": not individually disclosed."
    );

    if (origin === "ranking") {
      const button = [
        ...$("xray-country-list")
          .querySelectorAll("[data-country]")
      ].find(button =>
        countryKey(button.dataset.country) === countryKey(name)
      );

      button?.focus({ preventScroll: true });
    }

    const target = $("xray-inspector-content");

    if (!motionPaused && target.animate) {
      target.animate(
        [
          { opacity: 0.65, transform: "translateY(5px)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 220, easing: "ease-out" }
      );
    }
  }

  // SUMMARY

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

    $("xray-value").textContent =
      result.value > 0 ? money(result.value) : "—";

    $("xray-value-note").textContent =
      accountError || (
        (mode !== "ALL" ? mode + " · " : "") +
        valuationLabel(result.portfolio) +
        (
          priceStatus === "Refresh unavailable"
            ? " · Refresh unavailable"
            : ""
        )
      );

    $("xray-top-country").textContent =
      top?.name || "—";

    $("xray-top-percent").textContent = top
      ? pct(top.weight) + " of selected exposure"
      : "Awaiting portfolio allocation";

    $("xray-country-count").textContent =
      count ? String(count) : "—";

    $("xray-other").textContent =
      other ? pct(other.weight) : "—";

    $("xray-asof").textContent = formatIssuerDate();

    const oldest = ASSETS.map(
      asset => issuer.funds[asset].asOf
    ).sort()[0];

    const age = Math.floor(
      (Date.now() - Date.parse(oldest + "T12:00:00Z")) /
      86400000
    );

    $("xray-data-status").textContent =
      issuerStatus + (
        age > 60 ? " · Older than 60 days" : ""
      );

    $("xray-method-status").textContent =
      "Country allocations as of " +
      formatIssuerDate() + " · " + (
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

  function renderFilters() {
    $("xray-filters")
      .querySelectorAll("[data-xray-mode]")
      .forEach(button => {
        const active = button.dataset.xrayMode === mode;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
  }

  // WORLD MAP

  function svgElement(tag, attributes = {}) {
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg", tag
    );

    for (const [key, value] of Object.entries(attributes)) {
      node.setAttribute(key, String(value));
    }

    return node;
  }

  function colourFor(row, maximum) {
    if (!row || !window.d3) return "#263441";

    const strength = 0.22 + 0.78 * Math.sqrt(
      Math.min(1, row.weight / Math.max(1, maximum))
    );

    return d3.interpolateRgb(
      "#203542", COLORS.VWCE
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
        "is-unreported", !reported
      );

      item.element.classList.toggle(
        "is-selected",
        countryKey(selected) === countryKey(item.name)
      );

      item.element.style.fill = reported
        ? colourFor(row, maximum)
        : "#263441";

      item.element.setAttribute(
        "aria-label",
        reported
          ? `${item.name}: ${pct(row.weight)} exposure`
          : `${item.name}: not individually reported`
      );
    }

    const marker = $("atlas-map-marker");
    const label = $("atlas-map-label");

    const item = mapCountries.find(item =>
      countryKey(item.name) === countryKey(selected)
    );

    const valid = item?.center?.every(Number.isFinite);

    if (marker && label) {
      marker.setAttribute(
        "visibility", valid ? "visible" : "hidden"
      );

      label.setAttribute(
        "visibility", valid ? "visible" : "hidden"
      );

      if (valid) {
        const [x, y] = item.center;

        marker.setAttribute("cx", x);
        marker.setAttribute("cy", y);

        label.setAttribute(
          "x", Math.max(70, Math.min(900, x + 13))
        );

        label.setAttribute(
          "y", Math.max(24, y - 13)
        );

        label.textContent = item.name;
      }
    }
  }

  function showTooltip(event, name) {
    if (event.pointerType === "touch") return;

    const tooltip = $("xray-tooltip");
    const stage = $("xray-map-stage");

    const row = currentResult
      ? findCountry(currentResult, name)
      : null;

    tooltip.innerHTML = `
      <strong>${escapeHtml(name)}</strong>
      <span>${
        row ? pct(row.weight) : "Not individually reported"
      }</span>
      <small>${
        row
          ? "Select to inspect allocation"
          : "No separate country weight disclosed"
      }</small>
    `;

    tooltip.hidden = false;

    const rect = stage.getBoundingClientRect();

    tooltip.style.left = Math.min(
      Math.max(12, event.clientX - rect.left + 16),
      Math.max(12, rect.width - 235)
    ) + "px";

    tooltip.style.top = Math.min(
      Math.max(12, event.clientY - rect.top + 12),
      Math.max(12, rect.height - 100)
    ) + "px";
  }

  function hideTooltip() {
    $("xray-tooltip").hidden = true;
  }

  function mapName(feature) {
    const code = String(feature.id ?? "").padStart(3, "0");

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
        topology, topology.objects.countries
      );

      const svg = $("xray-map");
      svg.replaceChildren();

      const projection = d3.geoNaturalEarth1()
        .fitExtent(
          [[25, 30], [975, 525]],
          { type: "Sphere" }
        );

      const path = d3.geoPath(projection);

      svg.append(svgElement("path", {
        class: "xray-sphere",
        d: path({ type: "Sphere" })
      }));

      svg.append(svgElement("path", {
        class: "xray-graticule",
        d: path(d3.geoGraticule10())
      }));

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
          "pointerleave", hideTooltip
        );

        country.addEventListener("click", () => {
          hideTooltip();
          selectCountry(name);
        });

        country.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectCountry(name);
          }
        });

        group.append(country);

        mapCountries.push({
          name,
          center: path.centroid(feature),
          element: country
        });
      }

      svg.append(group);

      svg.append(svgElement("circle", {
        id: "atlas-map-marker",
        class: "atlas-marker",
        r: 7,
        visibility: "hidden",
        "aria-hidden": "true"
      }));

      svg.append(svgElement("text", {
        id: "atlas-map-label",
        class: "atlas-selected-name",
        visibility: "hidden",
        "aria-hidden": "true"
      }));

      mapReady = true;
      loading.hidden = true;
      render();
    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray: map unavailable", error
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

  // COUNTRY PANEL

  function renderInspector(result) {
    const target = $("xray-inspector-content");
    const row = findCountry(result, selected);

    const funds = ASSETS.filter(
      asset => mode === "ALL" || mode === asset
    );

    const dates =
      '<div class="atlas-dates">' +
      funds.map(asset =>
        "<div>" + asset + " holdings · <span>" +
        dateLabel(issuer.funds[asset].asOf) +
        "</span></div>"
      ).join("") +
      "<div>Valuation · <span>" +
      escapeHtml(valuationLabel(result.portfolio)) +
      "</span></div></div>";

    if (!selected) {
      target.innerHTML =
        '<div class="xray-inspector-placeholder">' +
        '<span class="xray-compass" aria-hidden="true">✧</span>' +
        '<h3 id="xray-inspector-title">Select a country</h3>' +
        "<p>" +
        escapeHtml(
          accountError ||
          "Choose a country on the map or in the ranking."
        ) +
        "</p></div>";

      return;
    }

    if (!row) {
      target.innerHTML =
        '<div class="xray-inspector-country">' +
        '<h3 id="xray-inspector-title">' +
        escapeHtml(selected) +
        "</h3></div>" +
        '<div class="xray-inspector-big">' +
        "<strong>—</strong>" +
        "<span>Not separately disclosed</span></div>" +
        '<p class="atlas-disclosure">' +
        "May be included in Other markets. " +
        "An unavailable weight does not mean zero exposure." +
        "</p>" +
        dates;

      return;
    }

    const implied = result.value > 0
      ? result.value * row.weight / 100
      : null;

    const missing = funds.some(asset =>
      (
        mode !== "ALL" ||
        result.portfolio.amounts[asset] > 0
      ) &&
      !Number.isFinite(
        issuer.funds[asset].countries[row.name]
      )
    );

    const aggregate = row.name === "Other markets";

    const split = mode !== "ALL"
      ? ""
      : funds.map(asset => {
          const weight =
            issuer.funds[asset].countries[row.name];

          const disclosed = Number.isFinite(weight);
          const owned = result.portfolio.amounts[asset] > 0;
          const part = row.parts[asset];

          const share = row.weight > 0
            ? part / row.weight * 100
            : 0;

          const amount = result.value > 0
            ? result.value * part / 100
            : null;

          const wording = !owned
            ? "No holding in this ETF"
            : disclosed
              ? pct(share) + " comes through " + asset
              : "Country weight not separately disclosed";

          return `
            <div class="atlas-fund"
              style="--fund-color:${COLORS[asset]}">
              <div class="atlas-fund-head">
                <strong>${asset}</strong>
                <span>${disclosed ? money(amount) : "—"}</span>
              </div>

              <div class="atlas-fund-track" aria-hidden="true">
                <span style="width:${
                  Math.max(0, Math.min(100, share))
                }%"></span>
              </div>

              <p>${wording}</p>
            </div>
          `;
        }).join("");

    const formula = funds.map(asset => {
      const weight =
        issuer.funds[asset].countries[row.name];

      return "<p><strong>" + asset + "</strong>: " + (
        Number.isFinite(weight)
          ? pct(weight) +
            " within the ETF; contributes " +
            percentFormatter.format(row.parts[asset]) +
            " percentage points to this view."
          : "No separate country weight disclosed."
      ) + "</p>";
    }).join("");

    target.innerHTML = `
      <div class="xray-inspector-country">
        <h3 id="xray-inspector-title">${
          escapeHtml(row.name)
        }</h3>
      </div>

      <div class="xray-inspector-big">
        <strong>${pct(row.weight)}</strong>
        <span>${
          missing ? "Disclosed share of " : "of "
        }${
          mode === "ALL" ? "your portfolio" : mode
        }</span>
      </div>

      <div class="xray-inspector-eur">
        <span>${
          result.portfolio.market
            ? "Estimated value"
            : "Invested capital estimate"
        }</span>
        <strong>${money(implied)}</strong>
      </div>

      ${split}

      ${
        missing
          ? '<p class="atlas-disclosure">Additional exposure may be included in Other markets.</p>'
          : ""
      }

      ${
        aggregate
          ? '<p class="atlas-disclosure">Countries not individually listed by the issuer.</p>'
          : ""
      }

      ${
        mode !== "ALL" && !(result.value > 0)
          ? '<p class="atlas-disclosure">No ' +
            mode +
            " holding is saved in this browser.</p>"
          : ""
      }

      ${dates}

      <details class="atlas-calculation">
        <summary>Calculation details</summary>

        <div>
          ${formula}

          <p>
            Euro estimates combine your ETF values with
            dated issuer allocations. The split shows each
            ETF’s share of the disclosed exposure to this
            country. Country classifications do not describe
            every company’s revenue sources.
            SXR8 is excluded.
          </p>
        </div>
      </details>
    `;
  }

  // COUNTRY RANKING

  function renderCountryList(result) {
    const list = $("xray-country-list");
    const showAll = $("xray-show-all");

    if (!result.countries.length) {
      list.innerHTML = `
        <div class="xray-list-loading">${
          accountError
            ? escapeHtml(accountError)
            : "No portfolio allocation yet. Choose VWCE or VFEA above to inspect the issuer's country weights."
        }</div>
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
      const width = Math.min(
        100, row.weight / maximum * 100
      );

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
            <span class="xray-rank-index">${
              String(index + 1).padStart(2, "0")
            }</span>
            <span>${escapeHtml(row.name)}</span>
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

    showAll.hidden = result.countries.length <= 10;

    showAll.setAttribute(
      "aria-expanded", String(expanded)
    );

    showAll.textContent = expanded
      ? "SHOW TOP 10 ↑"
      : "EXPLORE ALL COUNTRIES ↓";
  }

  // REGIONAL ALLOCATION

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
      (sum, row) => sum + row.weight, 0
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
            <span style="
              width:${Math.min(100, row.weight)}%;
              background:${colour};
            "></span>
          </div>
        </div>
      `;
    }).join("");
  }

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
    updateAtlas(result);
  }

  // CSV EXPORT

  function csvCell(value) {
    return '"' +
      String(value ?? "").replace(/"/g, '""') +
      '"';
  }

  function exportCsv() {
    if (!currentResult?.countries.length) return;

    const result = currentResult;

    const rows = [[
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
    ]];

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
      mode.toLowerCase() + "-" +
      new Date().toISOString().slice(0, 10) +
      ".csv";

    document.body.append(link);
    link.click();
    link.remove();

    setTimeout(
      () => URL.revokeObjectURL(url), 2000
    );
  }

  // REMOTE DATA

  async function fetchJson(url) {
    const controller = new AbortController();

    const timeout = setTimeout(
      () => controller.abort(), 15000
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
      issuer = validateCountryData(
        await fetchJson(COUNTRY_URL)
      );

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
    if (priceLoading || document.hidden) return;

    priceLoading = true;
    priceAttempt = Date.now();

    try {
      prices = parsePrices(
        await fetchJson(
          PRICE_URL + "?v=" + priceAttempt
        )
      );

      priceStatus = "EUR quotes connected";
    } catch (error) {
      console.warn(
        "NORTHSTAR X-Ray: market feed unavailable",
        error
      );

      // Retain previously validated prices.
      priceStatus = "Refresh unavailable";
    }

    priceLoading = false;
    render();
    schedulePrices();
  }

  function schedulePrices() {
    clearTimeout(priceTimer);

    if (document.hidden) return;

    const state = marketState();

    priceTimer = setTimeout(
      loadPriceData,
      state.known && !state.open
        ? 30 * 60000
        : 5 * 60000
    );
  }

  // CELESTIAL BACKGROUND

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
      dpr = Math.min(devicePixelRatio || 1, 1.75);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

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
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#c4d4e2";

      for (const star of stars) {
        const speed = [0.6, 2, 4][star.layer];

        const x = wrap(
          star.x + time * speed, width
        );

        const y = wrap(
          star.y - time * speed * 0.16, height
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
          star.alpha * edge * (
            0.9 +
            0.1 * Math.sin(time * 0.5 + star.phase)
          );

        context.beginPath();

        context.arc(
          x, y, star.radius, 0, TAU
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
        "motion-paused", paused
      );

      button.setAttribute(
        "aria-pressed", String(paused)
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
      "change", updateMotion
    );

    document.addEventListener(
      "visibilitychange", () => {
        document.body.classList.toggle(
          "tab-hidden", document.hidden
        );

        if (document.hidden) stop();
        else wake();
      }
    );

    addEventListener(
      "resize", resize, { passive: true }
    );

    resize();
    updateMotion();
  }

  // NAVIGATION

  function setupNavigation() {
    const nav = document.querySelector(".nav");
    if (!nav) return;

    function positionBeacon() {
      const active = nav.querySelector("a.active");
      if (!active) return;

      const bounds = active.getBoundingClientRect();
      const parent = nav.getBoundingClientRect();

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
      "resize", positionBeacon, { passive: true }
    );

    requestAnimationFrame(positionBeacon);
  }

  function setupEvents() {
    $("xray-filters").addEventListener(
      "click", event => {
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
      "click", event => {
        const button = event.target.closest(
          "[data-country]"
        );

        if (!button) return;

        selectCountry(
          button.dataset.country, "ranking"
        );

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
      "click", () => {
        expanded = !expanded;
        renderCountryList(currentResult);
      }
    );

    $("xray-export").addEventListener(
      "click", exportCsv
    );
  }

  // ATLAS CONTROLS AND PRESENTATION

  function setupAtlas() {
    const style = document.createElement("style");

    style.textContent = `
      .atlas-tools {
        display: flex;
        align-items: end;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--xr-line);
        background: #09111b;
      }

      .atlas-search {
        flex: 1;
        min-width: 0;
        margin: 0;
      }

      .atlas-search label {
        display: block;
        margin-bottom: 8px;
        color: var(--xr-muted);
        font-size: 13px;
      }

      .atlas-search-row {
        display: flex;
        gap: 8px;
      }

      .atlas-search input {
        box-sizing: border-box;
        width: 100%;
        min-width: 0;
        height: 46px;
        padding: 10px 12px;
        border: 1px solid var(--xr-line-strong);
        border-radius: 4px;
        background: #070e17;
        color: var(--xr-text);
        font-size: 16px;
        font-family: inherit;
      }

      .atlas-tools button {
        min-height: 46px;
        padding: 10px 14px;
        border: 1px solid #cdb78c55;
        border-radius: 4px;
        background: #cdb78c0a;
        color: #ebdec5;
        font-size: 14px;
        cursor: pointer;
        white-space: nowrap;
      }

      .atlas-tools :focus-visible {
        outline: 2px solid var(--xr-cyan);
        outline-offset: 3px;
      }

      .atlas-selection {
        padding: 13px 20px;
        border-top: 1px solid var(--xr-line);
        color: var(--xr-muted);
        font: 12px/1.7 var(--xr-mono);
      }

      .atlas-selection strong {
        color: var(--xr-text);
        font-weight: 500;
      }

      .atlas-marker {
        fill: none;
        stroke: #f1dfb9;
        stroke-width: 1.8;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
      }

      .atlas-selected-name {
        fill: #f1dfb9;
        font: 13px var(--xr-mono);
        paint-order: stroke;
        stroke: #08111b;
        stroke-width: 4px;
        stroke-linejoin: round;
        pointer-events: none;
      }

      .xray-country.is-selected {
        stroke: #f3e2bd;
        stroke-width: 2.2;
      }

      .xray-country-row.is-selected {
        box-shadow: inset 3px 0 #cdb78c;
        background: #cdb78c0b;
        padding-left: 12px;
      }

      .atlas-fund {
        margin-top: 18px;
        padding: 17px 0;
        border-top: 1px solid var(--xr-line);
      }

      body.xray-page .atlas-fund {
        margin-top: 20px;
        padding: 20px 0;
      }

      body.xray-page .atlas-fund p {
        margin: 12px 0 0;
        font-size: 15px;
        line-height: 1.7;
      }

      body.xray-page .atlas-fund-head span {
        font-size: 17px;
      }

      body.xray-page .atlas-dates {
        gap: 8px;
        font-size: 13px;
        line-height: 1.7;
      }

      .atlas-calculation {
        margin-top: 22px;
        border-top: 1px solid var(--xr-line);
      }

      .atlas-calculation > summary {
        display: flex;
        align-items: center;
        gap: 15px;
        min-height: 48px;
        padding: 16px 0;
        list-style: none;
        cursor: pointer;
        color: var(--xr-text);
        font-size: 14px;
      }

      .atlas-calculation > summary::-webkit-details-marker {
        display: none;
      }

      .atlas-calculation > summary::after {
        content: "+";
        margin-left: auto;
        color: var(--xr-gold);
        font-size: 20px;
      }

      .atlas-calculation[open] > summary::after {
        content: "−";
      }

      .atlas-calculation p {
        margin: 12px 0;
        color: var(--xr-muted);
        font-size: 14px;
        line-height: 1.8;
      }

      .atlas-calculation summary:focus-visible {
        outline: 2px solid var(--xr-cyan);
        outline-offset: 3px;
      }

      .atlas-fund-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .atlas-fund-head strong {
        font-size: 17px;
        color: var(--fund-color);
      }

      .atlas-fund-head span {
        color: #e7edf1;
        font: 15px var(--xr-mono);
      }

      .atlas-fund p {
        margin: 10px 0;
        color: var(--xr-muted);
        font-size: 13px;
        line-height: 1.8;
      }

      .atlas-fund small {
        display: block;
        color: var(--xr-dim);
        font-size: 12px;
        line-height: 1.8;
      }

      .atlas-fund-track {
        height: 4px;
        background: #24313d;
        margin: 12px 0;
      }

      .atlas-fund-track span {
        display: block;
        height: 100%;
        background: var(--fund-color);
      }

      .atlas-dates {
        display: grid;
        gap: 8px;
        margin-top: 20px;
        padding-top: 18px;
        border-top: 1px solid var(--xr-line);
        font-size: 12px;
        line-height: 1.8;
        color: var(--xr-muted);
      }

      .atlas-dates span {
        color: #e5ded0;
      }

      .atlas-disclosure {
        margin: 18px 0 0;
        color: var(--xr-muted);
        font-size: 13px;
        line-height: 1.8;
      }

      .atlas-live {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }

      .atlas-scale {
        display: flex;
        align-items: center;
        gap: 9px;
        font: 12px var(--xr-mono);
        color: var(--xr-muted);
      }

      .atlas-scale i {
        display: block;
        width: 100px;
        height: 7px;
        border-radius: 2px;
        background: linear-gradient(
          90deg, #2c4d5c, #99dce4
        );
      }

      .atlas-missing {
        display: inline-block;
        width: 9px;
        height: 9px;
        background: #263441;
        border: 1px solid #78909f;
        margin-right: 6px;
      }

      @media (max-width: 700px) {
        .atlas-tools {
          padding: 15px;
          align-items: stretch;
        }

        .atlas-tools > button {
          align-self: end;
        }

        .atlas-search-row button {
          padding-inline: 12px;
        }

        .atlas-selection {
          padding-inline: 15px;
        }
      }

      @media (max-width: 420px) {
        .atlas-tools {
          flex-wrap: wrap;
        }

        .atlas-search {
          flex-basis: 100%;
        }

        .atlas-tools > button {
          width: 100%;
        }
      }
    `;

    document.head.append(style);

    const tools = document.createElement("div");
    tools.className = "atlas-tools";

    tools.innerHTML = `
      <form class="atlas-search" id="atlas-search">
        <label for="atlas-country">
          Find a country
        </label>

        <div class="atlas-search-row">
          <input
            id="atlas-country"
            type="search"
            list="atlas-countries"
            placeholder="e.g. Taiwan"
            autocomplete="off"
            aria-describedby="atlas-search-help"
          >

          <datalist id="atlas-countries"></datalist>

          <button type="submit">Locate ↗</button>
        </div>

        <span class="atlas-live" id="atlas-search-help">
          Enter a country name, then choose Locate.
        </span>
      </form>

      <button id="atlas-clear" type="button">
        Clear selection
      </button>
    `;

    $("xray-map-stage").before(tools);

    const caption = document.createElement("div");
    caption.className = "atlas-selection";
    caption.id = "atlas-selection";

    $("xray-map-stage").after(caption);

    const live = document.createElement("p");
    live.id = "atlas-live";
    live.className = "atlas-live";
    live.setAttribute("role", "status");

    document.querySelector(".xray-atlas").append(live);

    $("atlas-search").addEventListener(
      "submit", event => {
        event.preventDefault();

        const key = countryKey(
          $("atlas-country").value
        );

        const names = atlasNames();

        const exact = names.find(
          name => countryKey(name) === key
        );

        const partial = key
          ? names.filter(name =>
              countryKey(name).includes(key)
            )
          : [];

        const name = exact || (
          partial.length === 1 ? partial[0] : ""
        );

        if (!name) {
          $("atlas-live").textContent =
            partial.length > 1
              ? "Several countries match. Choose a full country name."
              : "Country not found. Choose a name from the suggestions.";

          $("atlas-country").focus();
          return;
        }

        $("atlas-country").value = name;
        selectCountry(name, "search");
      }
    );

    $("atlas-clear").addEventListener(
      "click", () => {
        selected = "";
        $("atlas-country").value = "";

        renderMap(currentResult);
        renderInspector(currentResult);
        renderCountryList(currentResult);
        updateAtlas(currentResult);

        $("atlas-live").textContent =
          "Country selection cleared.";
      }
    );

    document.querySelector(
      ".xray-map-legend"
    ).innerHTML = `
      <span class="atlas-scale">
        Lower <i aria-hidden="true"></i> Higher
      </span>

      <span id="atlas-scale-max"></span>

      <span>
        <b class="atlas-missing" aria-hidden="true"></b>
        Not separately disclosed
      </span>
    `;
  }

  function atlasNames() {
    return [...new Set([
      ...(
        currentResult?.countries.map(
          row => row.name
        ) || []
      ),
      ...mapCountries.map(item => item.name)
    ])].sort((a, b) => a.localeCompare(b));
  }

  function updateAtlas(result) {
    if (!$("atlas-countries")) return;

    const names = atlasNames();
    const signature = names.join("|");

    if (
      $("atlas-countries").dataset.names !== signature
    ) {
      $("atlas-countries").replaceChildren(
        ...names.map(name => {
          const option = document.createElement("option");
          option.value = name;
          return option;
        })
      );

      $("atlas-countries").dataset.names = signature;
    }

    const row = findCountry(result, selected);

    const maximum = Math.max(
      0,
      ...result.countries
        .filter(row => row.name !== "Other markets")
        .map(row => row.weight)
    );

    $("atlas-scale-max").textContent = maximum
      ? "Scale: 0–" + pct(maximum)
      : "No reported allocation";

    $("atlas-selection").replaceChildren();

    const label = document.createElement("strong");
    label.textContent =
      selected || "Select a country";

    $("atlas-selection").append(
      label,
      document.createTextNode(
        selected
          ? row
            ? " · " + pct(row.weight) +
              " disclosed exposure"
            : " · not individually disclosed"
          : " · use the map, finder or country ranking"
      )
    );
  }

  // INITIALIZATION

  function initialize() {
    account = readAccount();

    setupSky();
    setupNavigation();
    setupAtlas();
    setupEvents();

    render();

    loadWorldMap();
    loadIssuerData();
    loadPriceData();

    const resumePrices = () => {
      if (document.hidden) {
        clearTimeout(priceTimer);
        return;
      }

      account = readAccount();

      if (Date.now() - priceAttempt > 60000) {
        loadPriceData();
      } else {
        schedulePrices();
      }

      render();
    };

    document.addEventListener(
      "visibilitychange", resumePrices
    );

    addEventListener(
      "focus", resumePrices
    );

    addEventListener("storage", event => {
      if (
        event.key === STORAGE_KEY ||
        event.key === null
      ) {
        account = readAccount();
        render();
      }
    });

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
