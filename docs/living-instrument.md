# NORTHSTAR: the living celestial instrument

The signature is a projected 3D orrery around the existing four-point star. Four calibrated orbital planes precess at deliberate speeds, carry tracking points and travelling light, and briefly align every 84 seconds. Segments are depth-sorted, with the central housing occluding the rear geometry. Canvas 2D supplies perspective without WebGL, a framework, or downloaded assets. The retained SVG compass is the fallback when a Canvas context is unavailable.

Orbital positions, radii and speeds are decorative. They never represent returns or allocation. The atlas labels actual holdings and allocation from the portfolio engine's existing summary and rendered holdings, and identifies SXR8 as benchmark only. The presentation layer never reads or writes portfolio storage. Financial calculations, history, import/export code and `jarvis-private-portfolio-v1` are unchanged.

Motion has three tempos: slow ambient precession; short, precise control feedback; and a first-session activation lasting 2.6 seconds. Repeat visits use a brief settle. Reduced motion and Motion OFF stop ambient rendering; explicit atlas rotation remains available. Only a visible instrument or open atlas schedules drawing. Hidden tabs stop drawing, Canvas pixel ratio is capped at 1.75, and the renderer uses four rings and eight tracking points. No frame-rate or hardware battery measurement is claimed.

“Explore core” opens a native modal with explicit focus wrapping, Escape, close and focus restoration. Drag is restricted to its labelled canvas so the rest of the page remains a normal scrolling surface. Arrow keys rotate; Home and Reset restore orientation. Outside the modal, pointer response is mouse-only. Navigation uses ordinary section anchors and browser history.

## Run locally

No installation or build is required. From the existing checkout:

```sh
python3 -m http.server 8010 --bind 127.0.0.1 --directory public
```

## Browser validation

The smoke test uses Node 22+ and a running Chromium DevTools endpoint. Start Chromium in another terminal with a temporary profile:

```sh
chromium --headless --no-sandbox --disable-dev-shm-usage \
  --remote-debugging-port=9230 --user-data-dir=/tmp/northstar-test-browser about:blank
```

Then run:

```sh
node tests/celestial-smoke.mjs
```

Optional environment variables: `NORTHSTAR_TEST_ORIGIN` (default internal server port 8010), `NORTHSTAR_DEBUG_ORIGIN` (default DevTools port 9230), and `NORTHSTAR_SCREENSHOTS` (default `/tmp/northstar-validation`). The test creates and disposes a separate incognito browser context; it never uses a person's existing portfolio. Screenshots contain explicitly isolated sample purchases, not private transactions.

Validation covers an empty portfolio; a two-purchase sample worth €1,814.34 using committed prices; unchanged storage; JSON import round trip; JSON/CSV export contents; refresh; chart date/percentage scrubbing, series visibility and timeframes; five viewports; modal touch rotation with ambient motion stopped; Shift+Tab containment, Escape and focus return; section navigation and Back; reduced motion; and uncaught JavaScript exceptions. Screenshot viewports are desktop 1440×1000, iPad Pro landscape 1366×1024, portrait 1024×1366, smaller iPad portrait 834×1194, and mobile 390×844.

These are Chromium viewport and emulated touch checks. Physical iPad Safari rendering, VoiceOver and device performance require hardware testing. Existing external TradingView and market-data publishing workflows are outside this redesign.

## Refinement pass

The core now has a recessed metal housing, fasteners, and faint globe meridians. Time-based orientation damping keeps touch settling consistent across render rates. Selecting an atlas asset emphasizes its decorative reference track while retaining the explicit non-financial orbit disclaimer. The overview includes contributed capital and the actual allocation basis and percentages; no interpolated values are used. A single travelling navigation beacon follows section anchors, manual scrolling and browser history. Section coordinates and an active panel edge provide orientation further down the page.
