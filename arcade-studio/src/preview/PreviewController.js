/**
 * Preview controller — owns camera-mode transitions and the player-scale avatar. Bridges the editor's
 * camera mode ('orbit' | 'player') to the CameraRig and shows/hides the avatar accordingly. Pulls the
 * building's colliders, world bounds, and spawn so the walkthrough is collision-aware and starts at the
 * entrance.
 */

import { PreviewCharacter } from './PreviewCharacter.js';

export class PreviewController {
  constructor({ rig, helpersGroup }) {
    this.rig = rig;
    this.character = new PreviewCharacter();
    helpersGroup.add(this.character.mesh);
    this.mode = 'orbit';
  }

  /** Re-sync colliders/bounds/spawn after the building rebuilds. */
  refresh(building) {
    this.rig.setColliders(building.getColliders());
    this.rig.setBounds(building.getBounds());
    const sp = building.getSpawn();
    this.rig.setSpawn(sp.x, sp.z, sp.yaw);
    this.character.setPosition(sp.x, sp.z, sp.yaw);
  }

  setMode(mode) {
    this.mode = mode;
    this.rig.setMode(mode);
    this.character.setVisible(mode === 'orbit');
  }

  update(dt) {
    this.rig.update(dt);
  }
}
