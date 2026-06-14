/**
 * ArcadeBuilding — the integrator. Turns a validated layout MODEL into a scene graph: floor, walls,
 * entrances, instanced props, signs, cabinets, and zone/accent lights. Tracks per-element identity for
 * click-selection, computes colliders + world bounds + a player spawn, and animates cabinet attract.
 *
 * Repeated props of the same type are drawn as a single InstancedMesh (perf + fewer draw calls).
 */

import * as THREE from 'three';
import { CELL, cellToWorld, worldBounds, rotationToRadians } from './grid.js';
import { resolveTheme } from './ArcadeThemes.js';
import { createFloor } from './ArcadeFloor.js';
import { createWall, createEntrance } from './ArcadeWall.js';
import { propGeometry, propMaterial } from './ArcadePropLibrary.js';
import { createZone } from './ArcadeZone.js';
import { createAccentLights } from './ArcadeLighting.js';
import { Cabinet } from '../cabinets/Cabinet.js';
import { clearGroup, disposeObject } from '../core/scene.js';
import { resolvePalette } from '../validation/tokens.js';
import { intToHex } from '../utils/colors.js';

function signTexture(text, pal) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = intToHex(pal.base);
  ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = intToHex(pal.accent);
  ctx.fillRect(0, 0, 512, 12);
  ctx.fillRect(0, 148, 512, 12);
  const label = (text || '').toUpperCase().slice(0, 16);
  if (label) {
    ctx.fillStyle = '#f4faff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 256, 86);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function aabbFromBox3(b) {
  return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
}

export class ArcadeBuilding {
  constructor(groups) {
    this.groups = groups; // { environment, props, signs, cabinets, lights }
    this.cabinets = [];
    this.colliders = [];
    this.selectables = [];
    this.model = null;
    this.theme = null;
    this.bounds = worldBounds(16, 12);
    this.spawn = { x: 0, z: 8, yaw: 0 };
    this.motionScale = 1;
  }

  build(model) {
    this.model = model;
    const theme = resolveTheme(model.theme);
    this.theme = theme;
    const cols = model.grid.cols;
    const rows = model.grid.rows;

    // reset
    for (const cab of this.cabinets) cab.dispose();
    this.cabinets = [];
    this.colliders = [];
    this.selectables = [];
    clearGroup(this.groups.environment);
    clearGroup(this.groups.props);
    clearGroup(this.groups.signs);
    clearGroup(this.groups.cabinets);
    clearGroup(this.groups.lights);

    // floor
    this.groups.environment.add(createFloor(model.floor.material, theme, cols, rows));

    // walls
    for (const wall of model.walls || []) {
      const mesh = createWall(wall, cols, rows);
      this.groups.environment.add(mesh);
      this.colliders.push(aabbFromBox3(new THREE.Box3().setFromObject(mesh)));
    }

    // entrances
    (model.entrances || []).forEach((entrance, index) => {
      const obj = createEntrance(entrance, cols, rows);
      if (!obj) return;
      obj.userData.pick = { kind: 'entrances', index };
      this.groups.environment.add(obj);
      this.selectables.push(obj);
    });

    // props — instanced by type
    this._buildProps(model, cols, rows);

    // signs
    (model.signs || []).forEach((sign, index) => {
      const obj = this._buildSign(sign, cols, rows);
      obj.userData.pick = { kind: 'signs', index };
      this.groups.signs.add(obj);
      this.selectables.push(obj);
    });

    // cabinets
    (model.cabinets || []).forEach((placement, index) => {
      const cab = new Cabinet(placement.cabinet);
      const pos = cellToWorld(placement.gx, placement.gy, cols, rows);
      cab.group.position.set(pos.x, 0, pos.z);
      cab.group.rotation.y = rotationToRadians(placement.rotation);
      cab.group.userData.pick = { kind: 'cabinets', index };
      cab.setMotionScale(this.motionScale);
      this.groups.cabinets.add(cab.group);
      this.cabinets.push(cab);
      this.selectables.push(cab.group);
      this.colliders.push(aabbFromBox3(new THREE.Box3().setFromObject(cab.group)));
    });

    // zones + accent lights
    for (const zone of model.zones || []) this.groups.lights.add(createZone(zone, theme, cols, rows));
    this.bounds = worldBounds(cols, rows);
    this.groups.lights.add(createAccentLights(model.lighting, this.bounds));

    this._computeSpawn(model, cols, rows);
    return this;
  }

