/**
 * Post-processing: a real selective bloom pass so neon emissives genuinely glow (the `lighting.bloom`
 * toggle drives this, not just tone-mapping exposure). One render path through EffectComposer:
 * RenderPass → UnrealBloomPass (gated by the bloom flag) → OutputPass (tone mapping + sRGB).
 * Threshold keeps bloom on bright emissive surfaces only, so the hall stays readable and cheap.
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.4, 0.85); // strength, radius, threshold
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  setSize(width, height) {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  setBloom(enabled, strength = 0.7) {
    this.bloom.enabled = enabled;
    this.bloom.strength = strength;
  }

  render() {
    this.composer.render();
  }
}
