/* NORTHSTAR: orbital light, real portfolio data, no storage writes. */
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
      trigger.focus({preventScroll: true});
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
        ) {
          return;
        }

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
          scrollTo({top: 0, behavior});
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
          ) {
            return;
          }

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

      addEventListener('scroll', schedule, {passive: true});
      addEventListener('resize', schedule, {passive: true});
      addEventListener('popstate', followHash);
      addEventListener('hashchange', followHash);

      requestAnimationFrame(followHash);
    }, {once: true});
  }

  function setupSky() {
    const background = $('celestial-core');
    const space = document.querySelector('.core-space');
    const instrument = $('instrument');

    if (!background || !space || !instrument) return;

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
        r: .38,
        tilt: 1.12,
        angle: -.42,
        period: 14,
        phase: .4,
        color: '153,220,228'
      },
      {
        r: .41,
        tilt: .95,
        angle: .98,
        period: 21,
        phase: 2.7,
        color: '205,183,140'
      },
      {
        r: .35,
        tilt: 1.20,
        angle: 2.05,
        period: 29,
        phase: 4.5,
        color: '171,184,220'
      }
    ];

    let width = 0;
    let height = 0;
    let size = 0;
    let dpr = 0;

    let time = 0;
    let last = 0;
    let frame = 0;
    let lastSky = -Infinity;

    let visible = true;
    let dirty = true;
    let stars = [];

    let yaw = 0;
    let pitch = 0;
    let targetYaw = 0;
    let targetPitch = 0;

    const wrap = (n, max) => ((n % max) + max) % max;

    function resize() {
      const nextDpr = Math.min(devicePixelRatio || 1, 1.75);

      const nextSize = Math.max(
        1,
        space.getBoundingClientRect().width
      );

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

      if (size !== nextSize || dpr !== nextDpr) {
        size = nextSize;
        orb.width = orb.height = Math.round(size * nextDpr);
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
      const r = size * o.r;
      const tilt = o.tilt + pitch;

      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r * Math.cos(tilt);
      const z = Math.sin(a) * r * Math.sin(tilt);

      const turn =
        o.angle +
        yaw +
        Math.sin(time * .09) * .035;

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
        orb.width / 2,
        orb.height / 2
      );

      c.clearRect(
        -size / 2 - 1,
        -size / 2 - 1,
        size + 2,
        size + 2
      );

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

        for (let i = 22; i >= 0; i--) {
          lights.push({
            ...project(o, head - i * .012),
            alpha: (1 - i / 23) ** 2,
            head: i === 0,
            color: o.color
          });
        }
      });

      function layer(front) {
        segments.forEach(s => {
          if ((s.z >= 0) !== front) return;

          c.strokeStyle =
            `rgba(${s.color},${
              front ? .30 + .18 * s.z / size : .11
            })`;

          c.lineWidth = front ? .85 : .65;

          c.beginPath();
          c.moveTo(s.a.x, s.a.y);
          c.lineTo(s.b.x, s.b.y);
          c.stroke();
        });

        lights.forEach(p => {
          if ((p.z >= 0) !== front) return;

          c.fillStyle =
            `rgba(${p.color},${
              p.alpha * (front ? .95 : .3)
            })`;

          c.shadowColor = `rgba(${p.color},.65)`;
          c.shadowBlur = p.head ? 9 : 0;

          c.beginPath();

          c.arc(
            p.x,
            p.y,
            p.head ? 1.8 : .9,
            0,
            TAU
          );

          c.fill();
        });

        c.shadowBlur = 0;
      }

      layer(false);

      const r = size * .265;

      const surface = c.createRadialGradient(
        -r * .3,
        -r * .4,
        0,
        0,
        0,
        r
      );

      surface.addColorStop(
        0,
        'rgba(113,171,204,.025)'
      );

      surface.addColorStop(
        .8,
        'rgba(80,133,175,.035)'
      );

      surface.addColorStop(
        1,
        'rgba(151,203,224,.07)'
      );

      c.fillStyle = surface;
      c.strokeStyle = 'rgba(163,212,232,.13)';
      c.lineWidth = .7;

      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.fill();
      c.stroke();

      c.save();

      const scale = Math.min(1, size / 360);
      c.scale(scale, scale);

      const metal = c.createLinearGradient(
        -20, -35, 20, 35
      );

      metal.addColorStop(0, '#f0f4ee');
      metal.addColorStop(.48, '#cbe3e7');
      metal.addColorStop(.5, '#809fae');
      metal.addColorStop(1, '#d4e9ed');

      c.fillStyle = metal;
      c.shadowColor = 'rgba(165,224,239,.3)';
      c.shadowBlur = 12;

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
      c.arc(0, 0, 1.25, 0, TAU);
      c.fill();

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

      if (visible || dirty) paintOrb();

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

    addEventListener('resize', resize, {passive: true});

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
    }, {passive: true});

    [
      'pointerleave',
      'pointerup',
      'pointercancel'
    ].forEach(type => {
      instrument.addEventListener(type, () => {
        targetYaw = targetPitch = 0;
      }, {passive: true});
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
