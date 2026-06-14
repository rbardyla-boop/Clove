/**
 * A simple capsule avatar at player scale (~1.7m) shown at the spawn point in orbit mode so the
 * creator can read the arcade's human scale. Hidden in first-person player mode (you ARE the avatar).
 */

import * as THREE from 'three';

export class PreviewCharacter {
  constructor() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x36f5a2, emissive: 0x0d3d2a, emissiveIntensity: 0.6, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 6, 12), mat);
    body.position.y = 0.85;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), mat);
    head.position.y = 1.55;
    head.castShadow = true;

    this.mesh = new THREE.Group();
    this.mesh.name = 'preview-character';
    this.mesh.add(body, head);
  }

  setPosition(x, z, yaw = 0) {
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = yaw;
  }

  setVisible(v) {
    this.mesh.visible = v;
  }
}