  _buildProps(model, cols, rows) {
    const byType = new Map();
    (model.props || []).forEach((p, index) => {
      if (!byType.has(p.type)) byType.set(p.type, []);
      byType.get(p.type).push({ p, index });
    });
    const dummy = new THREE.Object3D();
    for (const [type, list] of byType) {
      const geo = propGeometry(type);
      geo.computeBoundingBox();
      const inst = new THREE.InstancedMesh(geo, propMaterial(type), list.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.name = `props:${type}`;
      const instanceMap = [];
      list.forEach(({ p, index }, i) => {
        const pos = cellToWorld(p.gx, p.gy, cols, rows);
        dummy.position.set(pos.x, 0, pos.z);
        dummy.rotation.set(0, rotationToRadians(p.rotation), 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        instanceMap[i] = index;
        // collider from bounding box translated to position (rotation-agnostic AABB)
        const bb = geo.boundingBox;
        this.colliders.push({
          minX: pos.x + bb.min.x, maxX: pos.x + bb.max.x,
          minZ: pos.z + bb.min.z, maxZ: pos.z + bb.max.z,
        });
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.userData.pick = { kind: 'props', instanced: true };
      inst.userData.instanceMap = instanceMap;
      this.groups.props.add(inst);
      this.selectables.push(inst);
    }
  }

  _buildSign(sign, cols, rows) {
    const pal = resolvePalette(sign.palette);
    const tex = signTexture(sign.text, pal);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x14161c, emissive: pal.accent, emissiveIntensity: 0.9,
      map: tex || null, emissiveMap: tex || null, roughness: 0.4, side: THREE.DoubleSide,
    });
    const w = sign.style === 'billboard' ? 4 : sign.style === 'blade' ? 1.2 : 3;
    const h = sign.style === 'blade' ? 2.4 : 1.0;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const pos = cellToWorld(sign.gx, sign.gy, cols, rows);
    const placement = sign.placement;
    let x = pos.x;
    let y = 3.0;
    let z = pos.z;
    let ry = 0;
    if (placement === 'apex') { y = 3.2; }
    else if (placement === 'entrance') { y = 2.6; }
    else if (placement === 'wall-left') { ry = Math.PI / 2; x = this.bounds?.minX ?? pos.x; y = 2.4; }
    else if (placement === 'wall-right') { ry = -Math.PI / 2; x = this.bounds?.maxX ?? pos.x; y = 2.4; }
    else if (placement === 'ceiling') { y = 3.6; }
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    mesh.name = `sign:${sign.style}`;
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }

  _computeSpawn(model, cols, rows) {
    const ent = (model.entrances || [])[0];
    if (ent) {
      const pos = cellToWorld(ent.gx, ent.gy, cols, rows);
      const dz = ent.facing === 'north' ? -1 : ent.facing === 'south' ? 1 : 0;
      const dx = ent.facing === 'east' ? 1 : ent.facing === 'west' ? -1 : 0;
      this.spawn = {
        // step two cells inward so the entrance is behind the player, and face INTO the hall
        x: pos.x + dx * CELL * 2,
        z: pos.z + dz * CELL * 2,
        yaw: Math.atan2(-dx, -dz),
      };
    } else {
      this.spawn = { x: 0, z: (rows * CELL) / 2 - CELL, yaw: 0 };
    }
  }

  setMotionScale(scale) {
    this.motionScale = scale;
    for (const cab of this.cabinets) cab.setMotionScale(scale);
  }

  update(dt) {
    for (const cab of this.cabinets) cab.update(dt);
  }

  /** Resolve a raycast intersection to a { kind, index } selection (or null). */
  resolvePick(intersection) {
    let obj = intersection.object;
    while (obj) {
      if (obj.userData && obj.userData.pick) {
        const pick = obj.userData.pick;
        if (pick.instanced) {
          const idx = obj.userData.instanceMap?.[intersection.instanceId];
          return idx == null ? null : { kind: pick.kind, index: idx };
        }
        return { kind: pick.kind, index: pick.index };
      }
      obj = obj.parent;
    }
    return null;
  }

  getColliders() {
    return this.colliders;
  }
  getBounds() {
    return this.bounds;
  }
  getSpawn() {
    return this.spawn;
  }
  getSelectables() {
    return this.selectables;
  }

  getStats() {
    return {
      cabinets: this.cabinets.length,
      props: (this.model?.props || []).length,
      signs: (this.model?.signs || []).length,
      walls: (this.model?.walls || []).length,
      zones: (this.model?.zones || []).length,
      entrances: (this.model?.entrances || []).length,
    };
  }

  /** World-space center of a selected element (for framing the camera / selection outline). */
  worldCenterOf(kind, index) {
    if (!this.model) return null;
    const cols = this.model.grid.cols;
    const rows = this.model.grid.rows;
    const el = (this.model[kind] || [])[index];
    if (!el) return null;
    const pos = cellToWorld(el.gx, el.gy, cols, rows);
    return new THREE.Vector3(pos.x, 1, pos.z);
  }
}
