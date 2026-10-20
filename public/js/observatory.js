/*
  NORTHSTAR presentation layer.
  No portfolio persistence.
  No external network requests.
*/

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const reduced = matchMedia(
    "(prefers-reduced-motion: reduce)"
  );

  let paused = reduced.matches;
  let stateTimer;
  let tiltFrame = 0;

  const instrument = $("instrument");
  const tilt = $("core-tilt");

  let introSeen = false;

  try {
    introSeen =
      sessionStorage.getItem("northstar-entrance") === "seen";

    sessionStorage.setItem("northstar-entrance", "seen");
  } catch {}

  if (!introSeen && !paused) {
    document.body.classList.add("intro");

    setTimeout(() => {
      document.body.classList.remove("intro");
    }, 2800);
  }

  function updateMotion() {
    document.body.classList.toggle(
      "motion-paused", paused
    );

    $("motion-toggle").setAttribute(
      "aria-pressed", String(paused)
    );

    $("motion-toggle").setAttribute(
      "aria-label",
      paused
        ? "Resume ambient motion"
        : "Pause ambient motion"
    );

    $("motion-toggle").querySelector("span").textContent =
      paused ? "OFF" : "ON";
  }

  $("motion-toggle").addEventListener("click", () => {
    paused = !paused;
    updateMotion();
  });

  reduced.addEventListener("change", () => {
    paused = reduced.matches;
    updateMotion();
  });

  updateMotion();

  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle(
      "tab-hidden", document.hidden
    );
  });

  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      instrument.classList.toggle(
        "offscreen", !entry.isIntersecting
      );
    });
  }).observe(instrument);

  // Calibration marks for the SVG fallback.

  const ticks = [];

  for (let index = 0; index < 120; index++) {
    const theta = index * Math.PI / 60;
    const outer = 224;

    const inner =
      index % 10 === 0 ? 214 :
      index % 5 === 0 ? 217 : 221;

    ticks.push(`
      <line
        x1="${250 + Math.sin(theta) * inner}"
        y1="${250 - Math.cos(theta) * inner}"
        x2="${250 + Math.sin(theta) * outer}"
        y2="${250 - Math.cos(theta) * outer}"
        opacity="${index % 5 === 0 ? 0.65 : 0.25}"
        stroke-width="${index % 10 === 0 ? 1.3 : 0.7}"
      />
    `);
  }

  $("precision-ticks").innerHTML = ticks.join("");

  let pointerX = 0;
  let pointerY = 0;

  instrument.addEventListener("pointermove", event => {
    if (
      paused ||
      reduced.matches ||
      document.hidden
    ) return;

    pointerX = event.clientX;
    pointerY = event.clientY;

    if (tiltFrame) return;

    tiltFrame = requestAnimationFrame(() => {
      tiltFrame = 0;

      const rect = instrument.getBoundingClientRect();

      const yaw =
        (pointerX - rect.left - rect.width / 2) /
        rect.width * 12;

      const pitch =
        -(pointerY - rect.top - rect.height / 2) /
        rect.height * 10;

      tilt.style.setProperty("--yaw", `${yaw}deg`);
      tilt.style.setProperty("--pitch", `${pitch}deg`);
    });
  }, { passive: true });

  function resetTilt() {
    if (tiltFrame) cancelAnimationFrame(tiltFrame);

    tiltFrame = 0;

    tilt.style.setProperty("--yaw", "0deg");
    tilt.style.setProperty("--pitch", "0deg");
  }

  instrument.addEventListener("pointerleave", resetTilt);
  instrument.addEventListener("pointerup", resetTilt);
  instrument.addEventListener("pointercancel", resetTilt);

  // Presentation feedback from the financial engine.

  document.addEventListener("northstar:state", event => {
    clearTimeout(stateTimer);

    document.body.dataset.state = event.detail;
    $("refresh").disabled = event.detail === "loading";

    const labels = {
      loading: "ACQUIRING DATA",
      updated: "DATA SYNCHRONIZED",
      warning: "DATA ATTENTION",
      idle: "OBSERVATORY READY"
    };

    $("core-state").textContent = labels[event.detail];

    if (event.detail === "updated") {
      stateTimer = setTimeout(() => {
        document.body.dataset.state = "idle";
        $("core-state").textContent = "OBSERVATORY READY";
      }, 1900);
    }
  });

  function currency(value) {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: "EUR"
    }).format(value);
  }

  document.addEventListener("northstar:summary", event => {
    const summary = event.detail;

    // Exact values only; no invented intermediate totals.

    $("hero-value").textContent =
      summary.value === null
        ? "—"
        : currency(summary.value);

    if (!summary.count) {
      $("hero-pl").textContent =
        "No purchases saved in this browser";
    } else if (summary.profit === null) {
      $("hero-pl").textContent =
        "Valuation unavailable";
    } else {
      const sign = summary.profit >= 0 ? "+" : "−";

      const returnPercent = (
        summary.profit / summary.invested * 100
      ).toFixed(2);

      $("hero-pl").textContent =
        `${sign}${currency(Math.abs(summary.profit))}` +
        `  /  ${summary.profit >= 0 ? "+" : ""}` +
        `${returnPercent}% on invested capital`;
    }

    $("hero-pl").className =
      "hero-pl " + (
        summary.count && summary.profit !== null
          ? summary.profit >= 0 ? "up" : "down"
          : ""
      );

    const age = summary.date
      ? (
          Date.now() -
          Date.parse(summary.date + "T12:00:00Z")
        ) / 86400000
      : Infinity;

    $("hero-date").textContent = summary.date
      ? (
          summary.status === "warning"
            ? "UNVERIFIED FALLBACK / "
            : ""
        ) +
        `LATEST CLOSE / ${summary.date}` +
        (age > 5 ? " / STALE DATA" : "")
      : "MARKET DATA UNAVAILABLE";

    if (age > 5 && summary.date) {
      clearTimeout(stateTimer);

      document.body.dataset.state = "warning";
      $("core-state").textContent = "STALE MARKET DATA";
    }

    if (!summary.count && $("pf-trades")) {
      $("pf-trades").innerHTML = `
        <tr>
          <td colspan="5">
            No purchases in this browser.
            Import a backup below to begin.
          </td>
        </tr>
      `;
    }

    const bar = $("pf-bar");

    if (bar) {
      bar.setAttribute("role", "img");

      bar.setAttribute(
        "aria-label",
        !summary.count
          ? "No asset allocation"
          : `${summary.allocationBasis} allocation: ` +
            `World ${summary.allocation.toFixed(1)}%, ` +
            `Emerging ${(100 - summary.allocation).toFixed(1)}%.`
      );

      if (!summary.count) {
        bar.style.background = "#273548";
      }
    }
  });

  $("refresh").addEventListener("click", () => {
    $("pf-refresh")?.click();
  });

  /*
    Refine the performance presentation.
    Existing chart elements and engine listeners are retained.
  */

  function setupPerformancePresentation() {
    const chart = $("pf-chart");
    const panel = chart?.closest("section");
    const modes = $("pf-modes");
    const note = $("pf-chart-note");

    if (
      !panel ||
      !modes ||
      !note ||
      panel.classList.contains("performance-refined")
    ) return;

    panel.classList.add("performance-refined");

    const heading = panel.querySelector(".pf-top h2");

    if (heading) heading.textContent = "Performance";

    panel.querySelector(".pf-top .pf-micro")?.remove();

    const capital = modes.querySelector(
      '[data-mode="capital"]'
    );

    const market = modes.querySelector(
      '[data-mode="market"]'
    );

    if (capital) capital.textContent = "Your portfolio";
    if (market) market.textContent = "ETF returns";

    modes.setAttribute("role", "group");
    modes.setAttribute(
      "aria-label", "Performance calculation"
    );

    $("pf-periods")?.setAttribute("role", "group");
    $("pf-periods")?.setAttribute(
      "aria-label", "Chart timeframe"
    );

    $("pf-legend")?.setAttribute("role", "group");
    $("pf-legend")?.setAttribute(
      "aria-label", "Visible chart series"
    );

    const basis = document.createElement("p");

    basis.className = "performance-basis";
    basis.id = "performance-basis";

    modes.after(basis);

    function syncBasis() {
      const marketMode =
        market?.getAttribute("aria-pressed") === "true";

      basis.textContent = marketMode
        ? "ETF price returns · rebased at the start of the selected window"
        : "Gain ÷ contributed capital · since first purchase · not time-weighted";
    }

    modes.addEventListener("click", () => {
      queueMicrotask(syncBasis);
    });

    syncBasis();

    const explanation = document.createElement("details");
    explanation.className = "performance-explanation";

    const toggle = document.createElement("summary");
    toggle.textContent = "How this chart is calculated";

    note.before(explanation);
    explanation.append(toggle, note);

    const style = document.createElement("style");

    style.textContent = `
      body.goal-enabled #view-investments #pf-root > .performance-refined {
        column-gap: 24px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined .pf-top {
        margin-bottom: 18px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined .pf-top h2 {
        margin: 0;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-modes {
        display: inline-flex;
        width: fit-content;
        max-width: 100%;
        gap: 4px;
        padding: 4px;
        margin: 0;
        border: 1px solid #a4b5c52a;
        border-radius: 6px;
        background: #070e16;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-modes button {
        min-height: 46px;
        padding: 11px 18px;
        border: 1px solid transparent;
        border-radius: 3px;
        background: transparent;
        color: #acbac8;
        font-size: 14px;
        font-weight: 400;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-modes button.active {
        border-color: #b8cbd52b;
        background: #b9d6e510;
        color: #f0e4cd;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined .performance-basis {
        margin: 14px 0 20px;
        color: #acbac8;
        font-size: 13px;
        line-height: 1.8;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-legend {
        gap: 4px 16px;
        align-content: center;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-legend button {
        min-height: 44px;
        padding: 10px 0;
        font-size: 14px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-legend button:not(.active) {
        text-decoration: line-through;
        color: #91a0b0;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-periods {
        gap: 4px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-periods button {
        min-width: 44px;
        min-height: 44px;
        font-size: 13px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout {
        gap: 12px 22px;
        min-height: 66px;
        margin-top: 12px;
        padding: 16px 0;
        border-top: 1px solid #a4b5c51c;
        border-bottom: 1px solid #a4b5c51c;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout time {
        font-size: 12px;
        color: #adbdcc;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout span,
      body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout b {
        font-size: 14px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-chart {
        margin-top: 12px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined .performance-explanation {
        margin-top: 18px;
        border-top: 1px solid #a4b5c522;
      }

      .performance-explanation > summary {
        display: flex;
        align-items: center;
        gap: 20px;
        min-height: 48px;
        padding: 14px 0;
        list-style: none;
        color: #c6d0d8;
        font-size: 14px;
        cursor: pointer;
      }

      .performance-explanation > summary::-webkit-details-marker {
        display: none;
      }

      .performance-explanation > summary::after {
        content: "+";
        margin-left: auto;
        color: #cdb78c;
        font-size: 20px;
      }

      .performance-explanation[open] > summary::after {
        content: "−";
      }

      .performance-explanation > summary:focus-visible {
        outline: 2px solid #99dce4;
        outline-offset: 4px;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-chart-note {
        max-width: 85ch;
        margin: 4px 0 16px;
        font-size: 14px;
        line-height: 1.85;
      }

      @media (max-width: 740px) {
        body.goal-enabled #view-investments #pf-root > .performance-refined {
          grid-template-columns: minmax(0, 1fr);
        }

        body.goal-enabled #view-investments #pf-root .performance-refined #pf-periods {
          justify-content: flex-start;
          margin-top: 8px;
        }
      }

      @media (max-width: 620px) {
        body.goal-enabled #view-investments #pf-root .performance-refined #pf-modes {
          width: 100%;
        }

        body.goal-enabled #view-investments #pf-root .performance-refined #pf-modes button {
          flex: 1;
          padding-inline: 12px;
        }

        body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout {
          min-height: 108px;
          gap: 12px 18px;
        }

        body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout time {
          width: 100%;
        }
      }
    `;

    document.head.append(style);
  }

  document.addEventListener("northstar:ready", () => {
    const colors = [
      "#eaf2fa",
      "#4bdcf1",
      "#f6ba49",
      "#c296ff"
    ];

    queueMicrotask(() => {
      setupPerformancePresentation();

      document.querySelectorAll("#pf-legend button")
        .forEach((button, index) => {
          button.style.setProperty(
            "--series-color", colors[index]
          );
        });
    });

    const reveal = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!paused) {
            entry.target.classList.add("reveal-enter");
          }

          reveal.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.08
    });

    document.querySelectorAll(".pf-panel").forEach(panel => {
      reveal.observe(panel);
    });
  });
})();
