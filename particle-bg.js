/**
 * particle-bg.js — Casberry-style 3D particle background for clovelearn.io
 * Requires Three.js r134 loaded before this script.
 *
 * ── TUNE THESE to change the visual ───────────────────────────────────────
 *
 *   N_DESKTOP / N_MOBILE   particle count (lower = better on weak hardware)
 *   COLORS                 hex palette (any length)
 *   SIZE                   base point size in pixels at reference depth
 *   SPEED_ROT_X/Y          auto-rotation speed in radians per frame
 *   MOUSE_STRENGTH         max parallax offset in radians (0 = off)
 *   SPHERE_RADIUS          world-space radius of the particle cloud
 *
 * ── To integrate a particles.casberry.in export ──────────────────────────
 *   Export the config from Casberry, then override the constants below:
 *     N_DESKTOP = export.count;
 *     COLORS    = export.palette.map(c => parseInt(c.replace('#',''), 16));
 * ──────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  // ── CONFIG ────────────────────────────────────────────────────────────────
  var N_DESKTOP      = 8000;
  var N_MOBILE       = 2500;
  var COLORS         = [0x00d4ff, 0x5a84be, 0x9333ea, 0xd4a843];
  var SIZE           = 3.5;       // px at reference depth (see vert shader)
  var SPEED_ROT_X    = 0.0003;    // radians / frame
  var SPEED_ROT_Y    = 0.0005;
  var MOUSE_STRENGTH = 0.45;      // max parallax offset in radians
  var SPHERE_RADIUS  = 400;       // world-space units
  // ─────────────────────────────────────────────────────────────────────────

  function hexToRgb(hex) {
    return [
      ((hex >> 16) & 255) / 255,
      ((hex >>  8) & 255) / 255,
       (hex        & 255) / 255
    ];
  }

  function init() {
    if (typeof THREE === 'undefined') return;
    try { if (localStorage.getItem('od_particles') === 'false') return; } catch(e) {}

    var isMobile = window.matchMedia('(max-width: 768px)').matches;
    var N   = isMobile ? N_MOBILE : N_DESKTOP;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── Canvas ────────────────────────────────────────────────────────────
    // Re-use bgCanvas on index.html so we don't add a second fixed layer.
    // Every other page gets a freshly created canvas inserted before all
    // other body children.
    var canvas = document.getElementById('bgCanvas');
    var isNew  = false;
    if (!canvas) {
      canvas       = document.createElement('canvas');
      canvas.id    = 'particle-webgl';
      canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none';
      document.body.insertBefore(canvas, document.body.firstChild);
      isNew = true;
    }

    // ── Renderer ──────────────────────────────────────────────────────────
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas:          canvas,
        alpha:           true,
        antialias:       false,
        powerPreference: 'low-power'
      });
    } catch (e) {
      // WebGL unavailable — remove any canvas we just created and bail
      if (isNew) { canvas.parentNode && canvas.parentNode.removeChild(canvas); }
      return;
    }

    renderer.setPixelRatio(dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0); // fully transparent — underlying CSS shows through

    // ── Scene + Camera ────────────────────────────────────────────────────
    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(
      60,                                          // fov
      window.innerWidth / window.innerHeight,      // aspect
      1, 2000                                      // near / far
    );
    camera.position.z = 800;

    // ── Geometry ─────────────────────────────────────────────────────────
    var posArr = new Float32Array(N * 3);
    var colArr = new Float32Array(N * 3);

    for (var i = 0; i < N; i++) {
      // Marsaglia rejection sampling → uniform points on/inside a sphere
      var x, y, z, s;
      do {
        x = Math.random() * 2 - 1;
        y = Math.random() * 2 - 1;
        z = Math.random() * 2 - 1;
        s = x * x + y * y + z * z;
      } while (s > 1 || s === 0);

      // Cube-root gives uniform volume fill (not just the shell)
      var r   = SPHERE_RADIUS * Math.cbrt(Math.random());
      var inv = r / Math.sqrt(s);
      posArr[i * 3]     = x * inv;
      posArr[i * 3 + 1] = y * inv;
      posArr[i * 3 + 2] = z * inv;

      // Cycle through the palette so all hues are evenly represented
      var rgb        = hexToRgb(COLORS[i % COLORS.length]);
      var brightness = 0.55 + Math.random() * 0.45;
      colArr[i * 3]     = rgb[0] * brightness;
      colArr[i * 3 + 1] = rgb[1] * brightness;
      colArr[i * 3 + 2] = rgb[2] * brightness;
    }

    // ── MORPH SYSTEM (shelved — architecture only, not auto-triggered) ────
    // Gate: nothing calls morphTo() yet. When gate conditions are met
    // (SEO articles live, 14d analytics, FM onboard redesign passed),
    // wire a trigger and remove this comment block.
    //
    // Shapes are pure math — no mesh files, no network, same Points geo.
    // Each generator returns a Float32Array(N*3) of target positions.
    // ────────────────────────────────────────────────────────────────────────

    var homePos   = new Float32Array(posArr);           // snapshot of initial sphere
    var targetPos = new Float32Array(N * 3);            // morph destination buffer
    var morphT    = 1;                                  // 0→1 progress (1 = idle)
    var morphDur  = 0;                                  // seconds
    var morphStart = 0;                                 // performance.now() stamp
    var morphFrom = new Float32Array(N * 3);            // snapshot at morph start

    // ── Shape generators ──────────────────────────────────────────────────
    // Each fn(i, N, R) → [x, y, z] for particle i of N within radius R.

    var shapes = {
      sphere: function (i, n, R) {
        // Marsaglia uniform sphere (same algo as init, deterministic seed via index)
        var phi   = Math.acos(1 - 2 * (i + 0.5) / n);
        var theta = Math.PI * (1 + Math.sqrt(5)) * i;  // golden-angle spiral
        var r     = R * Math.cbrt((i + 1) / n);         // uniform volume fill
        return [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        ];
      },

      torus: function (i, n, R) {
        // Parametric torus: major radius R*0.6, minor radius R*0.25
        var Rmaj = R * 0.6, Rmin = R * 0.25;
        var u = (i / n) * Math.PI * 2 * 12;            // 12 wraps for density
        var v = (i / n) * Math.PI * 2 * (1 + Math.sqrt(5)); // golden irrational fill
        var jitter = 0.85 + Math.random() * 0.3;       // slight volume scatter
        return [
          (Rmaj + Rmin * Math.cos(v) * jitter) * Math.cos(u),
          (Rmaj + Rmin * Math.cos(v) * jitter) * Math.sin(u),
           Rmin * Math.sin(v) * jitter
        ];
      },

      helix: function (i, n, R) {
        // Double helix — two interleaved strands, DNA-like
        var strand = i % 2;
        var t      = (Math.floor(i / 2) / (n / 2)) * Math.PI * 2 * 6; // 6 full turns
        var offset = strand * Math.PI;                  // 180° phase shift
        var spread = 0.9 + Math.random() * 0.2;        // volume fill
        return [
          R * 0.35 * Math.cos(t + offset) * spread,
          (((Math.floor(i / 2) / (n / 2)) - 0.5) * R * 1.6),  // vertical span
          R * 0.35 * Math.sin(t + offset) * spread
        ];
      },

      scatter: function (i, n, R) {
        // Exploded field — particles drift outward to 2× radius, sparse
        var phi   = Math.acos(1 - 2 * Math.random());
        var theta = Math.random() * Math.PI * 2;
        var r     = R * (1.2 + Math.random() * 0.8);   // 1.2R – 2.0R range
        return [
          r * Math.sin(phi) * Math.cos(theta),
          r * Math.sin(phi) * Math.sin(theta),
          r * Math.cos(phi)
        ];
      }
    };

    /**
     * morphTo(shapeName, duration)
     * Lerps all particle positions from current → target over `duration` seconds.
     * shapeName: 'sphere' | 'torus' | 'helix' | 'scatter'
     * duration:  seconds (2–4 recommended)
     *
     * Usage (when gate conditions met):
     *   window.odMorph('torus', 3);
     */
    function morphTo(shapeName, duration) {
      var gen = shapes[shapeName];
      if (!gen) return;

      // Snapshot current positions as morph origin
      var curPos = geo.attributes.position.array;
      morphFrom.set(curPos);

      // Generate target positions
      for (var i = 0; i < N; i++) {
        var p = gen(i, N, SPHERE_RADIUS);
        targetPos[i * 3]     = p[0];
        targetPos[i * 3 + 1] = p[1];
        targetPos[i * 3 + 2] = p[2];
      }

      morphDur   = duration || 3;
      morphStart = performance.now();
      morphT     = 0;
    }

    // ── END MORPH SYSTEM ──────────────────────────────────────────────────

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('aColor',   new THREE.BufferAttribute(colArr, 3));

    // ── Shaders ───────────────────────────────────────────────────────────
    // Vertex: perspective-correct point size + per-particle brightness pulse
    // Fragment: radial soft glow with bright core, additive blending
    var vertexShader = [
      'uniform float uTime;',
      'uniform float uSize;',
      'attribute vec3 aColor;',
      'varying vec3 vColor;',
      '',
      'void main() {',
      '  // Animate brightness: slow sine keyed to position prevents lock-step flash',
      '  float pulse = 0.8 + 0.2 * sin(uTime * 0.5 + position.x * 0.008 + position.z * 0.006);',
      '  vColor = aColor * pulse;',
      '',
      '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
      '  // Perspective scale: particles farther away appear smaller',
      '  gl_PointSize = uSize * (800.0 / -mvPosition.z);',
      '  gl_Position  = projectionMatrix * mvPosition;',
      '}'
    ].join('\n');

    var fragmentShader = [
      'varying vec3 vColor;',
      '',
      'void main() {',
      '  // Signed distance from point centre (gl_PointCoord is 0–1)',
      '  vec2  uv = gl_PointCoord - 0.5;',
      '  float d  = length(uv);',
      '  if (d > 0.5) discard;          // clip to circle',
      '',
      '  // Outer glow: smooth fade from edge to ~10% radius',
      '  float alpha = smoothstep(0.5, 0.05, d);',
      '  // Inner spark: extra brightness in the core',
      '  float core  = smoothstep(0.2, 0.0, d) * 0.55;',
      '',
      '  gl_FragColor = vec4(vColor + core, alpha * 0.78);',
      '}'
    ].join('\n');

    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0.0 },
        uSize: { value: SIZE * dpr }  // scale for device pixel ratio
      },
      vertexShader:   vertexShader,
      fragmentShader: fragmentShader,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending  // glowing light-on-dark look
    });

    var points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Mouse parallax ────────────────────────────────────────────────────
    var targOffX = 0, targOffY = 0;
    var currOffX = 0, currOffY = 0;

    function onMouseMove(e) {
      // Map pointer position to ±MOUSE_STRENGTH radians offset
      targOffY = (e.clientX / window.innerWidth  - 0.5) * MOUSE_STRENGTH * 2;
      targOffX = (e.clientY / window.innerHeight - 0.5) * MOUSE_STRENGTH * 2;
    }
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // ── Resize ────────────────────────────────────────────────────────────
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onResize, { passive: true });

    // ── Animation loop ────────────────────────────────────────────────────
    var baseRotX = 0, baseRotY = 0;
    var rafId         = null;
    var active        = true;
    var lastFrameTime = performance.now();

    function frame(now) {
      rafId = requestAnimationFrame(frame);
      if (!now) now = performance.now();
      var delta = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;

      // Time-based uniform drives the per-particle pulse in the vert shader
      mat.uniforms.uTime.value += delta;

      // Continuous slow rotation of the whole cloud
      baseRotX += SPEED_ROT_X;
      baseRotY += SPEED_ROT_Y;

      // Exponential lerp toward mouse parallax target (feels physical)
      currOffX += (targOffX - currOffX) * 0.04;
      currOffY += (targOffY - currOffY) * 0.04;

      points.rotation.x = baseRotX + currOffX;
      points.rotation.y = baseRotY + currOffY;

      // ── Morph interpolation (no-op when morphT >= 1) ────────────────────
      if (morphT < 1) {
        morphT = Math.min((performance.now() - morphStart) / (morphDur * 1000), 1);
        // Ease-in-out cubic for organic feel
        var t = morphT < 0.5
          ? 4 * morphT * morphT * morphT
          : 1 - Math.pow(-2 * morphT + 2, 3) / 2;

        var pos = geo.attributes.position.array;
        for (var mi = 0, len = pos.length; mi < len; mi++) {
          pos[mi] = morphFrom[mi] + (targetPos[mi] - morphFrom[mi]) * t;
        }
        geo.attributes.position.needsUpdate = true;
      }
      // ── End morph interpolation ─────────────────────────────────────────

      renderer.render(scene, camera);
    }

    // Pause the RAF loop while the tab is hidden — saves battery/GPU
    function onVisibility() {
      if (document.hidden) {
        active = false;
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!active) {
        active = true;
        frame();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    frame();

    // ── Expose morph API (shelved — available but not auto-triggered) ────
    // Usage:  window.odMorph('torus', 3)   → morph to torus over 3s
    //         window.odMorph('sphere', 2)  → morph back to sphere over 2s
    //         window.odMorph('helix', 4)   → DNA double helix over 4s
    //         window.odMorph('scatter', 2) → explode outward over 2s
    // Returns available shape names when called with no args.
    window.odMorph = function (shapeName, duration) {
      if (!shapeName) return Object.keys(shapes);
      morphTo(shapeName, duration || 3);
    };

    // ── Cleanup API ───────────────────────────────────────────────────────
    function destroy() {
      if (!renderer) return;                          // guard: init never completed
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      scene  = null;
      camera = null;
    }
    window.odDestroy = destroy;
  }

  // Boot after DOM is ready (Three.js CDN is loaded synchronously before us)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());

// ── GLOBAL HELP BUTTON ────────────────────────────────────────
// Injected on every page that loads particle-bg.js (all drill pages).
// Skipped on red-protocol.html (already on the page).
(function injectHelp() {
  var SKIP = ['red-protocol.html'];
  var path = window.location.pathname;
  for (var i = 0; i < SKIP.length; i++) {
    if (path.indexOf(SKIP[i]) > -1) return;
  }

  function inject() {
    if (document.getElementById('od-help-btn')) return;
    var btn = document.createElement('a');
    btn.id = 'od-help-btn';
    btn.href = '/red-protocol.html';
    btn.textContent = 'HELP';
    btn.setAttribute('aria-label', 'Crisis help');
    var s = btn.style;
    s.position = 'fixed';
    s.bottom = '72px';
    s.right = '16px';
    s.zIndex = '9999';
    s.minWidth = '44px';
    s.minHeight = '44px';
    s.padding = '0 10px';
    s.display = 'flex';
    s.alignItems = 'center';
    s.justifyContent = 'center';
    s.background = '#c0392b';
    s.color = '#fff';
    s.fontSize = '9px';
    s.fontFamily = "'Courier New', monospace";
    s.fontWeight = '900';
    s.letterSpacing = '2px';
    s.borderRadius = '6px';
    s.textDecoration = 'none';
    s.boxShadow = '0 2px 12px rgba(192,57,43,.5)';
    s.webkitTapHighlightColor = 'transparent';
    document.body.appendChild(btn);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
}());
