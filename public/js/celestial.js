/* Celestial presentation only. Never reads or writes portfolio storage. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('celestial-core');
  const map = $('celestial-map');
  const dialog = $('core-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  let summary;
  let selected = 'VWCE';
  let visible = true;
  let frame = 0;
  let time = 0;
  let last = 0;
  let yaw = 0;
  let pitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;
  let drag = null;
  let rect;

  const views = [canvas, map].map(c => ({
    c,
    ctx: c.getContext('2d'),
    size: 0
  }));

  const activationStart = performance.now();

  const rings = [
    {r:194,x:.35,y:.08,s:.032,c:'#9caeae',name:'SIDEREAL / 001'},
    {r:171,x:1.03,y:.47,s:-.049,c:'#75cfe0',name:'ECLIPTIC / 002'},
    {r:151,x:-.70,y:.95,s:.061,c:'#c7a774',name:'INCLINATION / 003'},
    {r:129,x:.88,y:-.74,s:-.079,c:'#a999d0',name:'REFERENCE / 004'}
  ];

  const paused = () =>
    reduced.matches ||
    document.body.classList.contains('motion-paused');

  const active = () =>
    !document.hidden && (visible || dialog.open);

  function resize(v) {
    const box = v.c.getBoundingClientRect();
    v.size = Math.min(box.width, box.height);

    const dpr = Math.min(devicePixelRatio || 1, 1.75);

    v.c.width = Math.round(box.width * dpr);
    v.c.height = Math.round(box.height * dpr);
    v.dpr = dpr;
  }

  const observer = new ResizeObserver(() => {
    views.forEach(resize);
    wake();
  });

  views.forEach(v => observer.observe(v.c));

  function point(a, r, rx, ry) {
    let x = Math.cos(a) * r;
    let y = Math.sin(a) * r;
    let z = 0;

    [y, z] = [
      y * Math.cos(rx),
      y * Math.sin(rx)
    ];

    [x, z] = [
      x * Math.cos(ry) + z * Math.sin(ry),
      -x * Math.sin(ry) + z * Math.cos(ry)
    ];

    [x, z] = [
      x * Math.cos(yaw) + z * Math.sin(yaw),
      -x * Math.sin(yaw) + z * Math.cos(yaw)
    ];

    [y, z] = [
      y * Math.cos(pitch) - z * Math.sin(pitch),
      y * Math.sin(pitch) + z * Math.cos(pitch)
    ];

    const perspective = 720 / (720 - z);

    return {
      x: x * perspective,
      y: y * perspective,
      z
    };
  }

  function draw(v) {
    if (!v.ctx || !v.size) return;

    const c = v.ctx;
    const w = v.c.width / v.dpr;
    const h = v.c.height / v.dpr;
    const s = v.size / 490;

    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.scale(s, s);

    const halo = c.createRadialGradient(0, 0, 25, 0, 0, 236);
    halo.addColorStop(0, '#75ced027');
    halo.addColorStop(.55, '#316a7620');
    halo.addColorStop(1, '#10263300');

    c.fillStyle = halo;
    c.fillRect(-245, -245, 490, 490);
    c.strokeStyle = '#91b1ba28';
    c.lineWidth = .6;

    [216, 228].forEach(r => {
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.stroke();
    });

    for (let i = 0; i < 120; i++) {
      const a = i * Math.PI / 60;
      const r = i % 10 === 0 ? 217 : i % 5 === 0 ? 222 : 225;

      c.beginPath();
      c.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      c.lineTo(Math.cos(a) * 230, Math.sin(a) * 230);
      c.stroke();
    }

    c.font = '8px ui-monospace, monospace';
    c.fillStyle = '#9daea9';
    c.textAlign = 'center';

    ['N', 'E', 'S', 'W'].forEach((t, i) => {
      const a = (i - 1) * Math.PI / 2;
      c.fillText(t, Math.cos(a) * 240, Math.sin(a) * 240 + 3);
    });

    const primitives = [];

    // Globe guides are decorative, not a financial scale.
    for (let band = 0; band < 3; band++) {
      for (let i = 0; i < 72; i++) {
        const a = i * Math.PI / 36;
        const rotation = band * Math.PI / 3 + time * .012;
        const p = point(a, 112, .8, rotation);
        const q = point(a + Math.PI / 36, 112, .8, rotation);

        primitives.push({
          z: (p.z + q.z) / 2,
          paint() {
            c.globalAlpha = p.z < 0 ? .10 : .22;
            c.strokeStyle = '#7bafb9';
            c.lineWidth = .55;
            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x, q.y);
            c.stroke();
          }
        });
      }
    }

    rings.forEach((ring, index) => {
      const ceremonial =
        document.body.classList.contains('intro') && !paused();

      const assembled = ceremonial
        ? Math.max(
            0,
            Math.min(
              1,
              (
                (performance.now() - activationStart) / 1000 -
                .25 -
                index * .23
              ) / .85
            )
          )
        : 1;

      const radius = ring.r * (.82 + .18 * assembled);
      const selectedRing = {VWCE:1, VFEA:2, SXR8:3}[selected];

      const emphasis =
        v.c === map && index > 0 && index !== selectedRing
          ? .45
          : 1;

      const alignment = Math.pow(
        Math.max(0, Math.cos(time * Math.PI * 2 / 84 + Math.PI)),
        32
      );

      const rx =
        (ring.x + Math.sin(time * .035) * .12) *
        (1 - alignment) +
        .72 * alignment;

      const ry =
        (ring.y + time * ring.s * .22) *
        (1 - alignment) +
        .38 * alignment;

      for (let i = 0; i < 180; i++) {
        const a = i * Math.PI / 90 + time * ring.s;
        const p = point(a, radius, rx, ry);
        const q = point(a + Math.PI / 90, radius, rx, ry);

        primitives.push({
          z: (p.z + q.z) / 2,
          paint() {
            c.globalAlpha =
              (p.z < 0 ? .34 : .86) * assembled * emphasis;

            c.strokeStyle = ring.c;

            const pulse =
              (i + Math.floor(time * 11) + index * 30) % 180 < 7;

            c.lineWidth = pulse ? 2.7 : i % 30 < 19 ? 1.5 : .45;

            c.beginPath();
            c.moveTo(p.x, p.y);
            c.lineTo(q.x, q.y);
            c.stroke();

            if (i % 5 === 0) {
              const t = point(
                a,
                radius - (i % 15 === 0 ? 7 : 3),
                rx,
                ry
              );

              c.lineWidth = .7;
              c.beginPath();
              c.moveTo(p.x, p.y);
              c.lineTo(t.x, t.y);
              c.stroke();
            }
          }
        });
      }

      for (let n = 0; n < 2; n++) {
        const p = point(
          time * (ring.s * 3) + n * Math.PI + index,
          ring.r,
          rx,
          ry
        );

        primitives.push({
          z: p.z,
          paint() {
            c.globalAlpha =
              (p.z < 0 ? .4 : 1) * assembled * emphasis;

            c.fillStyle = ring.c;
            c.shadowColor = ring.c;
            c.shadowBlur = 9;

            c.beginPath();
            c.arc(p.x, p.y, n === 0 ? 3 : 1.7, 0, Math.PI * 2);
            c.fill();

            c.shadowBlur = 0;
          }
        });
      }

      const inscription = point(
        time * ring.s + .4,
        ring.r + 10,
        rx,
        ry
      );

      primitives.push({
        z: inscription.z,
        paint() {
          c.globalAlpha = .65 * assembled;
          c.font = '6px ui-monospace, monospace';
          c.fillStyle = ring.c;
          c.fillText(ring.name, inscription.x, inscription.y);
        }
      });
    });

    const stars = [
      [-93, -61, -50],
      [-53, -96, 20],
      [8, -80, 35],
      [42, -123, -20]
    ];

    primitives.push({
      z: -60,
      paint() {
        c.globalAlpha = .3;
        c.strokeStyle = '#a6c7dd';
        c.lineWidth = .6;
        c.beginPath();

        stars.forEach((p, i) => {
          if (i) c.lineTo(p[0], p[1]);
          else c.moveTo(p[0], p[1]);
        });

        c.stroke();

        stars.forEach(p => {
          c.beginPath();
          c.arc(p[0], p[1], 1.5, 0, 7);
          c.fillStyle = '#c1dce7';
          c.fill();
        });
      }
    });

    // Opaque housing occludes the geometry behind the central star.
    primitives.push({
      z: 0,
      paint() {
        c.globalAlpha = 1;

        const rim = c.createLinearGradient(-74, -74, 74, 74);
        rim.addColorStop(0, '#d0c6a8');
        rim.addColorStop(.25, '#354b51');
        rim.addColorStop(.5, '#0b171d');
        rim.addColorStop(.8, '#9daea5');
        rim.addColorStop(1, '#233840');

        c.beginPath();
        c.arc(0, 0, 71, 0, Math.PI * 2);
        c.fillStyle = rim;
        c.fill();

        c.beginPath();
        c.arc(0, 0, 67, 0, Math.PI * 2);
        c.strokeStyle = '#071017';
        c.lineWidth = 3;
        c.stroke();

        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          c.fillStyle = i % 2 ? '#b9c7bd' : '#789ea2';
          c.beginPath();
          c.arc(Math.cos(a) * 68, Math.sin(a) * 68, 1, 0, 7);
          c.fill();
        }

        const surface = c.createRadialGradient(-18, -25, 0, 0, 0, 64);
        surface.addColorStop(0, '#24404a');
        surface.addColorStop(.7, '#0d1a22');
        surface.addColorStop(1, '#030b12');

        c.fillStyle = surface;
        c.beginPath();
        c.arc(0, 0, 64, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#c0b28b99';
        c.lineWidth = 1;
        c.stroke();

        c.beginPath();
        c.arc(0, 0, 58, 0, Math.PI * 2);
        c.strokeStyle = '#a4c9cc40';
        c.stroke();

        c.shadowColor = '#b5efff';
        c.shadowBlur = 18;

        const metal = c.createLinearGradient(-45, -50, 45, 60);
        metal.addColorStop(0, '#fff4d2');
        metal.addColorStop(.48, '#c8edf0');
        metal.addColorStop(.5, '#568d9b');
        metal.addColorStop(1, '#c8e5de');

        c.fillStyle = metal;
        c.beginPath();

        [
          [0, -52],
          [12, -12],
          [52, 0],
          [12, 12],
          [0, 52],
          [-12, 12],
          [-52, 0],
          [-12, -12]
        ].forEach((p, i) => {
          if (i) c.lineTo(...p);
          else c.moveTo(...p);
        });

        c.closePath();
        c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = '#e0faff';
        c.lineWidth = .7;
        c.stroke();

        c.fillStyle = '#122d38';
        c.beginPath();
        c.moveTo(0, -13);
        c.lineTo(13, 0);
        c.lineTo(0, 13);
        c.lineTo(-13, 0);
        c.closePath();
        c.fill();

        c.fillStyle = '#edffff';
        c.beginPath();
        c.arc(0, 0, 3, 0, 7);
        c.fill();
      }
    });

    primitives
      .sort((a, b) => a.z - b.z)
      .forEach(p => p.paint());

    c.globalAlpha = 1;
  }

  function tick(now) {
    frame = 0;
    if (!active()) return;

    const dt = last ? Math.min((now - last) / 1000, .05) : 0;
    last = now;

    if (!paused()) time += dt;

    const easing = 1 - Math.exp(-Math.max(dt, 1 / 120) * 10);
    yaw += (targetYaw - yaw) * easing;
    pitch += (targetPitch - pitch) * easing;

    draw(views[dialog.open ? 1 : 0]);

    if (
      !paused() ||
      Math.abs(yaw - targetYaw) +
      Math.abs(pitch - targetPitch) > .001
    ) {
      frame = requestAnimationFrame(tick);
    }
  }

  function wake() {
    last = 0;

    if (!frame && active()) {
      frame = requestAnimationFrame(tick);
    }
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    wake();
  }).observe($('instrument'));

  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', wake);

  new MutationObserver(wake).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || paused()) return;

    const b = canvas.getBoundingClientRect();

    targetYaw = (e.clientX - b.left - b.width / 2) / b.width * .35;
    targetPitch = (e.clientY - b.top - b.height / 2) / b.height * .25;

    wake();
  }, {passive: true});

  canvas.addEventListener('pointerleave', () => {
    targetYaw = targetPitch = 0;
    wake();
  });

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
      : 'S&P 500 reference · benchmark only. Excluded from your holdings and allocation.';

    box.append(description);

    if (holding && summary?.count && row && row.cells.length >= 6) {
      const list = document.createElement('dl');
      list.className = 'asset-metrics';

      [
        'Asset',
        'Invested',
        'Shares',
        'Latest close',
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

  document.addEventListener('northstar:summary', e => {
    summary = e.detail;

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

    if (dialog.open) details();
  });

  $('explore-core').addEventListener('click', () => {
    dialog.showModal();
    details();
    views.forEach(resize);
    wake();
  });

  function close() {
    dialog.close();
    targetYaw = targetPitch = 0;
    $('explore-core').focus();
    wake();
  }

  $('close-core').addEventListener('click', close);

  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    close();
  });

  dialog.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;

    const controls = [
      ...dialog.querySelectorAll('button:not(:disabled),[tabindex="0"]')
    ];

    const first = controls[0];
    const last = controls.at(-1);

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  dialog.addEventListener('close', () => {
    targetYaw = targetPitch = 0;
    $('explore-core').focus();
    wake();
  });

  document.querySelectorAll('[data-asset]').forEach(button => {
    button.addEventListener('click', () => {
      selected = button.dataset.asset;

      document.querySelectorAll('[data-asset]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === button));
      });

      details();
      wake();
    });
  });

  const reset = () => {
    targetYaw = targetPitch = 0;
    wake();
  };

  $('reset-core').addEventListener('click', reset);

  map.addEventListener('pointerdown', e => {
    if (!e.isPrimary) return;

    rect = map.getBoundingClientRect();

    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      yaw: targetYaw,
      pitch: targetPitch
    };

    map.setPointerCapture(e.pointerId);
  });

  map.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;

    targetYaw = drag.yaw + (e.clientX - drag.x) / rect.width * 2;

    targetPitch = Math.max(
      -.8,
      Math.min(.8, drag.pitch + (e.clientY - drag.y) / rect.height * 2)
    );

    wake();
  });

  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(name => {
    map.addEventListener(name, () => {
      drag = null;
      reset();
    });
  });

  map.addEventListener('keydown', e => {
    if (
      !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key)
    ) {
      return;
    }

    e.preventDefault();

    if (e.key === 'Home') {
      reset();
    } else {
      targetYaw += e.key === 'ArrowLeft'
        ? -.12
        : e.key === 'ArrowRight' ? .12 : 0;

      targetPitch = Math.max(
        -.8,
        Math.min(
          .8,
          targetPitch + (
            e.key === 'ArrowUp' ? -.12 : e.key === 'ArrowDown' ? .12 : 0
          )
        )
      );

      wake();
    }
  });

  // Ordinary anchor URLs and browser history are preserved.
  document.addEventListener('northstar:ready', () => {
    const nav = document.querySelector('.nav');
    const links = [...nav.querySelectorAll('a')];
    const targets = links.map(link => document.querySelector(link.hash));

    const sections = targets.map((target, i) =>
      i ? target.closest('section') : document.querySelector('.observatory')
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

      const bounds = nav.getBoundingClientRect();
      const position = links[index].getBoundingClientRect();

      nav.style.setProperty('--beacon-x', `${position.left - bounds.left}px`);
      nav.style.setProperty('--beacon-width', `${position.width}px`);

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
        if (section.getBoundingClientRect().top <= boundary) index = i;
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

        if (i === 0) {
          scrollTo({
            top: 0,
            behavior: paused() ? 'instant' : 'smooth'
          });
        } else {
          targets[i].scrollIntoView({
            behavior: paused() ? 'instant' : 'smooth',
            block: 'start'
          });
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

      const index = links.findIndex(link => link.hash === location.hash);

      if (index >= 0) {
        if (index === 0) {
          scrollTo({top:0, behavior:'instant'});
        } else {
          targets[index].scrollIntoView({
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

  if (!views[0].ctx) {
    canvas.hidden = true;
    document.body.classList.add('canvas-fallback');
  }

  if (!views[1].ctx) map.hidden = true;

  wake();
})();
