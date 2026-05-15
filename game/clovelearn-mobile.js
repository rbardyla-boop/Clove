// ─── CloveLearn Mobile Layer ──────────────────────────────────────────────────
// Loaded after main.js. Portrait and landscape mobile support.
// Rotate overlay removed — portrait is a first-class layout.
// ─────────────────────────────────────────────────────────────────────────────

// ── Orientation detection ──────────────────────────────────────────────────────
function isMobilePortrait() {
    return window.innerWidth <= 767 && window.innerHeight > window.innerWidth;
}
function isMobileLandscape() {
    return window.innerHeight <= 500 && window.innerWidth > window.innerHeight;
}
function isAnyMobile() {
    return isMobilePortrait() || isMobileLandscape();
}

// ── Top-down 2D camera for mobile (portrait and landscape) ────────────────────
function applyMobileView() {
    if (!isAnyMobile()) return;
    controls.enableRotate  = false;
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = 0;
    camera.up.set(0, 0, -1);
    // Portrait needs the camera higher to see the wider-than-tall map
    var camHeight = isMobilePortrait() ? 260 : 200;
    camera.position.set(0, camHeight, 0);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}
applyMobileView();
window.addEventListener('resize', applyMobileView);

// Attempt hardware orientation lock (works in Chrome on Android when fullscreen/PWA)
function tryLockLandscape() {
    if (screen.orientation && screen.orientation.lock) {
        // Only lock if user is already in landscape — do not force portrait players out
        if (window.innerWidth > window.innerHeight) {
            screen.orientation.lock('landscape').catch(function () {});
        }
    }
}
tryLockLandscape();
document.addEventListener('click', tryLockLandscape, { once: true });

// ── Portrait sidebar drawer ────────────────────────────────────────────────────
(function setupPortraitDrawer() {
    var sidebar  = document.getElementById('sidebar');
    var backdrop = document.createElement('div');
    backdrop.id  = 'mobile-sidebar-backdrop';
    document.body.appendChild(backdrop);

    var closeBtn = document.createElement('button');
    closeBtn.id  = 'sidebar-close-btn';
    closeBtn.setAttribute('aria-label', 'Close upgrade panel');
    closeBtn.textContent = '✕';
    sidebar.prepend(closeBtn);

    var deployBtn = document.createElement('button');
    deployBtn.id  = 'mobile-deploy-btn';
    deployBtn.setAttribute('aria-label', 'Open upgrade panel');
    deployBtn.innerHTML = 'DEPLOY <span aria-hidden="true">▲</span>';
    document.body.appendChild(deployBtn);

    function openSidebar() {
        sidebar.classList.add('mobile-open');
        backdrop.classList.add('active');
        // Move focus into sidebar for accessibility
        var firstBtn = sidebar.querySelector('button:not(#sidebar-close-btn)');
        if (firstBtn) firstBtn.focus();
    }
    function closeSidebar() {
        sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('active');
        deployBtn.focus();
    }

    deployBtn.addEventListener('click', openSidebar);
    closeBtn.addEventListener('click',  closeSidebar);
    backdrop.addEventListener('click',  closeSidebar);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && sidebar.classList.contains('mobile-open')) {
            closeSidebar();
        }
    });

    // Swipe-right to close sidebar on portrait
    var _swipeStartX = null;
    sidebar.addEventListener('touchstart', function (e) {
        _swipeStartX = e.touches[0].clientX;
    }, { passive: true });
    sidebar.addEventListener('touchend', function (e) {
        if (_swipeStartX === null) return;
        var dx = e.changedTouches[0].clientX - _swipeStartX;
        _swipeStartX = null;
        if (dx > 60) closeSidebar(); // right swipe = close
    }, { passive: true });
}());

// ── Touch tap → region selection ──────────────────────────────────────────────
// OrbitControls intercepts touch events, preventing 'click' from firing on mobile.
// Track touchstart; if touchend is within 12px it is a tap — fire the raycaster.
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
    if (Math.sqrt(dx * dx + dy * dy) > 12) return; // drag, not tap

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
