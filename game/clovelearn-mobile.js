// ─── CloveLearn Mobile Layer ──────────────────────────────────────────────────
// Loaded after main.js. Adds mobile 2D lock + touch support + rotate overlay.
// To update the game: replace main.js and style.css freely. This file is stable.
// ─────────────────────────────────────────────────────────────────────────────

// Inject rotate-to-landscape overlay (CSS in clovelearn-mobile.css shows/hides it)
(function () {
    var el = document.createElement('div');
    el.id = 'rotate-overlay';
    el.innerHTML =
        '<svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="14" y="4" width="36" height="56" rx="6" stroke="#2ec4b6" stroke-width="2.5" fill="none"/>' +
            '<circle cx="32" cy="52" r="2.5" fill="#2ec4b6" opacity="0.5"/>' +
            '<path d="M44 28 L54 22 L54 34 Z" fill="#2ec4b6" opacity="0.7"/>' +
            '<path d="M44 28 Q32 14 20 28" stroke="#2ec4b6" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '</svg>' +
        '<p>ROTATE DEVICE</p>' +
        '<span>This game requires landscape orientation</span>';
    document.body.prepend(el);
}());

// Attempt hardware orientation lock (works in Chrome on Android when fullscreen/PWA)
function tryLockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {});
    }
}
tryLockLandscape();
document.addEventListener('click', tryLockLandscape, { once: true });

// ── 2D top-down lock for mobile landscape ─────────────────────────────────────
function isMobileLandscape() {
    return window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
}

function applyMobileView() {
    if (!isMobileLandscape()) return;
    controls.enableRotate   = false;
    controls.minPolarAngle  = 0;
    controls.maxPolarAngle  = 0;
    camera.up.set(0, 0, -1);          // north faces up on the flat map
    camera.position.set(0, 200, 0);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}
applyMobileView();
window.addEventListener('resize', applyMobileView);

// ── Touch tap → silo selection ────────────────────────────────────────────────
// OrbitControls intercepts touch events, preventing 'click' from firing on mobile.
// Track touchstart; if touchend is within 10px it's a tap — fire the raycaster.
var _touchStart = null;

renderer.domElement.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
        _touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: true });

renderer.domElement.addEventListener('touchend', function (e) {
    if (!_touchStart || e.changedTouches.length !== 1) { _touchStart = null; return; }
    var t  = e.changedTouches[0];
    var dx = t.clientX - _touchStart.x;
    var dy = t.clientY - _touchStart.y;
    _touchStart = null;
    if (Math.sqrt(dx * dx + dy * dy) > 10) return; // drag, not tap

    if (gameOver || !selectedArchetype) return;

    mouse.x =  (t.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    var hits = raycaster.intersectObjects(regionMeshes);

    if (selectedRegion) {
        var prev = regionMeshes.find(function (m) { return m.userData.region === selectedRegion; });
        if (prev) prev.material.emissiveIntensity = 0;
    }

    if (hits.length > 0 && !hits[0].object.userData.region.collapsed) {
        selectedRegion = hits[0].object.userData.region;
        hits[0].object.material.emissive.set(0x3a7ad4);
        hits[0].object.material.emissiveIntensity = 0.4;
        showRegionPopup(selectedRegion);
        advanceTutorial(1);
    } else {
        selectedRegion = null;
        document.getElementById('region-popup').style.display = 'none';
    }
    document.getElementById('selected-label').textContent = selectedRegion ? '▶ ' + selectedRegion.name : '';
    buildUpgradePanel();
}, { passive: true });
