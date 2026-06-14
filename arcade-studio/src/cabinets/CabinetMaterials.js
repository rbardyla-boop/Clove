/**
 * Cabinet materials: body, trim, emissive screen (with procedural scanline + attract canvas texture),
 * marquee (with procedural text), and control-panel. Driven entirely by closed tokens resolved from
 * the cabinet config. Procedural CanvasTextures are generated at runtime (browser) — no external
 * image assets are ever fetched.
 */

import * as THREE from 'three';
import { resolvePalette, GLOW_INTENSITY, SCANLINE_OPACITY } from '../validation/tokens.js';
import { intToHex, scaleColor, luminance } from '../utils/colors.js';

const TRIM_PBR = {
  chrome: { metalness: 1.0, roughness: 0.15, emissive: 0 },
  'matte-black': { metalness: 0.1, roughness: 0.9, emissive: 0 },
  woodgrain: { metalness: 0.0, roughness: 0.8, emissive: 0 },
  'neon-edge': { metalness: 0.4, roughness: 0.35, emissive: 1 },
  'brushed-steel': { metalness: 0.85, roughness: 0.4, emissive: 0 },
  'candy-gloss': { metalness: 0.3, roughness: 0.12, emissive: 0 },
};

function canvas2d(size) {
  const c = (typeof document !== 'undefined')
    ? document.createElement('canvas')
    : { getContext: () => null, width: size, height: size };
  c.width = size;
  c.height = size;
  return c;
}

/** Procedural screen texture: vertical gradient + scanlines + a simple attract pattern. */
function makeScreenTexture(screenHex, accentHex, scanline, attract) {
  const c = canvas2d(256);
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, intToHex(scaleColor(screenHex, 1.0)));
  grad.addColorStop(1, intToHex(scaleColor(screenHex, 0.45)));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // attract-mode placeholder pattern (static texture; animation is via emissive pulse in Cabinet.update)
  ctx.strokeStyle = intToHex(accentHex);
  ctx.globalAlpha = 0.5;
  if (attract === 'marquee-chase' || attract === 'screen-cycle') {
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(128, 128, 18 + i * 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (attract === 'demo-loop') {
    ctx.fillStyle = intToHex(accentHex);
    for (let i = 0; i < 24; i++) ctx.fillRect((i * 53) % 240, (i * 97) % 240, 10, 10);
  }
  ctx.globalAlpha = 1;

  // scanlines
  const op = SCANLINE_OPACITY[scanline] ?? 0;
  if (op > 0) {
    ctx.fillStyle = `rgba(0,0,0,${op})`;
    const stepY = scanline === 'heavy' ? 3 : scanline === 'coarse' ? 4 : 6;
    for (let y = 0; y < 256; y += stepY) ctx.fillRect(0, y, 256, Math.max(1, stepY / 2));
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Procedural marquee texture: accent panel with legible cabinet name. */
function makeMarqueeTexture(text, accentHex, baseHex) {
  const c = canvas2d(512);
  const ctx = c.getContext && c.getContext('2d');
  if (!ctx) return null;
  c.width = 512;
  c.height = 128;
  ctx.fillStyle = intToHex(scaleColor(baseHex, 0.6));
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = intToHex(accentHex);
  ctx.fillRect(0, 0, 512, 8);
  ctx.fillRect(0, 120, 512, 8);
  const label = (text || '').toUpperCase().slice(0, 18);
  if (label) {
    ctx.fillStyle = luminance(accentHex) > 0.4 ? '#0a0a0a' : '#f4faff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 68);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCabinetMaterials(cfg) {
  const pal = resolvePalette(cfg.palette);
  const trim = TRIM_PBR[cfg.trim_style] || TRIM_PBR.chrome;
  const glow = GLOW_INTENSITY[cfg.glow_style] ?? 1;

  const body = new THREE.MeshStandardMaterial({ color: pal.base, metalness: 0.2, roughness: 0.6 });
  const trimMat = new THREE.MeshStandardMaterial({
    color: cfg.trim_style === 'woodgrain' ? scaleColor(pal.base, 1.6) : pal.trim,
    metalness: trim.metalness,
    roughness: trim.roughness,
    emissive: trim.emissive ? pal.accent : 0x000000,
    emissiveIntensity: trim.emissive ? 0.6 * glow : 0,
  });

  const screenTex = makeScreenTexture(pal.screen, pal.accent, cfg.scanline, cfg.attract_mode);
  const screen = new THREE.MeshStandardMaterial({
    color: 0x111319,
    emissive: pal.screen,
    emissiveIntensity: Math.max(0.25, glow),
    emissiveMap: screenTex || null,
    map: screenTex || null,
    roughness: 0.3,
    metalness: 0.0,
  });

  const marqueeTex = cfg.marquee_style !== 'none' ? makeMarqueeTexture(cfg.marquee_text, pal.accent, pal.base) : null;
  const marquee = new THREE.MeshStandardMaterial({
    color: 0x202326,
    emissive: pal.accent,
    emissiveIntensity: 0.9 * Math.max(0.3, glow),
    emissiveMap: marqueeTex || null,
    map: marqueeTex || null,
    roughness: 0.4,
  });

  const panel = new THREE.MeshStandardMaterial({ color: scaleColor(pal.base, 1.3), metalness: 0.3, roughness: 0.5 });
  const control = new THREE.MeshStandardMaterial({ color: pal.accent, metalness: 0.5, roughness: 0.35, emissive: pal.accent, emissiveIntensity: 0.2 * glow });

  return {
    body,
    trim: trimMat,
    screen,
    marquee,
    panel,
    control,
    glowBase: glow,
    glowColor: pal.glow,
    accentColor: pal.accent,
    _baseScreenEmissive: Math.max(0.25, glow),
    _baseMarqueeEmissive: 0.9 * Math.max(0.3, glow),
  };
}
