/* NORTHSTAR / integrated celestial portfolio. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const reduced = matchMedia(
    '(prefers-reduced-motion: reduce)'
  );

  const paused = () =>
    reduced.matches ||
    document.body.classList.contains('motion-paused');

  const euro = n => Number.isFinite(n)
    ? new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR'
      }).format(n)
    : '—';

  function setupPortfolio() {
    const dialog = $('core-dialog');
    const trigger = $('explore-core');

    if (!dialog || !trigger) return;

    let summary;
    let selected = 'VWCE';

    trigger.textContent = 'Portfolio in focus ↗';
    trigger.setAttribute('aria-haspopup', 'dialog');
    trigger.setAttribute('aria-controls', 'core-dialog');

    $('map-title').textContent = 'Your portfolio, in focus.';

    dialog.querySelector('.eyebrow').textContent =
      'NORTHSTAR / PORTFOLIO';

    $('map-help').textContent =
      'Actual holdings and allocation. SXR8 is a benchmark only ' +
      'and is excluded from your allocation.';

    const focus = document.createElement('div');
    focus.id = 'allocation-focus';

    focus.innerHTML = `
      <div class="focus-total">
        <span>TOTAL PORTFOLIO VALUE</span>
        <strong id="focus-total">—</strong>
        <small id="focus-date">Daily closing prices</small>
      </div>

      <div
        class="focus-allocation"
        role="img"
        aria-label="Allocation unavailable"
      >
        <span></span>
        <span></span>
      </div>

      <div class="focus-legend">
        <div>
          <span><i></i>VWCE / World</span>
          <strong id="focus-world">—</strong>
        </div>
        <div>
          <span><i></i>VFEA / Emerging</span>
          <strong id="focus-emerging">—</strong>
        </div>
      </div>

      <p class="focus-note" id="focus-basis">
        Waiting for portfolio data.
      </p>
    `;

    (
      $('celestial-map') ||
      $('allocation-focus')
    )?.replaceWith(focus);

    $('reset-core')?.remove();

    const bottom = dialog.querySelector('.map-bottom>span');

    if (bottom) {
      bottom.textContent =
        'Daily closing prices · private browser storage';
    }

    function allocation() {
      return summary?.count &&
        Number.isFinite(summary.allocation)
        ? Math.max(0, Math.min(100, summary.allocation))
        : null;
    }

    function updateFocus() {
      if (!summary) return;

      const a = allocation();
      const basis = summary.allocationBasis || 'Market value';

      $('focus-total').textContent = euro(summary.value);

      $('focus-date').textContent =
        $('hero-date')?.textContent ||
        'Closing date unavailable';

      const bar = focus.querySelector('.focus-allocation');

      bar.children[0].style.width = (a ?? 0) + '%';
      bar.children[1].style.width =
        (a === null ? 0 : 100 - a) + '%';

      bar.setAttribute(
        'aria-label',
        a === null
          ? 'Allocation unavailable'
          : `${basis} allocation: VWCE ${a.toFixed(1)}%, ` +
            `VFEA ${(100 - a).toFixed(1)}%.`
      );

      $('focus-world').textContent =
        a === null ? '—' : a.toFixed(1) + '%';

      $('focus-emerging').textContent =
        a === null ? '—' : (100 - a).toFixed(1) + '%';

      $('focus-basis').textContent = summary.count
        ? basis + ' allocation · benchmark excluded'
        : 'No purchases saved in this browser.';
    }

    function details() {
      const box = $('asset-detail');
      const holding = selected !== 'SXR8';

      const row = [
        ...document.querySelectorAll('#pf-holdings tr')
      ].find(r => r.cells[0]?.textContent.includes(selected));

      const quote = [
        ...document.querySelectorAll('.pf-quote')
      ].find(q => q.textContent.includes(selected));

      box.replaceChildren();

      const title = document.createElement('h3');
      title.textContent = selected;

      const description = document.createElement('p');

      description.textContent = !holding
        ? 'S&P 500 reference · benchmark only. ' +
          'Excluded from your holdings and allocation.'
        : selected === 'VWCE'
          ? 'Global equities · holding'
          : 'Emerging markets · holding';

      box.append(title, description);

      if (
        holding &&
        summary?.count &&
        row?.cells.length >= 6
      ) {
        const list = document.createElement('dl');
        list.className = 'asset-metrics';

        [
          'Invested',
          'Shares',
          summary.status === 'warning'
            ? 'Price snapshot'
            : 'Latest close',
          'Market value',
          'Unrealized P/L'
        ].forEach((label, i) => {
          const term = document.createElement('dt');
          const value = document.createElement('dd');

          term.textContent = label;
          value.textContent = row.cells[i + 1].textContent.trim();

          list.append(term, value);
        });

        box.append(list);
      } else {
        const value = document.createElement('p');
        value.className = 'asset-value';

        value.textContent = holding
          ? 'No holding details available for this asset.'
          : quote?.textContent.replace(/\s+/g, ' ').trim() ||
            'Closing price unavailable';

        box.append(value);
      }

      const note = document.createElement('p');
      const a = allocation();

      note.textContent = holding && a !== null
        ? `${summary.allocationBasis || 'Market value'} allocation: ` +
          `${(selected === 'VWCE' ? a : 100 - a).toFixed(1)}%`
        : 'Benchmark excluded from allocation.';

      box.append(note);

      box.style.setProperty(
        '--asset-color',
        selected === 'VWCE'
          ? '#99dce4'
          : selected === 'VFEA'
            ? '#cdb78c'
            : '#bca3ef'
      );
    }

    document.addEventListener('northstar:summary', event => {
      summary = event.detail;
      const a = allocation();

      if ($('core-contributed')) {
        $('core-contributed').textContent = euro(summary.invested);
      }

      if ($('core-allocation')) {
        $('core-allocation').textContent = a === null
          ? '— / —'
          : `${a.toFixed(1)}% / ${(100 - a).toFixed(1)}%`;

        const label = $('core-allocation')
          .parentElement.querySelector('span');

        if (label) {
          label.textContent =
            (summary.allocationBasis || 'Market value')
              .toUpperCase() +
            ' / WORLD : EMERGING';
        }
      }

      if (dialog.open) {
        updateFocus();
        details();
      }
    });

    trigger.addEventListener('click', event => {
      event.preventDefault();
      updateFocus();
      details();

      if (!dialog.open) dialog.showModal();
    });

    $('close-core').addEventListener('click', () => {
      dialog.close();
    });

    dialog.addEventListener('close', () => {
      trigger.focus({ preventScroll: true });
    });

    dialog.querySelectorAll('[data-asset]').forEach(button => {
      button.addEventListener('click', () => {
        selected = button.dataset.asset;

        dialog.querySelectorAll('[data-asset]').forEach(item => {
          item.setAttribute(
            'aria-pressed',
            String(item === button)
          );
        });

        details();
      });
    });
  }

  function setupNavigation() {
    document.addEventListener('northstar:ready', () => {
      const nav = document.querySelector('.nav');

      if (!nav) return;

      const links = [
        ...nav.querySelectorAll('a[href^="#"]')
      ];

      const sections = links.map((link, i) =>
        i
          ? document.querySelector(link.hash)?.closest('section')
          : document.querySelector('.observatory')
      );

      if (sections.some(section => !section)) return;

      sections.forEach((section, i) => {
        if (
          !i ||
          section.querySelector('.section-coordinate')
        ) return;

        const label = document.createElement('div');
        label.className = 'section-coordinate';

        label.textContent =
          `0${i + 1} / ${
            ['OVERVIEW', 'PERFORMANCE', 'HOLDINGS', 'LEDGER'][i] || ''
          }`;

        section.prepend(label);
      });

      let frame = 0;

      function track() {
        frame = 0;

        const boundary = (
          document.querySelector('.masthead')
            ?.getBoundingClientRect().bottom || 0
        ) + 110;

        let active = 0;

        sections.forEach((section, i) => {
          if (section.getBoundingClientRect().top <= boundary) {
            active = i;
          }
        });

        links.forEach((link, i) => {
          link.classList.toggle('active', i === active);

          if (i === active) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }

          sections[i].classList.toggle(
            'section-current',
            i === active
          );
        });

        const bounds = links[active].getBoundingClientRect();

        nav.style.setProperty(
          '--beacon-x',
          (bounds.left - nav.getBoundingClientRect().left) + 'px'
        );

        nav.style.setProperty(
          '--beacon-width',
          bounds.width + 'px'
        );
      }

      function schedule() {
        if (!frame) frame = requestAnimationFrame(track);
      }

      function go(i, animate) {
        const behavior =
          animate && !paused() ? 'smooth' : 'instant';

        if (i === 0) {
          scrollTo({ top: 0, behavior });
        } else {
          sections[i].scrollIntoView({
            behavior,
            block: 'start'
          });
        }

        schedule();
      }

      links.forEach((link, i) => {
        link.addEventListener('click', event => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          ) return;

          event.preventDefault();

          if (location.hash !== link.hash) {
            history.pushState(null, '', link.hash);
          }

          go(i, true);
        });
      });

      function followHash() {
        const i = links.findIndex(
          link => link.hash === location.hash
        );

        if (i >= 0) {
          go(i, false);
        } else {
          schedule();
        }
      }

      addEventListener('scroll', schedule, { passive: true });
      addEventListener('resize', schedule, { passive: true });
      addEventListener('popstate', followHash);
      addEventListener('hashchange', followHash);

      requestAnimationFrame(followHash);
    }, { once: true });
  }

  function setupSky() {
    const background = $('celestial-core');
    const space = document.querySelector('.core-space');
    const instrument = $('instrument');

    if (!background || !space || !instrument) return;

    instrument.classList.add('precision-compass');
    instrument.setAttribute(
      'aria-label',
      'Northstar portfolio compass'
    );

    const hero = document.querySelector('.observatory');
    const copy = hero?.querySelector('.hero-copy');

    if (hero && copy) {
      hero.insertBefore(instrument, copy);
    }

    const compassStyle = document.createElement('style');

    compassStyle.textContent = `
      .precision-compass .core-space::before {
        display: none;
      }

      .precision-compass .compass-open {
        appearance: none;
        position: absolute;
        inset: 0;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        width: 100%;
        height: 100%;
        padding: 0;
        border: 0;
        border-radius: 40%;
        background: transparent;
        color: #acbbc9;
        cursor: pointer;
        z-index: 4;
        -webkit-tap-highlight-color: transparent;
      }

      .precision-compass .compass-open span {
        font: 12px/1.5 var(--mono, monospace);
        letter-spacing: .025em;
        color: #c8b48e;
        transition: color .2s;
      }

      .precision-compass .compass-open:hover span,
      .precision-compass .compass-open:focus-visible span {
        color: #ecdcba;
      }

      .precision-compass .compass-open:focus-visible {
        outline: 2px solid #99dce4;
        outline-offset: 5px;
      }

      body.goal-enabled main > .observatory {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0;
        min-height: 0;
        padding: 16px 0 44px;
      }

      body.goal-enabled main > .observatory #instrument.precision-compass {
        width: 100%;
        max-width: 900px;
        margin: 0 auto;
        align-self: center;
      }

      body.goal-enabled #instrument.precision-compass .core-space {
        width: 100%;
        height: clamp(260px, 25vw, 340px);
        aspect-ratio: auto;
        touch-action: pan-y;
      }

      body.goal-enabled main > .observatory .hero-copy {
        width: 100%;
        max-width: 680px;
        padding: 18px 0 0;
        text-align: center;
      }

      body.goal-enabled .observatory .hero-valuation {
        border: 0;
        padding: 0;
      }

      body.goal-enabled .observatory .hero-valuation .label {
        font-size: 10px;
        letter-spacing: .13em;
      }

      body.goal-enabled main > .observatory .hero-valuation > strong {
        display: block;
        margin: 12px 0 10px;
        font-size: clamp(38px, 4vw, 52px);
        line-height: 1.12;
        letter-spacing: -.045em;
        font-variant-numeric: tabular-nums;
        font-weight: 350;
      }

      body.goal-enabled .observatory .hero-pl {
        font-size: 13px;
        line-height: 1.7;
      }

      body.goal-enabled .observatory .hero-facts {
        display: flex;
        justify-content: center;
        gap: 22px 36px;
        flex-wrap: wrap;
        padding: 0;
        margin: 22px 0 0;
      }

      body.goal-enabled .observatory .hero-facts span {
        font-size: 9px;
        line-height: 1.8;
        color: #91a2b1;
      }

      body.goal-enabled .observatory .hero-facts strong {
        font-size: 13px;
        margin-top: 5px;
      }

      body.goal-enabled .observatory .hero-actions {
        display: none;
      }

      body.goal-enabled .observatory .data-status {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
        margin: 22px auto 0;
        max-width: 100%;
      }

      body.goal-enabled .observatory #hero-date {
        min-width: 0;
        max-width: 520px;
        white-space: normal;
        font-size: 10px;
        line-height: 1.9;
        letter-spacing: .025em;
      }

      body.goal-enabled #view-investments #pf-root > section.performance-refined {
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
        padding: 28px 0 32px;
        margin-bottom: 40px;
      }

      body.goal-enabled #view-investments #pf-root > section.performance-refined::before {
        display: none;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-chart {
        background: linear-gradient(180deg, #070b1166, #070b1122);
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-chart svg {
        background: transparent;
      }

      body.goal-enabled #view-investments #pf-root .performance-refined #pf-readout {
        border-top-color: #a4b5c514;
        border-bottom-color: #a4b5c514;
      }

      @media (max-width: 620px) {
        body.goal-enabled main > .observatory {
          padding: 12px 0 28px;
        }

        body.goal-enabled #instrument.precision-compass .core-space {
          height: 270px;
        }

        body.goal-enabled main > .observatory .hero-copy {
          padding-top: 20px;
        }

        body.goal-enabled main > .observatory .hero-valuation > strong {
          font-size: clamp(32px, 9vw, 44px);
        }

        body.goal-enabled .observatory .hero-facts {
          gap: 18px;
        }

        body.goal-enabled .observatory #hero-date {
          font-size: 9px;
        }

        body.goal-enabled #view-investments #pf-root > section.performance-refined {
          padding: 20px 0;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .precision-compass .compass-open span {
          transition: none;
        }
      }
    `;

    document.head.append(compassStyle);

    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'compass-open';
    open.setAttribute('aria-label', 'Open portfolio in focus');
    open.setAttribute('aria-haspopup', 'dialog');
    open.setAttribute('aria-controls', 'core-dialog');
    open.innerHTML = '<span>View portfolio ↗</span>';
    space.append(open);

    let openedFromCompass = false;

    open.addEventListener('click', () => {
      if (!$('core-dialog')?.open) {
        openedFromCompass = true;
        $('explore-core')?.click();
      }
    });

    $('core-dialog')?.addEventListener('close', () => {
      if (openedFromCompass) {
        openedFromCompass = false;
        open.focus({ preventScroll: true });
      }
    });

    document.body.prepend(background);

    const emblem = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'svg'
    );

    emblem.setAttribute('viewBox', '0 0 100 100');
    emblem.setAttribute('aria-hidden', 'true');
    emblem.classList.add('northstar-anchor');

    emblem.innerHTML =
      '<path d="M50 7L57 43L85 50L57 57L50 93L43 57L15 50L43 43Z" fill="#c8e0e5"/>' +
      '<path d="M50 45L55 50L50 55L45 50Z" fill="#10202b"/>';

    space.append(emblem);

    const orb = document.createElement('canvas');
    orb.className = 'orbital-canvas';
    orb.setAttribute('aria-hidden', 'true');

    space.append(orb);
    background.setAttribute('aria-hidden', 'true');

    const bg = background.getContext('2d');
    const c = orb.getContext('2d');

    if (!bg) background.hidden = true;
    if (!c) orb.hidden = true;
    if (!bg && !c) return;

    const TAU = Math.PI * 2;

    const starPath = new Path2D(
      'M0 -36L6 -6L29 0L6 6L0 36L-6 6L-29 0L-6 -6Z'
    );

    const orbits = [
      {
        r: .46,
        tilt: 1.31,
        angle: -.22,
        period: 52,
        phase: .4,
        color: '215,180,120'
      },
      {
        r: .41,
        tilt: 1.34,
        angle: .18,
        period: 76,
        phase: 2.7,
        color: '184,103,66'
      },
      {
        r: .36,
        tilt: 1.32,
        angle: -.35,
        period: 98,
        phase: 4.5,
        color: '159,184,201'
      }
    ];

    let width = 0;
    let height = 0;
    let size = 0;
    let fieldHeight = 0;
    let dpr = 0;

    let time = 0;
    let last = 0;
    let frame = 0;
    let lastSky = -Infinity;
    let lastOrb = -Infinity;

    let visible = true;
    let dirty = true;
    let stars = [];

    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;

    const wrap = (n, max) => ((n % max) + max) % max;

    let sparkSeed = 9821;

    const sparkRandom = () =>
      ((sparkSeed = sparkSeed * 16807 % 2147483647) - 1) /
      2147483646;

    const sparks = Array.from({ length: 120 }, (_, i) => ({
      orbit: {
        ...orbits[i % 3],
        r: .23 + sparkRandom() * .25,
        angle:
          orbits[i % 3].angle +
          (sparkRandom() - .5) * .12
      },
      phase: sparkRandom() * TAU,
      alpha: .14 + sparkRandom() * .38,
      radius: .35 + sparkRandom() * .5,
      warm: i % 4 !== 0
    }));

    function resize() {
      const nextDpr = Math.min(devicePixelRatio || 1, 1.75);
      const bounds = space.getBoundingClientRect();
      const nextSize = Math.max(1, bounds.width);
      const nextHeight = Math.max(1, bounds.height);

      if (
        width !== innerWidth ||
        height !== innerHeight ||
        dpr !== nextDpr
      ) {
        width = innerWidth;
        height = innerHeight;

        background.width = Math.round(width * nextDpr);
        background.height = Math.round(height * nextDpr);

        let seed = 7341;

        const random = () =>
          ((seed = seed * 16807 % 2147483647) - 1) /
          2147483646;

        stars = Array.from({
          length: Math.max(
            100,
            Math.min(340, Math.round(width * height / 4200))
          )
        }, () => {
          const layer = random() < .65
            ? 0
            : random() < .8 ? 1 : 2;

          return {
            x: random() * width,
            y: random() * height,
            layer,
            radius: .3 + random() * .4 + layer * .12,
            alpha: .18 + random() * .25 + layer * .07,
            phase: random() * TAU
          };
        });
      }

      if (
        size !== nextSize ||
        fieldHeight !== nextHeight ||
        dpr !== nextDpr
      ) {
        size = nextSize;
        fieldHeight = nextHeight;
        orb.width = Math.round(size * nextDpr);
        orb.height = Math.round(fieldHeight * nextDpr);
      }

      dpr = nextDpr;
      dirty = true;
      wake();
    }

    function paintSky() {
      if (!bg) return;

      bg.setTransform(dpr, 0, 0, dpr, 0, 0);
      bg.clearRect(0, 0, width, height);
      bg.fillStyle = '#c4d4e2';

      stars.forEach(star => {
        const speed = [.6, 2, 4][star.layer];

        const x = wrap(
          star.x + time * speed,
          width
        );

        const y = wrap(
          star.y - time * speed * .16,
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

        bg.globalAlpha =
          star.alpha *
          edge *
          (.9 + .1 * Math.sin(time * .5 + star.phase));

        bg.beginPath();
        bg.arc(x, y, star.radius, 0, TAU);
        bg.fill();
      });

      bg.globalAlpha = 1;
    }

    function project(o, a) {
      const tilt = o.tilt + pitch * .35;

      const turn =
        o.angle +
        yaw * .35 +
        Math.sin(time * .09) * .025;

      const vertical = Math.hypot(
        Math.sin(turn),
        Math.cos(turn) * Math.cos(tilt)
      );

      const r = Math.min(
        Math.min(size, 850) * o.r,
        fieldHeight * .40 / Math.max(.1, vertical)
      );

      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * Math.cos(tilt);
      const z = Math.sin(a) * r * Math.sin(tilt);

      const perspective = 1 + z / (size * 5);

      return {
        x: (
          x * Math.cos(turn) -
          y * Math.sin(turn)
        ) * perspective,
        y: (
          x * Math.sin(turn) +
          y * Math.cos(turn)
        ) * perspective,
        z
      };
    }

    function paintOrb() {
      if (!c) return;

      c.setTransform(
        dpr, 0, 0, dpr,
        orb.width / 2, orb.height / 2
      );

      c.clearRect(
        -size / 2 - 1,
        -fieldHeight / 2 - 1,
        size + 2,
        fieldHeight + 2
      );

      const scale = Math.min(
        380,
        size * .95,
        fieldHeight * 1.12
      ) / 400;

      const segments = [];
      const lights = [];

      orbits.forEach(o => {
        for (let i = 0; i < 120; i++) {
          const a = project(o, i / 120 * TAU);
          const b = project(o, (i + 1) / 120 * TAU);

          segments.push({
            a,
            b,
            z: (a.z + b.z) / 2,
            color: o.color
          });
        }

        const head = time / o.period * TAU + o.phase;

        for (let i = 18; i >= 0; i--) {
          lights.push({
            ...project(o, head - i * .011),
            alpha: (1 - i / 19) ** 2,
            head: i === 0,
            color: o.color
          });
        }
      });

      function layer(front) {
        segments.forEach(s => {
          if ((s.z >= 0) !== front) return;

          c.strokeStyle =
            `rgba(${s.color},${front ? .28 : .10})`;

          c.lineWidth =
            (front ? .8 : .6) * Math.max(.8, scale);

          c.beginPath();
          c.moveTo(s.a.x, s.a.y);
          c.lineTo(s.b.x, s.b.y);
          c.stroke();
        });

        lights.forEach(p => {
          if ((p.z >= 0) !== front) return;

          c.fillStyle =
            `rgba(${p.color},${p.alpha * (front ? .95 : .3)})`;

          c.shadowColor = `rgba(${p.color},.65)`;
          c.shadowBlur = p.head ? 9 * scale : 0;

          c.beginPath();
          c.arc(
            p.x,
            p.y,
            (p.head ? 2 : .8) * Math.max(.7, scale),
            0,
            TAU
          );
          c.fill();
        });

        c.shadowBlur = 0;
      }

      /*
        The elliptical glow reaches full transparency
        before touching any canvas boundary.
      */
      const glowRadius = Math.min(size * .44, 350);
      const glowHeight = Math.min(
        glowRadius,
        fieldHeight * .44
      );

      c.save();
      c.scale(1, glowHeight / glowRadius);

      const glow = c.createRadialGradient(
        0, 0, 0,
        0, 0, glowRadius
      );

      glow.addColorStop(0, 'rgba(197,142,72,.11)');
      glow.addColorStop(.25, 'rgba(155,83,46,.055)');
      glow.addColorStop(.55, 'rgba(92,78,64,.022)');
      glow.addColorStop(.78, 'rgba(66,105,130,.006)');
      glow.addColorStop(1, 'rgba(66,105,130,0)');

      c.fillStyle = glow;

      c.fillRect(
        -glowRadius,
        -glowRadius,
        glowRadius * 2,
        glowRadius * 2
      );

      c.restore();

      sparks.forEach(star => {
        const p = project(
          star.orbit,
          star.phase + time * .018
        );

        const distance = Math.hypot(p.x, p.y);

        const fade = Math.max(
          0,
          Math.min(
            1,
            (distance - 100 * scale) / (55 * scale)
          )
        );

        const light =
          star.alpha *
          fade *
          (.9 + .1 * Math.sin(time * .3 + star.phase));

        c.fillStyle = star.warm
          ? `rgba(224,183,132,${light})`
          : `rgba(181,205,222,${light})`;

        c.beginPath();
        c.arc(p.x, p.y, star.radius, 0, TAU);
        c.fill();
      });

      layer(false);

      function circle(radius, colour, lineWidth = .7) {
        c.strokeStyle = colour;
        c.lineWidth = lineWidth * Math.max(.8, scale);
        c.beginPath();
        c.arc(0, 0, radius * scale, 0, TAU);
        c.stroke();
      }

      circle(136, 'rgba(205,183,140,.25)');
      circle(128, 'rgba(190,150,104,.16)');
      circle(109, 'rgba(190,150,104,.08)');

      for (let i = 0; i < 120; i++) {
        const angle = i / 120 * TAU - Math.PI / 2;
        const major = i % 10 === 0;
        const medium = i % 5 === 0;
        const inner = major ? 119 : medium ? 123 : 126;

        c.strokeStyle = major
          ? 'rgba(220,204,172,.65)'
          : medium
            ? 'rgba(190,161,120,.40)'
            : 'rgba(177,151,116,.18)';

        c.lineWidth = major ? 1 : .65;
        c.beginPath();

        c.moveTo(
          Math.cos(angle) * inner * scale,
          Math.sin(angle) * inner * scale
        );

        c.lineTo(
          Math.cos(angle) * 132 * scale,
          Math.sin(angle) * 132 * scale
        );

        c.stroke();
      }

      c.save();
      c.scale(scale, scale);

      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4 - Math.PI / 2;
        const cardinal = i % 2 === 0;
        const length = i === 0 ? 77 : cardinal ? 65 : 44;
        const halfWidth = cardinal ? 10 : 6;

        const tip = {
          x: Math.cos(angle) * length,
          y: Math.sin(angle) * length
        };

        const left = {
          x: Math.cos(angle + Math.PI / 2) * halfWidth,
          y: Math.sin(angle + Math.PI / 2) * halfWidth
        };

        c.fillStyle = i === 0
          ? '#decca3'
          : cardinal ? '#c9b18a' : '#9a7655';

        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(left.x, left.y);
        c.lineTo(tip.x, tip.y);
        c.closePath();
        c.fill();

        c.fillStyle = i === 0
          ? '#8c7856'
          : cardinal ? '#796044' : '#513c30';

        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(tip.x, tip.y);
        c.lineTo(-left.x, -left.y);
        c.closePath();
        c.fill();
      }

      c.save();
      c.scale(.62, .62);

      const metal = c.createLinearGradient(
        -20, -35, 20, 35
      );

      metal.addColorStop(0, '#f0f4ee');
      metal.addColorStop(.48, '#cbe3e7');
      metal.addColorStop(.5, '#809fae');
      metal.addColorStop(1, '#d4e9ed');

      c.fillStyle = metal;
      c.shadowColor = 'rgba(165,224,239,.25)';
      c.shadowBlur = 10;
      c.fill(starPath);

      c.shadowBlur = 0;
      c.fillStyle = '#10202b';
      c.beginPath();
      c.moveTo(0, -5);
      c.lineTo(5, 0);
      c.lineTo(0, 5);
      c.lineTo(-5, 0);
      c.closePath();
      c.fill();

      c.fillStyle = '#e6f8ff';
      c.beginPath();
      c.arc(0, 0, 1.6, 0, TAU);
      c.fill();

      c.restore();
      c.restore();

      layer(true);

      if (!instrument.classList.contains('orbital-ready')) {
        instrument.classList.add('orbital-ready');
      }
    }

    function tick(now) {
      frame = 0;

      if (document.hidden) {
        last = 0;
        return;
      }

      const dt = last
        ? Math.min((now - last) / 1000, .05)
        : 0;

      last = now;

      const stopped = paused();

      if (!stopped) {
        time += dt;

        const ease = 1 - Math.exp(-dt * 7);
        yaw += (targetYaw - yaw) * ease;
        pitch += (targetPitch - pitch) * ease;
      }

      if (dirty || now - lastSky >= 1000 / 30) {
        paintSky();
        lastSky = now;
      }

      if (
        (visible || dirty) &&
        (dirty || now - lastOrb >= 1000 / 30)
      ) {
        paintOrb();
        lastOrb = now;
      }

      dirty = false;

      if (!stopped) {
        frame = requestAnimationFrame(tick);
      }
    }

    function wake() {
      if (!frame && !document.hidden) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    new ResizeObserver(resize).observe(space);

    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      dirty = true;
      wake();
    }).observe(instrument);

    addEventListener('resize', resize, { passive: true });

    instrument.addEventListener('pointermove', event => {
      if (paused()) return;

      const box = space.getBoundingClientRect();

      targetYaw = Math.max(
        -.5,
        Math.min(
          .5,
          (event.clientX - box.left) / box.width - .5
        )
      ) * .44;

      targetPitch = Math.max(
        -.5,
        Math.min(
          .5,
          (event.clientY - box.top) / box.height - .5
        )
      ) * .32;
    }, { passive: true });

    [
      'pointerleave',
      'pointerup',
      'pointercancel'
    ].forEach(type => {
      instrument.addEventListener(type, () => {
        targetYaw = targetPitch = 0;
      }, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      cancelAnimationFrame(frame);

      frame = 0;
      last = 0;
      dirty = true;

      wake();
    });

    const refreshMotion = () => {
      dirty = true;
      wake();
    };

    new MutationObserver(refreshMotion).observe(
      document.body,
      {
        attributes: true,
        attributeFilter: ['class']
      }
    );

    reduced.addEventListener('change', refreshMotion);

    resize();
  }

  setupPortfolio();
  setupNavigation();

  try {
    setupSky();
  } catch (error) {
    console.warn(
      'NORTHSTAR: decorative sky unavailable.',
      error
    );
  }
})();
