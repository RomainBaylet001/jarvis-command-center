/* NORTHSTAR / a continuous field of starlight.
   No financial storage access. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const hero = document.querySelector('.observatory');
  const space = document.querySelector('.core-space');
  const canvas = $('celestial-core');
  const dialog = $('core-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;

  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');

  let summary;
  let selected = 'VWCE';
  let frame = 0;
  let last = 0;
  let time = 0;
  let lastPaint = -Infinity;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let scrollOffset = scrollY;
  let parallaxOffset = scrollY;
  let anchorX = 0;
  let anchorDocumentY = 0;
  let heroVisible = true;
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;

  const paused = () =>
    reduced.matches ||
    document.body.classList.contains('motion-paused');

  const active = () => !!ctx && !document.hidden;

  let seed = 7341;

  const random = () => {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const wrap = (value, size) =>
    ((value % size) + size) % size;

  const smooth = n => {
    n = Math.max(0, Math.min(1, n));
    return n * n * (3 - 2 * n);
  };

  /* A small, stable SVG anchor stays visible without Canvas. */
  const emblem = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg'
  );

  emblem.setAttribute('viewBox', '0 0 200 200');
  emblem.setAttribute('aria-hidden', 'true');
  emblem.classList.add('northstar-anchor');

  emblem.innerHTML = `
    <defs>
      <linearGradient
        id="northstar-metal"
        x1="0" y1="0" x2="1" y2="1"
      >
        <stop stop-color="#f4f4ed"/>
        <stop offset=".48" stop-color="#cbdfe4"/>
        <stop offset=".5" stop-color="#7d9ba4"/>
        <stop offset="1" stop-color="#d9e8e8"/>
      </linearGradient>
    </defs>
    <path
      d="M100 22L112 88L173 100L112 112L100 178L88 112L27 100L88 88Z"
      fill="url(#northstar-metal)"
      stroke="#e1edef"
      stroke-width=".55"
    />
    <path
      class="star-glint"
      d="M100 22L112 88L173 100L112 112L100 178L88 112L27 100L88 88Z"
      fill="#f4ffff"
    />
    <path
      d="M100 91L109 100L100 109L91 100Z"
      fill="#0b1820"
    />
    <circle cx="100" cy="100" r="1.8" fill="#e2f4f4"/>
  `;

  space.append(emblem);

  if (!ctx) {
    canvas.hidden = true;
    document.body.classList.add('canvas-fallback');
  }

  const current = Array.from({length:26}, (_, i) => ({
    u: (i + .5) / 26,
    offset: (random() - .5) * 18,
    depth: .65 + random() * .35
  }));

  function populate() {
    seed = 7341;
    stars = [];

    const total = Math.max(
      85,
      Math.min(260, Math.round(width * height / 6200))
    );

    const counts = [
      Math.round(total * .73),
      Math.round(total * .23)
    ];

    counts.push(total - counts[0] - counts[1]);

    counts.forEach((count, layer) => {
      for (let i = 0; i < count; i++) {
        let x;
        let y;

        do {
          x = random();
          y = random();
        } while (
          random() >
          .54 + .35 * Math.sin(x * 4.8 + y * 3.1 + .8) ** 2
        );

        stars.push({
          x: x * width,
          y: y * height,
          layer,
          radius:
            layer === 0 ? .2 + random() * .26 :
            layer === 1 ? .32 + random() * .3 :
            .48 + random() * .3,
          light:
            layer === 0 ? .12 + random() * .16 :
            layer === 1 ? .21 + random() * .2 :
            .36 + random() * .18,
          phase: random() * TAU,
          change: layer === 2 && i % 3 === 0
        });
      }
    });
  }

  function measureAnchor() {
    const box = space.getBoundingClientRect();

    anchorX = box.left + box.width / 2;
    anchorDocumentY = box.top + scrollOffset + box.height / 2;

    lastPaint = -Infinity;
    wake();
  }

  function resize() {
    const nextWidth = innerWidth;
    const nextHeight = innerHeight;
    const nextDpr = Math.min(devicePixelRatio || 1, 1.5);

    if (
      nextWidth !== width ||
      nextHeight !== height ||
      nextDpr !== dpr
    ) {
      width = nextWidth;
      height = nextHeight;
      dpr = nextDpr;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      populate();
    }

    scrollOffset = scrollY;
    measureAnchor();
  }

  new ResizeObserver(measureAnchor).observe(space);
  new ResizeObserver(measureAnchor).observe(hero);

  addEventListener('resize', resize, {passive:true});

  addEventListener('scroll', () => {
    scrollOffset = scrollY;

    if (!paused()) {
      parallaxOffset = scrollOffset;
    }

    lastPaint = -Infinity;
    wake();
  }, {passive:true});

  new IntersectionObserver(entries => {
    heroVisible = entries[0].isIntersecting;
    wake();
  }).observe(hero);

  function paint() {
    if (!ctx || !width) return;

    const c = ctx;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, width, height);

    const velocities = [.28, 1.35, 3.1];

    stars.forEach(star => {
      const speed = velocities[star.layer];
      const depth = (star.layer + 1) / 3;

      const x = wrap(
        star.x + time * speed + yaw * depth * 5,
        width
      );

      const y = wrap(
        star.y -
        time * speed * .13 -
        parallaxOffset * depth * .022 +
        pitch * depth * 4,
        height
      );

      const edge = smooth(
        Math.min(x, width - x, y, height - y) / 22
      );

      const brightness = star.change
        ? .88 + Math.sin(time * .23 + star.phase) * .12
        : 1;

      c.globalAlpha = star.light * edge * brightness;
      c.fillStyle = star.layer === 2 ? '#d3e1e3' : '#a8bbc8';
      c.beginPath();
      c.arc(x, y, star.radius, 0, TAU);
      c.fill();
    });

    /* One open current bends around NORTHSTAR, then dissolves. */
    const anchorY = anchorDocumentY - scrollOffset;

    if (
      heroVisible &&
      anchorY > -180 &&
      anchorY < height + 180
    ) {
      const span = Math.max(290, Math.min(590, width * .52));

      const visibility = smooth(
        Math.min(
          anchorY + 180,
          height + 180 - anchorY
        ) / 180
      );

      const passage = wrap(time / 24, 1);

      current.forEach(star => {
        const u = wrap(star.u + time * .014 * star.depth, 1);
        const bend = Math.exp(-(((u - .5) / .2) ** 2));

        const x =
          anchorX +
          (u - .5) * span +
          yaw * star.depth * 5;

        const y =
          anchorY +
          26 +
          52 * bend -
          85 * u +
          star.offset +
          pitch * star.depth * 4;

        const fade = Math.sin(Math.PI * u) ** 2;
        const light = Math.exp(-(((u - passage) / .1) ** 2));

        c.globalAlpha =
          (.2 + light * .24) *
          fade *
          visibility *
          star.depth;

        c.fillStyle = '#c4d9df';
        c.beginPath();
        c.arc(x, y, .48 + light * .16, 0, TAU);
        c.fill();
      });

      emblem.style.setProperty('--star-x', `${yaw * 1.4}px`);
      emblem.style.setProperty('--star-y', `${pitch * 1.4}px`);
    }

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

    if (!paused()) {
      time += dt;
    }

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

  document.addEventListener('visibilitychange', wake);

  new MutationObserver(syncMotionPreference).observe(document.body, {
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
      if (!document.body.classList.contains('motion-paused')) {
        document.body.classList.add('motion-paused');
      }

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

  addEventListener('pointermove', event => {
    if (paused() || event.pointerType !== 'mouse') return;

    targetYaw =
      (event.clientX / Math.max(1, width) - .5) * .5;

    targetPitch =
      (event.clientY / Math.max(1, height) - .5) * .3;

    wake();
  }, {passive:true});

  document.documentElement.addEventListener('pointerleave', () => {
    targetYaw = targetPitch = 0;
    wake();
  });

  /* The optional panel shows real financial detail. */
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

  /* Keep ordinary section URLs and browser history. */
  document.addEventListener('northstar:ready', () => {
    const nav = document.querySelector('.nav');
    const links = [...nav.querySelectorAll('a')];

    const targets = links.map(link =>
      document.querySelector(link.hash)
    );

    const sections = targets.map((target, i) =>
      i ? target.closest('section') : hero
    );

    let currentSection = -1;
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

      if (index !== currentSection) {
        sections.forEach((section, i) => {
          section.classList.toggle('section-current', i === index);
        });

        currentSection = index;
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
