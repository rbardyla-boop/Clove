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

    window.addEventListener('mousemove', function (e) {
      // Map pointer position to ±MOUSE_STRENGTH radians offset
      targOffY = (e.clientX / window.innerWidth  - 0.5) * MOUSE_STRENGTH * 2;
      targOffX = (e.clientY / window.innerHeight - 0.5) * MOUSE_STRENGTH * 2;
    }, { passive: true });

    // ── Resize ────────────────────────────────────────────────────────────
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

    // ── Animation loop ────────────────────────────────────────────────────
    var baseRotX = 0, baseRotY = 0;
    var rafId    = null;
    var active   = true;

    function frame() {
      rafId = requestAnimationFrame(frame);

      // Time-based uniform drives the per-particle pulse in the vert shader
      mat.uniforms.uTime.value += 0.016;

      // Continuous slow rotation of the whole cloud
      baseRotX += SPEED_ROT_X;
      baseRotY += SPEED_ROT_Y;

      // Exponential lerp toward mouse parallax target (feels physical)
      currOffX += (targOffX - currOffX) * 0.04;
      currOffY += (targOffY - currOffY) * 0.04;

      points.rotation.x = baseRotX + currOffX;
      points.rotation.y = baseRotY + currOffY;

      renderer.render(scene, camera);
    }

    // Pause the RAF loop while the tab is hidden — saves battery/GPU
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        active = false;
        if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      } else if (!active) {
        active = true;
        frame();
      }
    });

    frame();
  }

  // Boot after DOM is ready (Three.js CDN is loaded synchronously before us)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
