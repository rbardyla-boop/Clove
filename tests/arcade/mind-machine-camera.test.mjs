import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../../game/theincrediblemindmachine/index.html', import.meta.url), 'utf8');

const cameraFunctionSource = source.match(/function cameraFitDistance\([\s\S]*?\n}\n/)[0];
const cameraContext = { CAMERA_SAFE_X: 18, Math };
vm.runInNewContext(`const CAMERA_FOV = 45; ${cameraFunctionSource}; this.cameraFitDistance = cameraFitDistance;`, cameraContext);
const fitDistance = cameraContext.cameraFitDistance;

const world = { minX: -11.5, maxX: 11.5, minY: -7.5, maxY: 7.5 };
const viewports = [
  { name: 'small portrait', width: 360, height: 800, safeTop: 170, safeBottom: 80 },
  { name: 'large portrait', width: 390, height: 844, safeTop: 170, safeBottom: 80 },
  { name: 'landscape', width: 844, height: 390, safeTop: 100, safeBottom: 70 },
  { name: 'desktop', width: 1440, height: 900, safeTop: 100, safeBottom: 100 },
];

test('camera fit contract is present and uses a perspective camera', () => {
  assert.equal(typeof fitDistance, 'function');
  assert.match(source, /new THREE\.PerspectiveCamera\(CAMERA_FOV/);
  assert.match(source, /fitCameraToLevel\(\);/);
  assert.match(source, /window\.addEventListener\('resize', resizeRenderer\)/);
  assert.match(source, /targetY = centerY - safeCenterNdcY \* distance/);
});

test('every supported viewport has finite room for the complete playable bounds', () => {
  for (const viewport of viewports) {
    const distance = fitDistance(world, viewport);
    assert.ok(Number.isFinite(distance) && distance > 0, viewport.name);
    const visibleHalfHeight = distance * Math.tan(22.5 * Math.PI / 180);
    const visibleHeight = visibleHalfHeight * 2 * (viewport.height - viewport.safeTop - viewport.safeBottom) / viewport.height;
    const visibleWidth = visibleHalfHeight * 2 * viewport.width / viewport.height * (viewport.width - 36) / viewport.width;
    assert.ok(visibleHeight >= world.maxY - world.minY, `${viewport.name} vertical fit`);
    assert.ok(visibleWidth >= world.maxX - world.minX, `${viewport.name} horizontal fit`);
  }
});

test('camera bounds include placement limits and rotated wall extents', () => {
  assert.match(source, /const bounds = \{ minX: -10, maxX: 10, minY: -7, maxY: 7 \}/);
  assert.match(source, /Math\.abs\(Math\.cos\(w\.r \|\| 0\)\)/);
  assert.match(source, /Math\.abs\(Math\.sin\(w\.r \|\| 0\)\)/);
});

test('portrait camera fit preserves foreground visibility instead of increasing fog',()=>{
  // Execute the actual integration against a camera double: no copied fit formula.
  const fit=source.match(/function fitCameraToLevel\([\s\S]*?\n}\n/)[0];
  for(const viewport of viewports) {
    const camera={position:{set(x,y,z){this.x=x;this.y=y;this.z=z;}},lookAt(){},updateProjectionMatrix(){}};
    const fog={density:.025};
    const context={camera,fog,renderer:{domElement:{clientWidth:viewport.width,clientHeight:viewport.height}},LEVELS:[{}],STATE:{levelIndex:0},Math,CAMERA_FOV:45,cameraSafeMargins:()=>viewport,levelCameraBounds:()=>world,cameraFitDistance:fitDistance};
    vm.runInNewContext(`${fit}; fitCameraToLevel();`,context);
    const transmission=Math.exp(-Math.pow(camera.position.z*fog.density,2));
    assert.ok(transmission>.8,`${viewport.name}: foreground is not fogged out`);
    assert.ok(camera.far>camera.position.z+10,`${viewport.name}: board is inside clipping range`);
  }
});
