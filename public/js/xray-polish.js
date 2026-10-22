/* NORTHSTAR / a quieter atlas.
   Presentation only; no storage or valuation changes. */
(() => {
  'use strict';

  function start() {
    if (!document.body.classList.contains('xray-page')) return;
    if (document.body.classList.contains('xr-refined')) return;

    document.body.classList.add('xr-refined');

    const style = document.createElement('style');

    style.textContent = `
      body.xray-page.xr-refined {
        --xr-ui: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        --xr-mono: var(--xr-ui);
        --xr-selection: #ead7b1;
        font-family: var(--xr-ui);
      }

      .xr-refined .xray-shell {
        width: 100%;
        max-width: 1440px;
        margin-inline: auto;
        padding-inline: clamp(22px, 5vw, 72px);
      }

      .xr-refined.readability .xray-intro {
        max-width: 800px;
        margin-inline: auto;
        padding: 0 0 24px;
        text-align: center;
      }

      .xr-refined.readability .xray-intro-grid {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 26px;
        padding: clamp(42px, 6vw, 76px) 0 0;
      }

      .xr-refined.readability .xray-intro h1 {
        font-size: clamp(36px, 4.4vw, 58px);
        line-height: 1.12;
        margin: 18px 0 24px;
      }

      .xr-refined.readability .xray-intro-description {
        max-width: 44ch;
        margin-inline: auto;
        font-size: 16px;
      }

      .xr-refined .xray-intro-meta {
        justify-content: center;
      }

      .xr-refined .xray-eyebrow,
      .xr-refined .xray-overline,
      .xr-refined .xray-small-label,
      .xr-refined .xray-map-legend > span,
      .xr-refined .xray-map-bottom,
      .xr-refined .atlas-selection,
      .xr-refined .atlas-scale {
        font-family: var(--xr-ui);
        letter-spacing: .015em;
      }

      .xr-refined .xray-snapshot {
        width: min(100%, 640px);
        background: transparent;
        border: 0;
        box-shadow: none;
      }

      .xr-refined .xray-snapshot::before,
      .xr-refined .xray-snapshot-top,
      .xr-refined .xray-snapshot-rule {
        display: none;
      }

      .xr-refined.readability .xray-snapshot-body {
        padding: 0;
      }

      .xr-refined .xray-snapshot-body .xray-small-label {
        display: inline;
        margin-right: 8px;
        font-size: 13px;
      }

      .xr-refined .xray-snapshot-body .xray-small-label:last-of-type {
        display: none;
      }

      .xr-refined.readability .xray-snapshot-body > strong {
        display: inline;
        font: 400 14px/1.8 var(--xr-ui);
        letter-spacing: 0;
      }

      .xr-refined.readability #xray-data-status {
        margin: 10px 0 0;
        font-size: 13px;
      }

      .xr-refined .xray-metrics {
        margin: 34px auto 0;
        border: 0;
        background: transparent;
        text-align: center;
      }

      .xr-refined.readability .xray-metric {
        padding: 26px 18px;
        background: transparent;
        border-color: #a4b5c514;
      }

      .xr-refined .xray-metric > strong {
        font-family: var(--xr-ui);
        font-size: clamp(22px, 2.4vw, 32px);
        font-weight: 400;
        letter-spacing: -.035em;
      }

      .xr-refined.readability .xray-atlas {
        padding-top: clamp(48px, 6vw, 80px);
      }

      .xr-refined.readability .xray-section-header {
        flex-direction: column;
        align-items: center;
        gap: 18px;
        margin-bottom: 34px;
        text-align: center;
      }

      .xr-refined .xray-section-header p {
        margin-inline: auto;
      }

      .xr-refined.readability .xray-map-legend {
        max-width: none;
        padding-top: 0;
        justify-content: center;
      }

      .xr-refined.readability .xray-atlas-grid {
        grid-template-columns:
          minmax(0, 1.85fr) minmax(300px, .85fr);
        gap: clamp(26px, 3.5vw, 50px);
        align-items: start;
      }

      .xr-refined .xray-map-panel,
      .xr-refined .xray-inspector,
      .xr-refined .xray-ranking-panel,
      .xr-refined .xray-region-panel {
        border: 0;
        background: transparent;
        box-shadow: none;
      }

      .xr-refined.readability .xray-panel-toolbar {
        justify-content: center;
        padding: 0 0 18px;
        border: 0;
      }

      .xr-refined .xray-panel-label {
        display: none;
      }

      .xr-refined .xray-filters {
        border-radius: 5px;
        background: #070b1180;
        border-color: #a4b5c522;
      }

      .xr-refined .xray-filters button {
        font-family: var(--xr-ui);
        font-size: 14px;
        letter-spacing: 0;
      }

      .xr-refined .xray-filters button.active {
        color: var(--xr-selection);
        background: #ead7b10b;
      }

      .xr-refined .atlas-tools {
        padding: 0 0 24px;
        border: 0;
        background: transparent;
        gap: 10px;
      }

      .xr-refined .atlas-search label {
        font-size: 13px;
      }

      .xr-refined .atlas-search input {
        background: #0a101980;
        border-color: #a4b5c52b;
        font-family: var(--xr-ui);
      }

      .xr-refined .atlas-tools button {
        background: transparent;
        border-color: #a4b5c52b;
        color: #c2cbd3;
        font-family: var(--xr-ui);
      }

      .xr-refined .atlas-tools button:hover {
        border-color: #ead7b15c;
        color: var(--xr-selection);
      }

      .xr-refined .xray-map-stage {
        min-height: 390px;
        padding: 12px 0;
        background: radial-gradient(
          ellipse, #13233230, transparent 72%
        );
      }

      .xr-refined .xray-map-gridlines {
        opacity: .055;
      }

      .xr-refined .xray-sphere {
        fill: #0b1520;
        fill-opacity: .6;
        stroke: #a4b5c51c;
      }

      .xr-refined .xray-graticule {
        opacity: .38;
      }

      .xr-refined .xray-country {
        stroke: #0a121b;
        stroke-width: .65;
      }

      .xr-refined .xray-country:hover {
        stroke: #ead7b17a;
        stroke-width: 1;
      }

      .xr-refined .xray-country.is-selected {
        stroke: var(--xr-selection);
        stroke-width: 1.1;
        filter: brightness(1.12);
      }

      .xr-refined .xray-country:focus-visible {
        outline: none;
        stroke: var(--xr-selection);
        stroke-width: 1.8;
      }

      .xr-refined #atlas-map-label,
      .xr-refined #atlas-map-marker,
      .xr-refined #xray-tooltip {
        display: none !important;
      }

      .xr-refined .xray-map-bottom,
      .xr-refined .atlas-selection {
        background: transparent;
        border-color: #a4b5c514;
        padding: 16px 0;
        font-size: 12px;
        line-height: 1.8;
      }

      .xr-refined .xray-inspector {
        border-left: 1px solid #a4b5c51c;
        min-height: 0;
        padding-left: clamp(24px, 3vw, 40px);
      }

      .xr-refined.readability .xray-inspector-header {
        padding: 4px 0 24px;
        border: 0;
        font: 400 13px/1.8 var(--xr-ui);
        color: var(--xr-muted);
      }

      .xr-refined.readability .xray-inspector-content {
        padding: 0;
        min-height: 0;
      }

      .xr-refined .xray-inspector-country h3,
      .xr-refined .xray-inspector-placeholder h3 {
        font: 400 clamp(25px, 2.5vw, 34px)/1.25 var(--xr-ui);
        letter-spacing: -.035em;
        margin: 0 0 28px;
      }

      .xr-refined .xray-inspector-big {
        padding: 0;
        border: 0;
      }

      .xr-refined .xray-inspector-big strong {
        font: 350 clamp(38px, 4vw, 54px)/1.12 var(--xr-ui);
        letter-spacing: -.055em;
        font-variant-numeric: tabular-nums;
      }

      .xr-refined .xray-inspector-big span {
        margin-top: 8px;
        font-size: 14px;
      }

      .xr-refined .xray-inspector-eur {
        padding: 24px 0 30px;
        border: 0;
      }

      .xr-refined .xray-inspector-eur > span {
        font: 400 13px/1.7 var(--xr-ui);
        letter-spacing: 0;
      }

      .xr-refined .xray-inspector-eur > strong {
        font: 400 23px/1.4 var(--xr-ui);
        letter-spacing: -.025em;
        margin-top: 6px;
        font-variant-numeric: tabular-nums;
      }

      .xr-refined .xr-split {
        padding: 24px 0;
        border-top: 1px solid #a4b5c51c;
      }

      .xr-refined .xr-split-label {
        margin: 0 0 16px;
        font: 400 13px/1.6 var(--xr-ui);
        color: var(--xr-muted);
      }

      .xr-refined .xr-split-track {
        display: flex;
        gap: 2px;
        height: 4px;
        margin-bottom: 18px;
        background: #a4b5c514;
        overflow: hidden;
        border-radius: 2px;
      }

      .xr-refined .xr-split-track > span {
        display: block;
        flex-shrink: 1;
        height: 100%;
      }

      body.xr-refined .xr-split .atlas-fund {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        padding: 8px 0;
        margin: 0;
        border: 0;
      }

      .xr-refined .atlas-fund-head strong {
        font: 500 14px/1.7 var(--xr-ui);
      }

      body.xr-refined .xr-split .atlas-fund p {
        text-align: right;
        margin: 0;
        font: 400 14px/1.7 var(--xr-ui);
        font-variant-numeric: tabular-nums;
      }

      .xr-refined .atlas-calculation {
        margin-top: 8px;
        border-color: #a4b5c51c;
      }

      .xr-refined .atlas-calculation > summary {
        color: var(--xr-muted);
        font-family: var(--xr-ui);
      }

      .xr-refined .atlas-calculation .atlas-dates {
        border: 0;
        padding: 0 0 20px;
        margin-top: 6px;
      }

      .xr-refined .xr-fund-amounts {
        margin-bottom: 20px;
      }

      .xr-refined .xr-fund-amounts p {
        font-variant-numeric: tabular-nums;
      }

      .xr-refined .xray-inspector-footer {
        padding: 20px 0 0;
        border-color: #a4b5c514;
        font-family: var(--xr-ui);
        letter-spacing: 0;
      }

      .xr-refined.readability .xray-details {
        margin-top: clamp(54px, 7vw, 96px);
        gap: clamp(34px, 5vw, 72px);
      }

      .xr-refined.readability .xray-ranking-panel,
      .xr-refined.readability .xray-region-panel {
        padding: 32px 0 0;
        border-top: 1px solid #a4b5c522;
      }

      .xr-refined .xray-detail-heading {
        gap: 16px;
      }

      .xr-refined .xray-country-row.is-selected {
        background: #ead7b106;
        box-shadow: inset 2px 0 var(--xr-selection);
      }

      .xr-refined .xray-rank-value strong,
      .xr-refined .xray-rank-value small,
      .xr-refined .xray-region-row strong {
        font-family: var(--xr-ui);
        font-variant-numeric: tabular-nums;
      }

      .xr-refined .xray-rank-value strong,
      .xr-refined .xray-region-row strong {
        font-size: 16px;
      }

      .xr-refined .xray-methodology {
        background: transparent;
        border-inline: 0;
      }

      @media (max-width: 1000px) {
        .xr-refined.readability .xray-atlas-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 36px;
        }

        .xr-refined .xray-inspector {
          width: min(100%, 640px);
          margin-inline: auto;
          border-left: 0;
          border-top: 1px solid #a4b5c51c;
          padding: 28px 0 0;
        }

        .xr-refined.readability .xray-inspector-header {
          padding-bottom: 18px;
        }

        .xr-refined .xray-map-stage {
          min-height: 0;
        }
      }

      @media (max-width: 620px) {
        .xr-refined .xray-shell {
          padding-inline: 22px;
        }

        .xr-refined.readability .xray-intro-grid {
          padding-top: 36px;
          gap: 22px;
        }

        .xr-refined.readability .xray-intro h1 {
          font-size: clamp(34px, 8vw, 46px);
        }

        .xr-refined.readability .xray-metric {
          padding: 22px 10px;
        }

        .xr-refined .atlas-tools {
          flex-wrap: wrap;
          gap: 12px;
        }

        .xr-refined .atlas-search {
          flex-basis: 100%;
        }

        .xr-refined .atlas-tools > button {
          width: auto;
          margin-left: auto;
          min-height: 44px;
          padding: 8px 12px;
        }

        .xr-refined #xray-map {
          width: 100%;
          min-width: 0;
          height: auto;
        }

        .xr-refined.readability .xray-details {
          gap: 40px;
        }

        .xr-refined .xray-detail-heading {
          flex-wrap: wrap;
        }
      }
    `;

    document.head.append(style);

    const panel = document.getElementById(
      'xray-inspector-content'
    );

    if (!panel) return;

    function refinePanel() {
      const funds = [...panel.children].filter(node =>
        node.classList.contains('atlas-fund')
      );

      const calculation = panel.querySelector(
        '.atlas-calculation > div'
      );

      const dates = panel.querySelector(
        ':scope > .atlas-dates'
      );

      if (calculation && dates) {
        calculation.prepend(dates);
      }

      if (!funds.length) return;

      const split = document.createElement('div');
      split.className = 'xr-split';

      const label = document.createElement('p');
      label.className = 'xr-split-label';

      const countryName = panel.querySelector(
        '#xray-inspector-title'
      )?.textContent.trim();

      label.textContent = countryName === 'Other markets'
        ? 'Share of this grouped exposure'
        : 'Share of this country’s disclosed exposure';

      const track = document.createElement('div');
      track.className = 'xr-split-track';
      track.setAttribute('aria-hidden', 'true');

      const amounts = document.createElement('div');
      amounts.className = 'xr-fund-amounts';

      funds[0].before(split);
      split.append(label, track);

      funds.forEach(fund => {
        const originalTrack = fund.querySelector(
          '.atlas-fund-track'
        );

        const originalSegment = originalTrack
          ?.querySelector('span');

        const wording = fund.querySelector('p');

        const amount = fund.querySelector(
          '.atlas-fund-head > span'
        );

        const name = fund.querySelector('strong')
          ?.textContent || '';

        if (originalSegment) {
          const segment = document.createElement('span');

          segment.style.width = originalSegment.style.width;

          segment.style.background =
            fund.style.getPropertyValue('--fund-color');

          track.append(segment);
        }

        originalTrack?.remove();

        if (wording) {
          const match = wording.textContent.trim().match(
            /^([\d.,]+%) comes through /
          );

          if (match) {
            wording.textContent = match[1];
          }
        }

        if (amount && calculation) {
          const detail = document.createElement('p');

          detail.textContent =
            name + ' estimated exposure: ' +
            amount.textContent;

          amounts.append(detail);
          amount.remove();
        }

        split.append(fund);
      });

      if (calculation && amounts.children.length) {
        calculation.append(amounts);
      }
    }

    const observer = new MutationObserver(refinePanel);

    observer.observe(panel, {
      childList: true
    });

    refinePanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      start,
      {once: true}
    );
  } else {
    start();
  }
})();
