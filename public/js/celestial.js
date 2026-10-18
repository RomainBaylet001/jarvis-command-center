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

   
