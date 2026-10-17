/* Presentation layer:
   No portfolio persistence.
   No external network requests. */

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
    document.body.classList.toggle("motion-paused", paused);

    $("motion-toggle").setAttribute(
      "aria-pressed",
      String(paused)
    );

    $("motion-toggle").setAttribute(
      "aria-label",
      paused ? "Resume ambient motion" : "Pause ambient motion"
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
      "tab-hidden",
      document.hidden
    );
  });

  new IntersectionObserver(entries => {
    entries.forEach(entry => {
      instrument.classList.toggle(
        "offscreen",
        !entry.isIntersecting
      );
    });
  }).observe(instrument);

  // Precision measurement marks around the compass.

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

  // Pointer-responsive perspective, limited to one update per frame.

  let pointerX = 0;
  let pointerY = 0;

  instrument.addEventListener("pointermove", event => {
    if (paused || reduced.matches || document.hidden) {
      return;
    }

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
    if (tiltFrame) {
      cancelAnimationFrame(tiltFrame);
    }

    tiltFrame = 0;

    tilt.style.setProperty("--yaw", "0deg");
    tilt.style.setProperty("--pitch", "0deg");
  }

  instrument.addEventListener("pointerleave", resetTilt);
  instrument.addEventListener("pointerup", resetTilt);
  instrument.addEventListener("pointercancel", resetTilt);

  // Market-data state drives restrained instrument feedback.

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

    // Display exact values; never animate invented intermediate totals.

    $("hero-value").textContent =
      summary.value === null ? "—" : currency(summary.value);

    if (!summary.count) {
      $("hero-pl").textContent =
        "No purchases saved in this browser";
    } else if (summary.profit === null) {
      $("hero-pl").textContent = "Valuation unavailable";
    } else {
      const sign = summary.profit >= 0 ? "+" : "−";

      const returnPercent =
        (summary.profit / summary.invested * 100).toFixed(2);

      $("hero-pl").textContent =
        `${sign}${currency(Math.abs(summary.profit))}` +
        `  /  ${summary.profit >= 0 ? "+" : ""}` +
        `${returnPercent}% on invested capital`;
    }

    $("hero-pl").className =
      "hero-pl " +
      (
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

  document.addEventListener("northstar:ready", () => {
    const colors = [
      "#eaf2fa",
      "#4bdcf1",
      "#f6ba49",
      "#c296ff"
    ];

    queueMicrotask(() => {
      document.querySelectorAll("#pf-legend button")
        .forEach((button, index) => {
          button.style.setProperty(
            "--series-color",
            colors[index]
          );
        });
    });

    const links = [
      ...document.querySelectorAll(".nav a")
    ];

    function activateLink(activeLink) {
      links.forEach(link => {
        const active = link === activeLink;

        link.classList.toggle("active", active);

        if (active) {
          link.setAttribute("aria-current", "location");
        } else {
          link.removeAttribute("aria-current");
        }
      });
    }

    links.forEach(link => {
      link.addEventListener("click", () => {
        activateLink(link);
      });
    });

    const sections = [
      document.querySelector(".observatory"),
      $("pf-chart").closest("section"),
      $("pf-holdings").closest("section"),
      $("pf-trades").closest("section")
    ];

    const navObserver = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort(
          (first, second) =>
            second.intersectionRatio - first.intersectionRatio
        );

      if (!visible.length) return;

      const index = sections.indexOf(visible[0].target);

      activateLink(links[index]);
    }, {
      rootMargin: "-90px 0px -40% 0px",
      threshold: [0, 0.2, 0.5]
    });

    sections.forEach(section => {
      navObserver.observe(section);
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
