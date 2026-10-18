/* NORTHSTAR / celestial depth.
   Presentation only; no portfolio storage access. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const hero = document.querySelector('.observatory');
  const space = document.querySelector('.core-space');
  const canvas = $('celestial-core');
  const dialog = $('core-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;

  hero.prepend(canvas);

  const ctx = canvas.getContext('2d');

  let summary;
  let selected = 'VWCE';
  let visible = true;
  let frame = 0;
  let last = 0;
  let time = 0;
  let lastPaint = -Infinity;
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let drag = null;
  let bounds;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let anchorX = 0;
  let anchorY = 0;
  let scale = 1;

  const paused = () =>
    reduced.matches ||
    document.body.classList.contains('motion-paused');

  const active = () =>
    !!ctx && visible && !document.hidden;

  let seed = 7341;

  const random = () => {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const stars = Array.from({length:54}, (_, i) => ({
    x: random(),
    y: random(),
    depth: i % 3,
    radius: .35 + random() * .65,
    light: .18 + random() * .46,
    phase: random() * TAU
  }));

  /* Cached irregular dust with transparent edges. */
  const dust = document.createElement('canvas');
  dust.width = 900;
  dust.height = 600;

  const dustContext = dust.getContext('2d');

  if (dustContext) {
    for (let i = 0; i < 16; i++) {
      const x = 190 + random() * 500;
      const y = 130 + random() * 300;
      const r = 65 + random() * 130;

      const glow = dustContext.createRadialGradient(
        x, y, 0, x, y, r
      );

      glow.addColorStop(
        0,
        i % 3
          ? 'rgba(113,137,151,.027)'
          : 'rgba(151,139,117,.019)'
      );

      glow.addColorStop(1, 'rgba(90,110,130,0)');

      dustContext.fillStyle = glow;
      dustContext.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  const arcs = [
    {
      r:188, rx:.82, ry:-.24,
      start:-2.7, length:2.85,
      speed:.12, color:'#9ab5c3'
    },
    {
      r:228, rx:-.44, ry:.68,
      start:.18, length:2.12,
      speed:-.085, color:'#b1b5ad'
    },
    {
      r:156, rx:1.12, ry:.40,
      start:2.1, length:1.65,
      speed:.067, color:'#85a7ba'
    }
  ];

  /* A finished, simple emblem when Canvas is unavailable. */
  const fallback = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  );

  fallback.setAttribute('viewBox', '0 0 200 200');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.classList.add('celestial-fallback');

  fallback.innerHTML = `
    <defs>
      <linearGradient id="quiet-metal" x2="1" y2="1">
        <stop stop-color="#f3eee1"/>
        <stop offset=".48" stop-color="#cbdfe5"/>
        <stop offset=".5" stop-color="#628895"/>
        <stop offset="1" stop-color="#d7e2e0"/>
      </linearGradient>
    </defs>
    <path
      d="M100 22L117 83L173 100L117 117L100 178L83 117L27 100L83 83Z"
      fill="url(#quiet-metal)"
      stroke="#e1edef"
      stroke-width=".7"
    />
    <path
      d="M100 84L116 100L100 116L84 100Z"
      fill="#0b1820"
    />
    <circle cx="100" cy="100" r="2" fill="#d9f4f5"/>
  `;

  space.append(fallback);

  if (!ctx) {
    canvas.hidden = true;
    document.body.classList.add('canvas-fallback');
  }

  function resize() {
    bounds = hero.getBoundingClientRect();
    const core = space.getBoundingClientRect();

    width = bounds.width;
    height = bounds.height;
    dpr = Math.min(devicePixelRatio || 1, 1.5);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    anchorX = core.left - bounds.left + core.width / 2;
    anchorY = core.top - bounds.top + core.height / 2;
    scale = Math.min(core.width, core.height) / 500;

    lastPaint = -Infinity;
    wake();
  }

  new ResizeObserver(resize).observe(hero);
  new ResizeObserver(resize).observe(space);

  function project(angle, arc, radius = arc.r) {
    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;
    let z = 0;

    const rx = arc.rx + pitch * .18;
    const ry = arc.ry + yaw * .22;

    [y,z] = [
      y * Math.cos(rx),
      y * Math.sin(rx)
    ];

    [x,z] = [
      x * Math.cos(ry) + z * Math.sin(ry),
      -x * Math.sin(ry) + z * Math.cos(ry)
    ];

    const p = 900 / (900 - z);

    return {x:x * p, y:y * p, z};
  }

  function paint() {
    if (!ctx || !width) return;

    const c = ctx;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);

    if (dustContext) {
      c.globalAlpha = .8;

      c.drawImage(
        dust,
        anchorX - width * .59 + Math.sin(time * .023) * 9,
        anchorY - height * .6 + Math.cos(time * .018) * 7,
        width * .98,
        height * 1.18
      );
    }

    stars.forEach(star => {
      const depth = (star.depth + 1) / 3;

      const x =
        star.x * width +
        Math.sin(time * .015 + star.phase) * depth * 8 +
        yaw * depth * 12;

      const y =
        star.y * height +
        Math.cos(time * .012 + star.phase) * depth * 5 +
        pitch * depth * 9;

      const calm = Math.max(
        .05,
        Math.min(1, (x / width - .36) / .3)
      );

      const edge = Math.max(
        0,
        Math.min(
          1,
          x / 35,
          (width - x) / 35,
          y / 35,
          (height - y) / 35
        )
      );

      c.globalAlpha = star.light * calm * edge;
      c.fillStyle = star.depth === 2 ? '#d5e4e8' : '#94a8b9';
      c.beginPath();
      c.arc(x, y, star.radius, 0, TAU);
      c.fill();
    });

    c.save();
    c.translate(anchorX, anchorY);
    c.scale(scale, scale);

    const primitives = [];

    arcs.forEach((arc, index) => {
      /* Axes stay composed; the light follows its path. */
      const drift = Math.sin(time * .018 + index) * .055;

      for (let i = 0; i < 58; i++) {
        const t = i / 58;
        const angle = arc.start + t * arc.length + drift;
        const p = project(angle, arc);
        const q = project(angle + arc.length / 58, arc);
        const fade = Math.pow(Math.sin(t * Math.PI), 1.7);

        const passage = Math.max(
          0,
          Math.cos(time * TAU / 32 - index * .55)
        );

        const alpha =
          fade *
          (p.z < 0 ? .08 : .21) *
          (1 + Math.pow(passage, 24) * .45);

        primitives.push({
          z: (p.z + q.z) / 2,
          paint() {
            c.globalAlpha = alpha;
            c.strokeStyle = arc.color;
            c.lineWidth = .65;
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x, q.y);
            c.stroke();
          }
        });
      }

      if (index < 2) {
        const phase =
          ((time * arc.speed * .075 + index * .43) % 1 + 1) % 1;

        const p = project(
          arc.start + phase * arc.length + drift,
          arc
        );

        const fade = Math.sin(phase * Math.PI);

        primitives.push({
          z: p.z,
          paint() {
            const glow = c.createRadialGradient(
              p.x, p.y, 0, p.x, p.y, 7
            );

            glow.addColorStop(0, '#dcecef99');
            glow.addColorStop(.2, '#b6d6df55');
            glow.addColorStop(1, '#9bc6d300');

            c.globalAlpha = fade * (p.z < 0 ? .35 : .8);
            c.fillStyle = glow;
            c.fillRect(p.x - 7, p.y - 7, 14, 14);

            c.fillStyle = '#d9e8e9';
            c.beginPath();
            c.arc(p.x, p.y, 1.25, 0, TAU);
            c.fill();
          }
        });
      }
    });

    /* The emblem stays visually stable while the space around it drifts. */
    primitives.push({
      z: 0,
      paint() {
        c.save();
        c.translate(yaw * 3, pitch * 3);
        c.globalAlpha = 1;

        const light = c.createRadialGradient(0, 0, 5, 0, 0, 100);
        light.addColorStop(0, '#b8e1e117');
        light.addColorStop(.48, '#8ebac10b');
        light.addColorStop(1, '#8ebac100');

        c.fillStyle = light;
        c.fillRect(-105, -105, 210, 210);

        const metal = c.createLinearGradient(-50, -78, 55, 78);
        metal.addColorStop(0, '#f0e9d7');
        metal.addColorStop(.46, '#c8e0e5');
        metal.addColorStop(.49, '#eff6f3');
        metal.addColorStop(.51, '#628791');
        metal.addColorStop(1, '#c1d8d9');

        c.beginPath();

        [
          [0,-78], [17,-17], [73,0], [17,17],
          [0,78], [-17,17], [-73,0], [-17,-17]
        ].forEach((p, i) => {
          if (i) c.lineTo(...p);
          else c.moveTo(...p);
        });

        c.closePath();
        c.fillStyle = metal;
        c.fill();
        c.strokeStyle = '#dbe8e5';
        c.lineWidth = .65;
        c.stroke();

        c.globalAlpha = .24;
        c.strokeStyle = '#f1f5eb';
        c.lineWidth = .6;
        c.beginPath();
        c.moveTo(0, -78);
        c.lineTo(0, 78);
        c.moveTo(-73, 0);
        c.lineTo(73, 0);
        c.stroke();

        c.globalAlpha = 1;
        c.fillStyle = '#0b1820';
        c.beginPath();
        c.moveTo(0, -16);
        c.lineTo(16, 0);
        c.lineTo(0, 16);
        c.lineTo(-16, 0);
        c.closePath();
        c.fill();

        c.fillStyle = '#d8eff0';
        c.beginPath();
        c.arc(0, 0, 2.2, 0, TAU);
        c.fill();

        c.restore();
      }
    });

    primitives
      .sort((a, b) => a.z - b.z)
      .forEach(p => p.paint());

    c.restore();
    c.globalAlpha = 1;
  }

  function tick(now) {
    frame = 0;

    if (!active()) {
      last = 0;
      return;
    }

    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;

    if (!paused()) time += dt;

    const easing = 1 - Math.exp(-Math.max(dt, 1 / 120) * 8);

    yaw += (targetYaw - yaw) * easing;
    pitch += (targetPitch - pitch) * easing;

    if (now - lastPaint >= 1000 / 30 || paused()) {
      paint();
      lastPaint = now;
    }

    if (
      !paused() ||
      Math.abs(yaw - targetYaw) +
      Math.abs(pitch - targetPitch) > .001
    ) {
      frame = requestAnimationFrame(tick);
    }
  }

  function wake() {
    if (!frame && active()) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    wake();
  }).observe(hero);

  document.addEventListener('visibilitychange', wake);

  new MutationObserver(wake).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  function syncMotionPreference() {
    const button = $('motion-toggle');

    button.disabled = reduced.matches;
    button.title = reduced.matches
      ? 'Motion is off because your device requests reduced motion.'
      : '';

    if (reduced.matches) {
      document.body.classList.add('motion-paused');
      button.setAttribute('aria-pressed', 'true');
      button.setAttribute(
        'aria-label',
        'Motion off: system reduced-motion preference'
      );
      button.querySelector('span').textContent = 'OFF';
    }

    wake();
  }

  reduced.addEventListener('change', syncMotionPreference);
  syncMotionPreference();

  hero.addEventListener('pointermove', event => {
    if (paused() || event.pointerType !== 'mouse' || !bounds) return;

    targetYaw =
      (event.clientX - bounds.left - bounds.width * .7) /
      bounds.width * .5;

    targetPitch =
      (event.clientY - bounds.top - bounds.height * .5) /
      bounds.height * .3;

    wake();
  }, {passive:true});

  function settle() {
    drag = null;
    targetYaw = targetPitch = 0;
    wake();
  }

  hero.addEventListener('pointerleave', settle);

  space.addEventListener('pointerdown', event => {
    if (event.isPrimary && event.pointerType === 'touch') {
      drag = {x:event.clientX, y:event.clientY};
    }
  }, {passive:true});

  space.addEventListener('pointermove', event => {
    if (!drag || paused()) return;

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;

    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 2) {
      targetYaw = Math.max(
        -.3,
        Math.min(.3, dx / space.clientWidth)
      );
      wake();
    }
  }, {passive:true});

  ['pointerup','pointercancel'].forEach(name => {
    space.addEventListener(name, settle);
  });

  /* A useful financial detail view replaces the enlarged illustration. */
  $('explore-core').textContent = 'Portfolio in focus ↗';
  $('map-title').textContent = 'Your portfolio, in focus.';

  document.querySelector('.map-heading .eyebrow').textContent =
    'NORTHSTAR / PORTFOLIO';

  $('map-help').textContent =
    'Actual holdings and allocation. Price status is shown below. ' +
    'SXR8 is a benchmark only and is excluded from your allocation.';

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
      aria-label="No asset allocation"
    >
      <span></span><span></span>
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
      No purchases saved in this browser.
    </p>
  `;

  $('celestial-map').replaceWith(focus);
  $('reset-core').remove();

  document.querySelector('.map-bottom>span').textContent =
    'Market data status shown above · private browser storage';

  function updateFocus() {
    if (!summary) return;

    const euro = value => new Intl.NumberFormat('en-IE', {
      style:'currency',
      currency:'EUR'
    }).format(value);

    $('focus-total').textContent =
      summary.value === null ? '—' : euro(summary.value);

    $('focus-date').textContent = $('hero-date').textContent;

    const allocation = summary.count ? summary.allocation : 0;
    const bar = document.querySelector('.focus-allocation');

    bar.children[0].style.width = `${allocation}%`;
    bar.children[1].style.width = summary.count
      ? `${100 - allocation}%`
      : '0%';

    bar.setAttribute(
      'aria-label',
      summary.count
        ? `${summary.allocationBasis} allocation: ` +
          `VWCE ${allocation.toFixed(1)}%, ` +
          `VFEA ${(100 - allocation).toFixed(1)}%.`
        : 'No asset allocation'
    );

    $('focus-world').textContent = summary.count
      ? `${allocation.toFixed(1)}%`
      : '—';

    $('focus-emerging').textContent = summary.count
      ? `${(100 - allocation).toFixed(1)}%`
      : '—';

    $('focus-basis').textContent = summary.count
      ? `${summary.allocationBasis} allocation · benchmark excluded`
      : 'No purchases saved in this browser.';
  }

  function details() {
    const holding = selected !== 'SXR8';
    const index = selected === 'VWCE' ? 0 : 1;
    const rows = [...document.querySelectorAll('#pf-holdings tr')];

    const row = rows.find(r =>
      r.cells[0]?.textContent.includes(selected)
    );

    const quote = [...document.querySelectorAll('.pf-quote')]
      .find(q => q.textContent.includes(selected));

    const box = $('asset-detail');
    box.replaceChildren();

    if (!paused()) {
      box.animate(
        [
          {opacity:.65, transform:'translateX(5px)'},
          {opacity:1, transform:'none'}
        ],
        {duration:180, easing:'ease-out'}
      );
    }

    const title = document.createElement('h3');
    title.textContent = selected;
    box.append(title);

    const description = document.createElement('p');

    description.textContent = holding
      ? index
        ? 'Emerging markets · holding'
        : 'Global equities · holding'
      : 'S&P 500 reference · benchmark only. ' +
        'Excluded from your holdings and allocation.';

    box.append(description);

    if (holding && summary?.count && row && row.cells.length >= 6) {
      const list = document.createElement('dl');
      list.className = 'asset-metrics';

      [
        'Asset',
        'Invested',
        'Shares',
        summary?.status === 'warning' ? 'Price snapshot' : 'Latest close',
        'Market value',
        'Unrealized P/L'
      ].forEach((label, i) => {
        if (i === 0) return;

        const term = document.createElement('dt');
        const value = document.createElement('dd');

        term.textContent = label;
        value.textContent = row.cells[i].textContent.trim();

        list.append(term, value);
      });

      box.append(list);
    } else {
      const value = document.createElement('p');
      value.className = 'asset-value';

      value.textContent = holding
        ? 'No purchases saved for this asset.'
        : quote?.textContent.replace(/\s+/g, ' ').trim() ||
          'Closing price unavailable';

      box.append(value);
    }

    const allocation = document.createElement('p');

    allocation.textContent = holding && summary?.count
      ? `${summary.allocationBasis} allocation: ${
          (index ? 100 - summary.allocation : summary.allocation).toFixed(1)
        }%`
      : 'Allocation excludes the benchmark.';

    box.append(allocation);

    box.style.setProperty(
      '--asset-color',
      holding ? index ? '#e9be74' : '#83deee' : '#bca3ef'
    );
  }

  document.addEventListener('northstar:summary', event => {
    summary = event.detail;

    $('core-contributed').textContent = summary.count
      ? new Intl.NumberFormat('en-IE', {
          style:'currency',
          currency:'EUR'
        }).format(summary.invested)
      : 'No purchases';

    $('core-allocation').textContent = summary.count
      ? `${summary.allocation.toFixed(1)}% / ${
          (100 - summary.allocation).toFixed(1)
        }%`
      : '— / —';

    $('core-allocation').parentElement.querySelector('span').textContent =
      summary.allocationBasis.toUpperCase() + ' / WORLD : EMERGING';

    if (dialog.open) {
      updateFocus();
      details();
    }
  });

  $('explore-core').addEventListener('click', () => {
    updateFocus();
    details();
    dialog.showModal();
  });

  function closeFocus() {
    dialog.close();
    $('explore-core').focus({preventScroll:true});
  }

  $('close-core').addEventListener('click', closeFocus);

  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeFocus();
  });

  dialog.addEventListener('close', () => {
    if (
      document.activeElement === document.body ||
      dialog.contains(document.activeElement)
    ) {
      $('explore-core').focus({preventScroll:true});
    }
  });

  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;

    const controls = [
      ...dialog.querySelectorAll('button:not(:disabled)')
    ];

    const first = controls[0];
    const last = controls.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.querySelectorAll('[data-asset]').forEach(button => {
    button.addEventListener('click', () => {
      selected = button.dataset.asset;

      document.querySelectorAll('[data-asset]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });

      details();
    });
  });

  /* Ordinary section URLs and browser history are retained. */
  document.addEventListener('northstar:ready', () => {
    const nav = document.querySelector('.nav');
    const links = [...nav.querySelectorAll('a')];

    const targets = links.map(link =>
      document.querySelector(link.hash)
    );

    const sections = targets.map((target, i) =>
      i ? target.closest('section') : hero
    );

    let current = -1;
    let navigationFrame = 0;
    let feedbackTimer;
    let destination = null;
    let destinationTimer;

    sections.forEach((section, i) => {
      if (!i) return;

      section.dataset.destination = [
        '',
        'PERFORMANCE',
        'HOLDINGS',
        'LEDGER'
      ][i];

      const label = document.createElement('div');
      label.className = 'section-coordinate';
      label.textContent = `0${i + 1} / ${section.dataset.destination}`;
      section.prepend(label);
    });

    function activate(index, feedback = false) {
      links.forEach((link, i) => {
        link.classList.toggle('active', i === index);

        if (i === index) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });

      const navBounds = nav.getBoundingClientRect();
      const position = links[index].getBoundingClientRect();

      nav.style.setProperty(
        '--beacon-x',
        `${position.left - navBounds.left}px`
      );

      nav.style.setProperty(
        '--beacon-width',
        `${position.width}px`
      );

      if (index !== current) {
        sections.forEach((section, i) => {
          section.classList.toggle('section-current', i === index);
        });

        current = index;
      }

      if (feedback) {
        const core = $('instrument');
        core.classList.remove('nav-response');

        requestAnimationFrame(() => {
          core.classList.add('nav-response');
        });

        clearTimeout(feedbackTimer);

        feedbackTimer = setTimeout(() => {
          core.classList.remove('nav-response');
        }, 600);
      }
    }

    function track() {
      navigationFrame = 0;

      const boundary =
        document.querySelector('.masthead').getBoundingClientRect().bottom +
        110;

      if (destination !== null) {
        activate(destination);
        return;
      }

      let index = 0;

      sections.forEach((section, i) => {
        if (section.getBoundingClientRect().top <= boundary) {
          index = i;
        }
      });

      activate(index);
    }

    function schedule() {
      if (!navigationFrame) {
        navigationFrame = requestAnimationFrame(track);
      }
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

        destination = i;
        activate(i, true);

        const distance = i
          ? sections[i].getBoundingClientRect().top
          : -scrollY;

        const behavior =
          paused() || Math.abs(distance) > innerHeight * .8
            ? 'instant'
            : 'smooth';

        if (i === 0) {
          scrollTo({top:0, behavior});
        } else {
          sections[i].scrollIntoView({behavior, block:'start'});
        }

        clearTimeout(destinationTimer);

        destinationTimer = setTimeout(() => {
          destination = null;
          schedule();
        }, 1400);
      });
    });

    addEventListener('scrollend', () => {
      destination = null;
      schedule();
    });

    addEventListener('scroll', schedule, {passive:true});
    addEventListener('resize', schedule, {passive:true});

    const followHash = () => {
      destination = null;
      clearTimeout(destinationTimer);

      const index = links.findIndex(
        link => link.hash === location.hash
      );

      if (index >= 0) {
        if (index === 0) {
          scrollTo({top:0, behavior:'instant'});
        } else {
          sections[index].scrollIntoView({
            behavior:'instant',
            block:'start'
          });
        }

        activate(index);
      } else {
        schedule();
      }
    };

    addEventListener('popstate', followHash);
    addEventListener('hashchange', schedule);

    requestAnimationFrame(() => {
      if (location.hash) followHash();
      else track();
    });
  });

  resize();
})();
