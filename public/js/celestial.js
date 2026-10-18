/* NORTHSTAR: a local, decorative celestial renderer.
   No financial storage access. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const canvas = $('celestial-core');
  const map = $('celestial-map');
  const dialog = $('core-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;

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

  const activationStart = performance.now();

  const paused = () =>
    reduced.matches ||
    document.body.classList.contains('motion-paused');

  const active = () =>
    !document.hidden && (visible || dialog.open);

  const views = [canvas, map].map(c => ({
    c,
    ctx: c.getContext('2d'),
    size: 0
  }));

  const clamp = n => Math.max(0, Math.min(1, n));

  const ease = n => {
    n = clamp(n);
    return n * n * (3 - 2 * n);
  };

  let seed = 1487;

  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  /* Nebula and distant stars are painted once, then reused. */
  const sky = document.createElement('canvas');
  sky.width = sky.height = 1000;
  const skyContext = sky.getContext('2d');

  if (skyContext) {
    skyContext.scale(1000 / 600, 1000 / 600);
    skyContext.translate(300, 300);

    for (let i = 0; i < 34; i++) {
      const x = (random() - .5) * 430;
      const y = (random() - .5) * 350;
      const radius = 50 + random() * 100;

      const gradient = skyContext.createRadialGradient(
        x, y, 0, x, y, radius
      );

      gradient.addColorStop(0, i % 3 ? '#254aa61a' : '#8559b324');
      gradient.addColorStop(1, '#07102100');

      skyContext.fillStyle = gradient;
      skyContext.fillRect(
        x - radius,
        y - radius,
        radius * 2,
        radius * 2
      );
    }

    for (let i = 0; i < 430; i++) {
      const x = (random() - .5) * 590;
      const y = (random() - .5) * 570;

      skyContext.globalAlpha = .12 + random() * .65;
      skyContext.fillStyle = i % 4 ? '#b9cfe9' : '#e7d6b5';
      skyContext.beginPath();
      skyContext.arc(x, y, random() * .8 + .15, 0, TAU);
      skyContext.fill();
    }

    skyContext.globalAlpha = 1;
  }

  /* Reusable light sprite avoids per-particle blur filters. */
  const spark = document.createElement('canvas');
  spark.width = spark.height = 64;
  const sparkContext = spark.getContext('2d');

  if (sparkContext) {
    const gradient = sparkContext.createRadialGradient(
      32, 32, 0, 32, 32, 32
    );

    gradient.addColorStop(0, '#f4ffff');
    gradient.addColorStop(.09, '#c3f8ff');
    gradient.addColorStop(.25, '#69caf47c');
    gradient.addColorStop(1, '#4b9cff00');

    sparkContext.fillStyle = gradient;
    sparkContext.fillRect(0, 0, 64, 64);
  }

  /* A deterministic spherical star map. Decorative, not market data. */
  const stars = Array.from({length:112}, (_, i) => {
    const y = 1 - (i + .5) / 112 * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * 2.399963;

    return [
      Math.cos(a) * r * 151,
      y * 151,
      Math.sin(a) * r * 151
    ];
  });

  const connections = [];

  stars.forEach((p, i) => {
    if (i % 4) return;

    let nearest = -1;
    let distance = Infinity;

    stars.forEach((q, j) => {
      const d = Math.hypot(
        p[0] - q[0],
        p[1] - q[1],
        p[2] - q[2]
      );

      if (j > i && d < distance) {
        distance = d;
        nearest = j;
      }
    });

    if (nearest >= 0 && distance < 65) {
      connections.push([i, nearest]);
    }
  });

  const phi = (1 + Math.sqrt(5)) / 2;

  const vertices = [
    [-1,phi,0], [1,phi,0], [-1,-phi,0], [1,-phi,0],
    [0,-1,phi], [0,1,phi], [0,-1,-phi], [0,1,-phi],
    [phi,0,-1], [phi,0,1], [-phi,0,-1], [-phi,0,1]
  ];

  const faces = [
    [0,11,5], [0,5,1], [0,1,7], [0,7,10], [0,10,11],
    [1,5,9], [5,11,4], [11,10,2], [10,7,6], [7,1,8],
    [3,9,4], [3,4,2], [3,2,6], [3,6,8], [3,8,9],
    [4,9,5], [2,4,11], [6,2,10], [8,6,7], [9,8,1]
  ];

  const rings = [
    {r:232,x:1.13,y:.18,s:.026,c:'#94cee9'},
    {r:199,x:.42,y:-.66,s:-.042,c:'#74dfed'},
    {r:181,x:1.32,y:.82,s:.055,c:'#dfbe88'},
    {r:169,x:-.63,y:1.02,s:-.038,c:'#b4a4ef'}
  ];

  function resize(v) {
    const box = v.c.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.65);

    v.size = Math.min(box.width, box.height);
    v.dpr = dpr;
    v.c.width = Math.round(box.width * dpr);
    v.c.height = Math.round(box.height * dpr);
  }

  new ResizeObserver(() => {
    views.forEach(resize);
    wake();
  }).observe(canvas);

  new ResizeObserver(() => {
    resize(views[1]);
    wake();
  }).observe(map);

  function project(x, y, z, rx = 0, ry = 0, rz = 0) {
    [x,y] = [
      x * Math.cos(rz) - y * Math.sin(rz),
      x * Math.sin(rz) + y * Math.cos(rz)
    ];

    [y,z] = [
      y * Math.cos(rx) - z * Math.sin(rx),
      y * Math.sin(rx) + z * Math.cos(rx)
    ];

    [x,z] = [
      x * Math.cos(ry) + z * Math.sin(ry),
      -x * Math.sin(ry) + z * Math.cos(ry)
    ];

    [x,z] = [
      x * Math.cos(yaw) + z * Math.sin(yaw),
      -x * Math.sin(yaw) + z * Math.cos(yaw)
    ];

    [y,z] = [
      y * Math.cos(pitch) - z * Math.sin(pitch),
      y * Math.sin(pitch) + z * Math.cos(pitch)
    ];

    const perspective = 850 / (850 - z);

    return {
      x: x * perspective,
      y: y * perspective,
      z
    };
  }

  const orbit = (a, r, rx, ry) =>
    project(Math.cos(a) * r, Math.sin(a) * r, 0, rx, ry);

  function line(c, p, q, color, alpha, width = .6) {
    c.globalAlpha = alpha;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(p.x, p.y);
    c.lineTo(q.x, q.y);
    c.stroke();
  }

  function draw(v) {
    if (!v.ctx || !v.size) return;

    const c = v.ctx;
    const w = v.c.width / v.dpr;
    const h = v.c.height / v.dpr;
    const age = (performance.now() - activationStart) / 1000;

    const ceremonial =
      document.body.classList.contains('intro') && !paused();

    const phase = ceremonial ? ease(age / 2.5) : 1;

    c.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    c.clearRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.scale(v.size / 600, v.size / 600);

    c.globalAlpha = .85;

    if (skyContext) {
      c.drawImage(sky, -300, -300, 600, 600);
    }

    const halo = c.createRadialGradient(0, 0, 15, 0, 0, 255);
    halo.addColorStop(0, '#67c6ff20');
    halo.addColorStop(.55, '#30519c1b');
    halo.addColorStop(1, '#10205000');

    c.globalAlpha = 1;
    c.fillStyle = halo;
    c.fillRect(-280, -280, 560, 560);

    /* Projection plinth: no distance or radius encodes performance. */
    c.save();
    c.translate(0, 218);
    c.scale(1, .22);

    const plinth = c.createRadialGradient(0, 0, 10, 0, 0, 190);
    plinth.addColorStop(0, '#72d8f525');
    plinth.addColorStop(.7, '#3765bf15');
    plinth.addColorStop(1, '#223b7300');

    c.fillStyle = plinth;
    c.fillRect(-200, -200, 400, 400);

    [110,155,186].forEach((r, i) => {
      c.globalAlpha = .2 + phase * .12;
      c.strokeStyle = i === 1 ? '#c8b587' : '#89d6ee';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.stroke();
    });

    c.restore();

    const beam = c.createLinearGradient(0, 90, 0, 218);
    beam.addColorStop(0, '#79cfff00');
    beam.addColorStop(1, '#79cfff10');

    c.globalAlpha = phase;
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(-90, 100);
    c.lineTo(-24, 218);
    c.lineTo(24, 218);
    c.lineTo(90, 100);
    c.closePath();
    c.fill();

    /* Fixed calibration marks. */
    for (let i = 0; i < 120; i++) {
      const a = i * TAU / 120;
      const outer = 263;
      const inner = i % 10 === 0 ? 252 : i % 5 === 0 ? 257 : 260;

      line(
        c,
        {x:Math.cos(a) * inner, y:Math.sin(a) * inner},
        {x:Math.cos(a) * outer, y:Math.sin(a) * outer},
        '#a3bcd2',
        i % 5 === 0 ? .42 : .15
      );
    }

    c.globalAlpha = .62;
    c.fillStyle = '#a6c5d7';
    c.textAlign = 'center';
    c.font = '8px ui-monospace,monospace';

    ['N','E','S','W'].forEach((text, i) => {
      const a = (i - 1) * TAU / 4;
      c.fillText(text, Math.cos(a) * 277, Math.sin(a) * 277 + 3);
    });

    c.font = '6px ui-monospace,monospace';
    c.fillStyle = '#d2bd92';
    c.fillText('LUMEN / ORBIS / MEMORIA', 0, -246);

    const primitives = [];

    const addLine = (p, q, color, alpha, width = .6) => {
      primitives.push({
        z: (p.z + q.z) / 2,
        paint: () => line(c, p, q, color, alpha, width)
      });
    };

    /* Translucent globe. */
    primitives.push({
      z: -160,
      paint() {
        const glass = c.createRadialGradient(-58, -68, 5, 0, 0, 155);
        glass.addColorStop(0, '#87dfff0d');
        glass.addColorStop(.68, '#132d5622');
        glass.addColorStop(.94, '#5b9ce61b');
        glass.addColorStop(1, '#b8e5ff38');

        c.globalAlpha = phase;
        c.fillStyle = glass;
        c.beginPath();
        c.arc(0, 0, 155, 0, TAU);
        c.fill();

        c.strokeStyle = '#a6d4ee65';
        c.lineWidth = .8;
        c.stroke();
      }
    });

    /* Meridians rotate together as one sphere. */
    for (let band = 0; band < 7; band++) {
      for (let i = 0; i < 72; i++) {
        const a = i * TAU / 72;
        const ry = time * .026 + band * Math.PI / 7;
        const p = orbit(a, 155, .15, ry);
        const q = orbit(a + TAU / 72, 155, .15, ry);

        addLine(
          p, q, '#83b7e5',
          (p.z < 0 ? .10 : .29) * phase,
          .45
        );
      }
    }

    [-.7,-.35,.35,.7].forEach(latitude => {
      const radius = Math.sqrt(1 - latitude * latitude) * 155;

      for (let i = 0; i < 64; i++) {
        const a = i * TAU / 64;
        const b = a + TAU / 64;

        const p = project(
          Math.cos(a) * radius,
          latitude * 155,
          Math.sin(a) * radius,
          .15,
          time * .026
        );

        const q = project(
          Math.cos(b) * radius,
          latitude * 155,
          Math.sin(b) * radius,
          .15,
          time * .026
        );

        addLine(
          p, q, '#8dbbdd',
          (p.z < 0 ? .08 : .23) * phase,
          .45
        );
      }
    });

    const projected = stars.map(p => project(...p, .15, time * .026));

    connections.forEach(([a, b]) => {
      addLine(
        projected[a],
        projected[b],
        '#d8d6af',
        (projected[a].z < 0 ? .08 : .38) * phase,
        .65
      );
    });

    projected.forEach((p, i) => {
      primitives.push({
        z: p.z,
        paint() {
          c.globalAlpha =
            (p.z < 0 ? .16 : .45 + (i % 5) * .1) * phase;

          if (i % 9 === 0 && sparkContext) {
            c.drawImage(spark, p.x - 7, p.y - 7, 14, 14);
          }

          c.fillStyle = i % 8 ? '#cbe8ff' : '#f3d8a4';
          c.beginPath();
          c.arc(p.x, p.y, i % 9 === 0 ? 1.6 : .65, 0, TAU);
          c.fill();
        }
      });
    });

    rings.forEach((ring, index) => {
      const assembly = ceremonial
        ? ease((age - .18 - index * .22) / 1.3)
        : 1;

      const r = ring.r * (.72 + .28 * assembly);

      const alignment = Math.pow(
        Math.max(0, Math.cos(time * TAU / 96 + Math.PI)),
        28
      );

      const rx = ring.x * (1 - alignment) + .85 * alignment;

      const ry =
        (ring.y + Math.sin(time * .022) * .12) *
        (1 - alignment) +
        .3 * alignment;

      const emphasis =
        v.c === map &&
        index > 0 &&
        index !== {VWCE:1,VFEA:2,SXR8:3}[selected]
          ? .35
          : 1;

      for (let i = 0; i < 128; i++) {
        const a = i * TAU / 128 + time * ring.s;
        const p = orbit(a, r, rx, ry);
        const q = orbit(a + TAU / 128, r, rx, ry);

        const pulse =
          (i + Math.floor(time * 9) + index * 23) % 128 < 5;

        addLine(
          p,
          q,
          ring.c,
          (p.z < 0 ? .22 : .78) * assembly * emphasis,
          pulse ? 2.3 : i % 16 < 11 ? 1.1 : .35
        );

        if (i % 4 === 0) {
          const tick = orbit(
            a,
            r - (i % 16 === 0 ? 8 : 3),
            rx,
            ry
          );

          addLine(p, tick, ring.c, .5 * assembly * emphasis, .7);
        }
      }

      for (let n = 0; n < 2; n++) {
        const p = orbit(
          time * ring.s * 3 + n * Math.PI + index,
          r,
          rx,
          ry
        );

        primitives.push({
          z: p.z,
          paint() {
            c.globalAlpha =
              (p.z < 0 ? .3 : 1) * assembly * emphasis;

            if (sparkContext) {
              c.drawImage(spark, p.x - 11, p.y - 11, 22, 22);
            }

            c.fillStyle = ring.c;
            c.beginPath();
            c.arc(p.x, p.y, 2, 0, TAU);
            c.fill();
          }
        });
      }
    });

    /* Rotating crystalline seed. */
    const core = vertices.map(p =>
      project(
        p[0] * 39,
        p[1] * 39,
        p[2] * 39,
        .42,
        time * .085 + .3,
        time * .035
      )
    );

    faces.forEach((face, i) => {
      const points = face.map(index => core[index]);
      const z = points.reduce((sum, p) => sum + p.z, 0) / 3;

      primitives.push({
        z,
        paint() {
          c.globalAlpha = 1;
          c.beginPath();

          points.forEach((p, j) => {
            if (j) c.lineTo(p.x, p.y);
            else c.moveTo(p.x, p.y);
          });

          c.closePath();

          c.fillStyle = i % 3
            ? `rgba(42,91,122,${z > 0 ? .22 : .08})`
            : `rgba(189,148,80,${z > 0 ? .23 : .06})`;

          c.fill();

          c.strokeStyle = z > 0 ? '#dfd6aa88' : '#85accc35';
          c.lineWidth = z > 0 ? .9 : .5;
          c.stroke();
        }
      });
    });

    /* NORTHSTAR remains recognizable at the centre. */
    primitives.push({
      z: 5,
      paint() {
        c.globalAlpha = 1;

        const aura = c.createRadialGradient(0, 0, 1, 0, 0, 83);
        aura.addColorStop(0, '#c7f6ff70');
        aura.addColorStop(.23, '#5fcaff35');
        aura.addColorStop(1, '#629dff00');

        c.fillStyle = aura;
        c.fillRect(-85, -85, 170, 170);

        const metal = c.createLinearGradient(-40, -55, 40, 55);
        metal.addColorStop(0, '#fff4d7');
        metal.addColorStop(.48, '#d5f7ff');
        metal.addColorStop(.5, '#498298');
        metal.addColorStop(1, '#d5d5b4');

        c.fillStyle = metal;
        c.beginPath();

        [
          [0,-53], [10,-10], [44,0], [10,10],
          [0,53], [-10,10], [-44,0], [-10,-10]
        ].forEach((p, i) => {
          if (i) c.lineTo(...p);
          else c.moveTo(...p);
        });

        c.closePath();
        c.fill();
        c.strokeStyle = '#e6ffff';
        c.lineWidth = .7;
        c.stroke();

        c.fillStyle = '#142d45';
        c.beginPath();
        c.moveTo(0, -11);
        c.lineTo(11, 0);
        c.lineTo(0, 11);
        c.lineTo(-11, 0);
        c.closePath();
        c.fill();

        if (sparkContext) {
          c.drawImage(spark, -11, -11, 22, 22);
        }
      }
    });

    primitives
      .sort((a, b) => a.z - b.z)
      .forEach(p => p.paint());

    c.globalAlpha = .35 * phase;
    c.strokeStyle = '#d9efff';
    c.lineWidth = 1.2;
    c.beginPath();
    c.arc(-2, -1, 150, 3.65, 4.7);
    c.stroke();

    if (ceremonial && age > .65 && age < 2.6) {
      const pulse = ease((age - .65) / 1.95);

      c.globalAlpha = Math.sin(pulse * Math.PI) * .35;
      c.strokeStyle = '#b6e9ff';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, 0, 30 + pulse * 220, 0, TAU);
      c.stroke();
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

    if (!paused()) time += dt;

    const easing = 1 - Math.exp(-Math.max(dt, 1 / 120) * 9);

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
    if (!frame && active()) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    wake();
  }).observe($('instrument'));

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

  document.addEventListener('visibilitychange', wake);
  reduced.addEventListener('change', syncMotionPreference);
  syncMotionPreference();

  new MutationObserver(wake).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || paused()) return;

    const b = canvas.getBoundingClientRect();

    targetYaw =
      (e.clientX - b.left - b.width / 2) / b.width * .4;

    targetPitch =
      (e.clientY - b.top - b.height / 2) / b.height * .25;

    wake();
  }, {passive:true});

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

    targetYaw =
      drag.yaw + (e.clientX - drag.x) / rect.width * 2;

    targetPitch = Math.max(
      -.8,
      Math.min(
        .8,
        drag.pitch + (e.clientY - drag.y) / rect.height * 2
      )
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
      targetYaw +=
        e.key === 'ArrowLeft' ? -.12 :
        e.key === 'ArrowRight' ? .12 : 0;

      targetPitch = Math.max(
        -.8,
        Math.min(
          .8,
          targetPitch + (
            e.key === 'ArrowUp' ? -.12 :
            e.key === 'ArrowDown' ? .12 : 0
          )
        )
      );

      wake();
    }
  });

  /* Section links retain ordinary URLs and browser history. */
  document.addEventListener('northstar:ready', () => {
    const nav = document.querySelector('.nav');
    const links = [...nav.querySelectorAll('a')];

    const targets = links.map(link =>
      document.querySelector(link.hash)
    );

    const sections = targets.map((target, i) =>
      i
        ? target.closest('section')
        : document.querySelector('.observatory')
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

      nav.style.setProperty(
        '--beacon-x',
        `${position.left - bounds.left}px`
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

        if (i === 0) {
          scrollTo({
            top:0,
            behavior:paused() ? 'instant' : 'smooth'
          });
        } else {
          targets[i].scrollIntoView({
            behavior:paused() ? 'instant' : 'smooth',
            block:'start'
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

      const index = links.findIndex(
        link => link.hash === location.hash
      );

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
