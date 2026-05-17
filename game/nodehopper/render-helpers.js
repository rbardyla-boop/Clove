// Node Hopper — Render helpers (Three.js neon visuals, no postprocessing)
(() => {
  // Build a glowing mesh: a bright core + a larger translucent additive halo.
  function glowMesh(geom, color, opts = {}) {
    const {
      coreOpacity = 1, haloOpacity = 0.35,
      haloScale = 1.7, depthTest = false,
    } = opts;
    const group = new THREE.Group();
    const haloMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: haloOpacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest,
    });
    const halo = new THREE.Mesh(geom, haloMat);
    halo.scale.set(haloScale, haloScale, 1);
    halo.userData.isHalo = true;
    const coreMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: coreOpacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest,
    });
    const core = new THREE.Mesh(geom, coreMat);
    group.add(halo);
    group.add(core);
    group.userData.core = core;
    group.userData.halo = halo;
    group.userData.coreMat = coreMat;
    group.userData.haloMat = haloMat;
    return group;
  }

  function ringGeom(rInner, rOuter, segments = 32) {
    return new THREE.RingGeometry(rInner, rOuter, segments);
  }

  function rectGeom(w, h) {
    return new THREE.PlaneGeometry(w, h);
  }

  function triGeom(w, h) {
    const s = new THREE.Shape();
    s.moveTo(0, h / 2);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(-w / 2, -h / 2);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }

  function diamondGeom(w, h) {
    const s = new THREE.Shape();
    s.moveTo(0, h / 2);
    s.lineTo(w / 2, 0);
    s.lineTo(0, -h / 2);
    s.lineTo(-w / 2, 0);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }

  // Hollow rectangular outline (line segments as thin triangles)
  function rectOutline(w, h, thickness = 0.08) {
    const t = thickness;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, -h / 2);
    shape.lineTo(w / 2, -h / 2);
    shape.lineTo(w / 2, h / 2);
    shape.lineTo(-w / 2, h / 2);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-w / 2 + t, -h / 2 + t);
    hole.lineTo(w / 2 - t, -h / 2 + t);
    hole.lineTo(w / 2 - t, h / 2 - t);
    hole.lineTo(-w / 2 + t, h / 2 - t);
    hole.closePath();
    shape.holes.push(hole);
    return new THREE.ShapeGeometry(shape);
  }

  window.NHRender = {
    glowMesh, rectGeom, triGeom, diamondGeom, ringGeom, rectOutline,
  };
})();
