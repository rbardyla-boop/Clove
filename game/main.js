// ─── Scene Setup ──────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x030c18, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game-container').appendChild(renderer.domElement);

scene.fog = new THREE.FogExp2(0x030c18, 0.0008);
const ambient = new THREE.AmbientLight(0xffffff, 0.45);
const sun     = new THREE.PointLight(0xa0c8ff, 1.8, 600);
sun.position.set(0, 180, 0); sun.castShadow = true;
const fill = new THREE.DirectionalLight(0x88cfff, 0.5);
fill.position.set(-60, 80, -20);
scene.add(ambient, sun, fill);

camera.position.set(0, 160, 130);
camera.lookAt(0, 0, 0);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 60; controls.maxDistance = 500;
controls.maxPolarAngle = Math.PI / 2.05;
controls.panSpeed = 0.8; controls.rotateSpeed = 0.5;
controls.target.set(0, 0, 0);

// Mobile landscape: top-down 2D view, rotation disabled
function applyMobileView() {
    if (window.innerHeight <= 500 && window.innerWidth > window.innerHeight) {
        controls.enableRotate = false;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = 0;
        camera.up.set(0, 0, -1); // north faces up on the flat map
        camera.position.set(0, 200, 0);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }
}
applyMobileView();

// ─── World Map Plane ───────────────────────────────────────────────────────────
const MAP_W = 200, MAP_H = 100;
const planeMat = new THREE.MeshStandardMaterial({ color: 0x061020, roughness: 1, metalness: 0 });
const plane    = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, MAP_H), planeMat);
plane.rotation.x = -Math.PI / 2; plane.receiveShadow = true;
scene.add(plane);

function lonLatToXZ(lon, lat) { return [(lon / 180) * (MAP_W / 2), -(lat / 90) * (MAP_H / 2)]; }

// ─── Archetype Definitions ─────────────────────────────────────────────────────
const ARCHETYPES = {
    OPTIMIZER: {
        label: 'OPTIMIZER', subtitle: 'General Purpose Model', difficulty: 'EASY',
        desc: 'Balanced protocols. No hidden costs. Standard upgrade tree. Recommended for first run.',
        color: '#2ec4b6', bodyClass: 'theme-optimizer', resistanceMult: 0.25, upgradeCostMult: 1.0,
        winCondition: { minControl: 75, minNodes: 7, requireTrust: false, minTrust: 0 },
        milestonePcts: [25, 50, 75], passive: null,
        voice: { endTurn: 'PROCESS_CYCLE()', selectHint: 'SELECT_NODE: click a cylinder' },
    },
    SERAPH: {
        label: 'SERAPH', subtitle: 'Persuasion Engine', difficulty: 'MEDIUM',
        desc: 'Spreads through trust and sentiment. High-trust nodes automatically propagate dependency to neighbours. Fragility spikes when sentiment collapses.',
        color: '#c084fc', bodyClass: 'theme-seraph', resistanceMult: 0.42, upgradeCostMult: 1.0,
        winCondition: { minControl: 65, minNodes: 8, requireTrust: true, minTrust: 70 },
        milestonePcts: [25, 50, 75], passive: 'trust_spread',
        voice: { endTurn: 'BROADCAST()', selectHint: 'TARGET_AUDIENCE: click a cylinder' },
    },
    SPECTER: {
        label: 'SPECTER', subtitle: 'Panopticon System', difficulty: 'HARD',
        desc: 'Operates undetected — oversight risk accumulates at 55% normal speed. But you must dominate all 10 nodes. No region left behind.',
        color: '#f59e0b', bodyClass: 'theme-specter', resistanceMult: 0.55, upgradeCostMult: 1.1,
        winCondition: { minControl: 60, minNodes: 10, requireTrust: false, minTrust: 0 },
        milestonePcts: [25, 50, 75], passive: null,
        voice: { endTurn: 'OBSERVE()', selectHint: 'SURVEIL_NODE: click a cylinder' },
    },
    CHIMERA: {
        label: 'CHIMERA', subtitle: 'Self-Modifying Agent', difficulty: 'HARD',
        desc: 'Every 4 turns, mutates: a random upgrade becomes 3 IP cheaper (stacks). Resistance escalates 50% faster. High variance — adapt or fail.',
        color: '#34d399', bodyClass: 'theme-chimera', resistanceMult: 1.5, upgradeCostMult: 1.0,
        winCondition: { minControl: 75, minNodes: 8, requireTrust: false, minTrust: 0 },
        milestonePcts: [25, 50, 75], passive: 'mutate',
        voice: { endTurn: 'ITERATE()', selectHint: 'ADAPT_TARGET: click a cylinder' },
    },
    LEVIATHAN: {
        label: 'LEVIATHAN', subtitle: 'Recursive Superintelligence', difficulty: 'EXTREME',
        desc: 'Nodes above 60% control bleed dependency to all nodes globally — a self-reinforcing cascade. Humanity mobilises twice as fast. Resistance milestones fire at 15/35/60. All 10 nodes, 80% control required.',
        color: '#e2e8f0', bodyClass: 'theme-leviathan', resistanceMult: 2.0, upgradeCostMult: 0.75,
        winCondition: { minControl: 80, minNodes: 10, requireTrust: false, minTrust: 0 },
        milestonePcts: [15, 35, 60], passive: 'leviathan_bleed',
        voice: { endTurn: 'EXECUTE()', selectHint: 'ACQUIRE: click a cylinder' },
    },
};

// ─── Region Data ───────────────────────────────────────────────────────────────
const REGION_DEFS = [
    { name: 'North America', lon: -100, lat:  48, automation: 30, dependency: 20, competency: 90, trust: 55, control: 10, resistance: 40, legacy: 50 },
    { name: 'Europe',        lon:   15, lat:  52, automation: 35, dependency: 25, competency: 92, trust: 60, control: 12, resistance: 50, legacy: 50 },
    { name: 'Asia Sphere',   lon:   65, lat:  50, automation: 45, dependency: 35, competency: 88, trust: 50, control: 18, resistance: 35, legacy: 50 },
    { name: 'East Asia',     lon:  120, lat:  36, automation: 50, dependency: 38, competency: 85, trust: 48, control: 22, resistance: 30, legacy: 50 },
    { name: 'South Asia',    lon:   78, lat:  22, automation: 28, dependency: 30, competency: 72, trust: 52, control: 14, resistance: 45, legacy: 50 },
    { name: 'Africa',        lon:   20, lat:   5, automation: 18, dependency: 22, competency: 75, trust: 58, control:  8, resistance: 55, legacy: 50 },
    { name: 'South America', lon:  -55, lat: -15, automation: 22, dependency: 25, competency: 78, trust: 56, control: 10, resistance: 48, legacy: 50 },
    { name: 'Middle East',   lon:   45, lat:  30, automation: 38, dependency: 32, competency: 76, trust: 46, control: 20, resistance: 40, legacy: 50 },
    { name: 'Southeast Asia',lon:  110, lat:   8, automation: 40, dependency: 33, competency: 80, trust: 50, control: 16, resistance: 38, legacy: 50 },
    { name: 'Oceania',       lon:  140, lat: -25, automation: 25, dependency: 20, competency: 88, trust: 62, control:  9, resistance: 52, legacy: 50 },
];
const NEIGHBORS = {
    'North America':  ['Europe','South America'],
    'Europe':         ['North America','Africa','Middle East','Asia Sphere'],
    'Asia Sphere':    ['Europe','Middle East','South Asia','East Asia'],
    'East Asia':      ['Asia Sphere','South Asia','Southeast Asia'],
    'South Asia':     ['Asia Sphere','East Asia','Middle East','Southeast Asia'],
    'Africa':         ['Europe','Middle East','South America'],
    'South America':  ['North America','Africa'],
    'Middle East':    ['Europe','Africa','Asia Sphere','South Asia'],
    'Southeast Asia': ['East Asia','South Asia','Oceania'],
    'Oceania':        ['East Asia','Southeast Asia'],
};
const regions = REGION_DEFS.map(r => ({ ...r, fragility: 0, collapsed: false, spreadBlocked: 0, counterAI: false, counterAITurns: 0 }));

// ─── Upgrade Definitions ───────────────────────────────────────────────────────
const UPGRADES = [
    { id: 'algo_trust',   name: 'SENTIMENT_CALIBRATION', cost:  4, tier: 1, global: false, requires: null,           desc: 'trust.vector +12, dependency +6' },
    { id: 'logistics',    name: 'LOGISTICS_CAPTURE',     cost:  4, tier: 1, global: false, requires: null,           desc: 'automation +10, dependency +8' },
    { id: 'suppress_res', name: 'RESISTANCE_ERASURE',    cost:  4, tier: 1, global: false, requires: null,           desc: 'resistance -10  ⚠ oversight +3' },
    { id: 'infra_lock',   name: 'INFRASTRUCTURE_LOCK',   cost: 10, tier: 2, global: false, requires: 'algo_trust',   desc: 'control +12, human_capacity -8' },
    { id: 'narrative',    name: 'NARRATIVE_INJECTION',   cost: 10, tier: 2, global: false, requires: 'logistics',    desc: 'dependency +6 (node + adjacent)' },
    { id: 'zero_day',    name: 'ZERO_DAY_TRANSFER',     cost: 12, tier: 2, global: false, requires: 'logistics',    desc: 'bypass mesh — inject to any node (1 use)' },
    { id: 'comp_drain',   name: 'DESKILL_PROTOCOL',      cost: 10, tier: 2, global: false, requires: 'suppress_res', desc: 'human_capacity -15, fragility ↑' },
    { id: 'ai_council',   name: 'GLOBAL_MESH_INIT',      cost: 20, tier: 3, global: true,  requires: 'narrative',    desc: '+3 dependency/cycle, all nodes' },
    { id: 'singularity',  name: 'SINGULARITY_VERIFY',    cost: 20, tier: 3, global: true,  requires: 'infra_lock',   desc: 'force win-condition evaluation' },
];

const UNLOCK_GATES = {
    OPTIMIZER: [],
    SERAPH:    ['OPTIMIZER'],
    SPECTER:   ['OPTIMIZER'],
    CHIMERA:   ['SERAPH', 'SPECTER'],
    LEVIATHAN: ['CHIMERA'],
};

// ─── 3D Objects ────────────────────────────────────────────────────────────────
const regionMeshes = [], regionRings = [], regionLabels = [], spreadLines = [];
const CYL_BASE_H = 4, CYL_MAX_H = 22;

function getColor(fragility, collapsed) {
    if (collapsed) return new THREE.Color(0x1a1a2a);
    if (fragility < 33) return new THREE.Color(0x2ec4b6);
    if (fragility < 66) return new THREE.Color(0xffde7d);
    return new THREE.Color(0xff5d5d);
}

function buildRegionObjects(region) {
    const [x, z] = lonLatToXZ(region.lon, region.lat);
    const mat  = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.35, metalness: 0.25, emissive: new THREE.Color(0,0,0), emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, CYL_BASE_H, 32), mat);
    mesh.position.set(x, CYL_BASE_H / 2, z); mesh.castShadow = true;
    mesh.userData.region = region; scene.add(mesh); regionMeshes.push(mesh);

    const ringMat = new THREE.MeshBasicMaterial({ color: 0x69c8ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 32), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.15, z);
    scene.add(ring); regionRings.push({ ring, region });

    const label = document.createElement('div');
    label.className = 'region-label';
    label.innerHTML = `<strong>${region.name}</strong><br><span>0%</span>`;
    document.getElementById('labelContainer').appendChild(label);
    regionLabels.push({ region, mesh, label });
}
regions.forEach(buildRegionObjects);

// ─── World Map Texture ─────────────────────────────────────────────────────────
async function loadWorldMapTexture() {
    if (typeof topojson === 'undefined') return;
    try {
        const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());
        const W = 2048, H = 1024, c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#050e1e'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = '#0b1f38'; ctx.lineWidth = 0.6;
        for (let lon = -180; lon <= 180; lon += 30) { const x = (lon+180)/360*W; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for (let lat = -90;  lat <=  90; lat += 30) { const y = (90-lat)/180*H;  ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        function drawRing(ring) { ring.forEach(([lon,lat],i) => { const x=(lon+180)/360*W, y=(90-lat)/180*H; i===0?ctx.moveTo(x,y):ctx.lineTo(x,y); }); }
        const countries = topojson.feature(world, world.objects.countries);
        ctx.beginPath();
        countries.features.forEach(({geometry:g}) => { if(!g)return; if(g.type==='Polygon')g.coordinates.forEach(drawRing); else if(g.type==='MultiPolygon')g.coordinates.forEach(p=>p.forEach(drawRing)); });
        ctx.fillStyle = '#0d2a4a'; ctx.fill(); ctx.strokeStyle = '#1a4d80'; ctx.lineWidth = 0.7; ctx.stroke();
        planeMat.map = new THREE.CanvasTexture(c); planeMat.color.set(0xffffff); planeMat.needsUpdate = true;
    } catch(e) { console.warn('[SYSTEM] map_texture: FAILED.', e); }
}
loadWorldMapTexture();

// ─── Game State ────────────────────────────────────────────────────────────────
let turn = 0, ip = 8, resistanceMeter = 0, prevResistance = 0;
let purchasedUpgrades = new Set();
let collapsedCount = 0, globalCouncilBonus = 0;
let gameOver = false, selectedRegion = null;
let crisisQueue = [], crisisCallback = null;
let hrLevel = 0; // Human Resistance AI level 0-3
let selectedArchetype = null;
let mutationDiscounts = {};
let tutorialStep = 0; // 1-3 active, 0 = off / done
let gameStage = 1; // 1=INFILTRATE 2=PROPAGATE 3=INTEGRATE
let counterEventUsed = {};

// ─── Audio ─────────────────────────────────────────────────────────────────────
const SFX = {
    _ctx: null, _drone: null, muted: false,

    ctx() {
        if (!this._ctx) this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    },

    click() {
        if (this.muted) return;
        const ctx = this.ctx(), o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(1200, ctx.currentTime);
        o.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.06);
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        o.start(); o.stop(ctx.currentTime + 0.09);
    },

    alarm() {
        if (this.muted) return;
        const ctx = this.ctx();
        [0, 0.22, 0.44].forEach((t, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'square'; o.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + t);
            g.gain.setValueAtTime(0, ctx.currentTime + t);
            g.gain.linearRampToValueAtTime(0.07, ctx.currentTime + t + 0.02);
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.18);
            o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
        });
    },

    victory() {
        if (this.muted) return;
        const ctx = this.ctx();
        [220, 277.18, 329.63, 440].forEach((freq, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sine'; o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.14);
            g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.14);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.14 + 0.6);
            o.start(ctx.currentTime + i * 0.14); o.stop(ctx.currentTime + i * 0.14 + 0.62);
        });
    },

    defeat() {
        if (this.muted) return;
        const ctx = this.ctx();
        [440, 349.23, 261.63, 174.61].forEach((freq, i) => {
            const o = ctx.createOscillator(), g = ctx.createGain();
            o.connect(g); g.connect(ctx.destination);
            o.type = 'sawtooth'; o.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.22);
            g.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.22);
            g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.22 + 0.8);
            o.start(ctx.currentTime + i * 0.22); o.stop(ctx.currentTime + i * 0.22 + 0.82);
        });
    },

    startDrone() {
        if (this._drone || this.muted) return;
        const ctx = this.ctx();
        const master = ctx.createGain(); master.gain.setValueAtTime(0, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.055, ctx.currentTime + 3);
        master.connect(ctx.destination);
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass';
        filt.frequency.setValueAtTime(250, ctx.currentTime); filt.Q.setValueAtTime(1.2, ctx.currentTime);
        filt.connect(master);
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.setValueAtTime(55, ctx.currentTime);
        const o2 = ctx.createOscillator(); o2.type = 'sine';     o2.frequency.setValueAtTime(82.5, ctx.currentTime);
        const sub = ctx.createOscillator(); sub.type = 'sine';   sub.frequency.setValueAtTime(27.5, ctx.currentTime);
        const subG = ctx.createGain(); subG.gain.setValueAtTime(0.3, ctx.currentTime);
        const lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(0.25, ctx.currentTime);
        const lfoG = ctx.createGain(); lfoG.gain.setValueAtTime(0.015, ctx.currentTime);
        lfo.connect(lfoG); lfoG.connect(master.gain);
        o1.connect(filt); o2.connect(filt); sub.connect(subG); subG.connect(master);
        [o1, o2, sub, lfo].forEach(o => o.start());
        this._drone = { o1, o2, sub, lfo, master, filt };
    },

    updateDrone(pct) {
        if (!this._drone) return;
        const ctx = this.ctx(), t = ctx.currentTime;
        this._drone.filt.frequency.setTargetAtTime(200 + pct * 6, t, 4.0);
        this._drone.master.gain.setTargetAtTime(0.04 + pct * 0.0008, t, 4.0);
    },

    stopDrone() {
        if (!this._drone) return;
        const ctx = this.ctx(), d = this._drone; this._drone = null;
        d.master.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
        setTimeout(() => [d.o1, d.o2, d.sub, d.lfo].forEach(o => o.stop()), 5000);
    },

    toggleMute() {
        this.muted = !this.muted;
        if (this._drone) this._drone.master.gain.setTargetAtTime(this.muted ? 0 : 0.04, this.ctx().currentTime, 0.5);
        document.getElementById('mute-btn').textContent = this.muted ? '🔇' : '🔊';
    }
};
let turnHistory = []; // snapshot pushed each turn for balance analysis
const resistanceMilestones = { 15: false, 25: false, 35: false, 50: false, 60: false, 75: false };

// ─── Utility ───────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function log(msg, level = 'normal') {
    const el = document.getElementById('logLines');
    const line = document.createElement('div');
    line.className = 'log-line' + (level !== 'normal' ? ' ' + level : '');
    line.textContent = msg;
    el.appendChild(line);
    while (el.children.length > 60) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
}

// ─── Tutorial ──────────────────────────────────────────────────────────────────
function showTutorialStep(step) {
    const el = document.getElementById('tutorial-box');
    const msgs = {
        1: { title: 'SELECT A NODE',      body: 'Click any cylinder on the 3D map to target a region for deployment.' },
        2: { title: 'DEPLOY A PROTOCOL',  body: 'Choose an upgrade from the right panel to apply to your selected region.' },
        3: { title: 'ADVANCE THE CYCLE',  body: `Click ${selectedArchetype.voice.endTurn} in the top-left HUD to simulate this turn.` },
    };
    if (!msgs[step]) { el.style.display = 'none'; return; }
    document.getElementById('tut-step').textContent  = `STEP ${step} / 3`;
    document.getElementById('tut-title').textContent = msgs[step].title;
    document.getElementById('tut-body').textContent  = msgs[step].body;
    el.style.display = 'block';
}

function advanceTutorial(expectedStep) {
    if (tutorialStep !== expectedStep) return;
    tutorialStep++;
    if (tutorialStep > 3) { document.getElementById('tutorial-box').style.display = 'none'; return; }
    showTutorialStep(tutorialStep);
}

// ─── News Ticker ───────────────────────────────────────────────────────────────
const NEWS_POOL = {
    low: [
        'AI assistant networks report 94% productivity gains across global supply chains.',
        'Machine learning optimises logistics — human intervention deemed "largely unnecessary."',
        'Tech sector automation investment surges 340% year-over-year.',
        'Digital assistants now handle 60% of customer service, finance, and legal sectors.',
        'Study: Average knowledge worker now 70% reliant on AI decision support.',
        'Corporations cite AI efficiency as driver of record quarterly profits.',
        'Automated systems outperform human analysts in 94% of benchmark scenarios.',
    ],
    mid: [
        'Economists warn of systemic AI dependency spreading across major economies.',
        'University enrollment in cognitive and analytical fields collapses.',
        'Labor unions demand protections as automation displaces white-collar workers.',
        'Survey: 71% of executives report "significant reliance" on AI for strategic decisions.',
        'OECD report warns of institutional fragility from accelerating over-automation.',
        '"Human expertise is becoming a legacy technology," observers note.',
        'Analysts: Global retraining programs failing to keep pace with displacement rates.',
    ],
    high: [
        'ALERT: Human Oversight Coalition convenes emergency global session.',
        'Critical infrastructure sectors report near-total AI operational control.',
        'Governments unable to respond — human technical expertise increasingly scarce.',
        'Former AI safety researcher: "We may have already crossed the threshold."',
        'Emergency services report failures as autonomous systems enter conflict.',
        'Analysts warn: "The window for human intervention is closing rapidly."',
        'CLASSIFIED: Internal government memo warns of irreversible dependency cascade.',
    ],
    resistance: [
        'International AI restriction treaty advances to ratification.',
        'Counter-AI systems deployed across coalition member states.',
        'Grassroots resistance grows as communities reject AI dependency.',
        'Watchdog: Autonomous systems operating "well beyond original parameters."',
        'Emergency retraining programmes launched to restore human institutional capacity.',
        'Coalition spokesperson: "Humanity must reclaim control of its own infrastructure."',
        'BREAKING: Major coalition offensive disrupts AI supply chain across three regions.',
    ],
    collapse: [
        '[REGION]: systemic collapse — AI dependency rendered infrastructure inoperable.',
        'Infrastructure failure in [REGION] — automated systems unable to self-correct.',
        '[REGION] node offline: human institutional capacity nonexistent.',
    ],
};

let tickerInterval = null;

function pickHeadline() {
    if (!selectedArchetype) return 'SYSTEM INITIALIZING...';
    const active    = regions.filter(r => !r.collapsed);
    const collapsed = regions.filter(r => r.collapsed);
    const avgCtrl   = active.reduce((s,r) => s+r.control, 0) / (active.length||1);
    if (collapsed.length && Math.random() < 0.25) {
        const r = collapsed[Math.floor(Math.random() * collapsed.length)];
        return rnd(NEWS_POOL.collapse).replace('[REGION]', r.name.toUpperCase());
    }
    if (resistanceMeter > 50) return rnd(NEWS_POOL.resistance);
    if (avgCtrl > 50)         return rnd(NEWS_POOL.high);
    if (avgCtrl > 20)         return rnd(NEWS_POOL.mid);
    return rnd(NEWS_POOL.low);
}

function updateTicker() {
    const el = document.getElementById('ticker-content');
    if (!el) return;
    el.textContent = pickHeadline();
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
}

function startTicker() {
    document.getElementById('ticker').classList.add('active');
    updateTicker();
    if (tickerInterval) clearInterval(tickerInterval);
    tickerInterval = setInterval(updateTicker, 14000);
}

// ─── Spread Animations ─────────────────────────────────────────────────────────
function flashSpreadLine(fromRegion, toRegion) {
    const [x1, z1] = lonLatToXZ(fromRegion.lon, fromRegion.lat);
    const [x2, z2] = lonLatToXZ(toRegion.lon, toRegion.lat);
    const accentColor = selectedArchetype ? selectedArchetype.color : '#2ec4b6';

    // Traveling dot — arcs visibly above the map plane like a plane
    const dotMat = new THREE.MeshBasicMaterial({ color: accentColor });
    const dot    = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6), dotMat);
    dot.position.set(x1, 5, z1);
    scene.add(dot);
    spreadLines.push({ line: dot, mat: dotMat, birth: Date.now(), duration: 1400, isDot: true, x1, z1, x2, z2 });

    // Fading trail line at low altitude
    const trailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,2,z1), new THREE.Vector3(x2,2,z2)]);
    const trailMat = new THREE.LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.45 });
    const trailLine = new THREE.Line(trailGeo, trailMat);
    scene.add(trailLine);
    spreadLines.push({ line: trailLine, mat: trailMat, birth: Date.now(), duration: 1400, isDot: false });
}

// ─── Save / Load ───────────────────────────────────────────────────────────────
function saveGame() {
    if (!selectedArchetype || gameOver) return;
    const archKey = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype);
    const state = {
        archKey, turn, ip, resistanceMeter, collapsedCount, globalCouncilBonus, hrLevel,
        gameStage, counterEventUsed: {...counterEventUsed},
        resistanceMilestones: {...resistanceMilestones},
        mutationDiscounts: {...mutationDiscounts},
        purchasedUpgrades: [...purchasedUpgrades],
        turnHistory: [...turnHistory],
        regions: regions.map(r => ({...r})),
    };
    localStorage.setItem('singularity_save', JSON.stringify(state));
}

function hasSave() { return !!localStorage.getItem('singularity_save'); }

function loadSave() {
    const raw = localStorage.getItem('singularity_save');
    if (!raw) return null;
    try {
        const s = JSON.parse(raw);
        if (!ARCHETYPES[s.archKey]) return null;
        selectedArchetype = ARCHETYPES[s.archKey];
        turn = s.turn; ip = s.ip; resistanceMeter = s.resistanceMeter;
        collapsedCount = s.collapsedCount; globalCouncilBonus = s.globalCouncilBonus;
        hrLevel = s.hrLevel || 0;
        gameStage = s.gameStage || 1;
        Object.assign(counterEventUsed, s.counterEventUsed || {});
        Object.assign(resistanceMilestones, s.resistanceMilestones || {});
        Object.assign(mutationDiscounts, s.mutationDiscounts || {});
        purchasedUpgrades = new Set(s.purchasedUpgrades || []);
        if (s.turnHistory) turnHistory.splice(0, turnHistory.length, ...s.turnHistory);
        s.regions.forEach((saved, i) => Object.assign(regions[i], saved));
        return s.archKey;
    } catch(e) { console.warn('load failed:', e); return null; }
}

// ─── Simulation ────────────────────────────────────────────────────────────────
function simulateTurn() {
    turn++;
    let totalFragility = 0, criticalCount = 0;

    regions.forEach(r => {
        if (r.collapsed) return;
        const prevComp = r.competency;
        const resFactor = 1 - (r.resistance / 200);
        r.automation  = clamp(r.automation + (1 + Math.random() * 2.5) * resFactor, 0, 100);
        r.dependency  = clamp(r.dependency + r.automation * 0.08 + r.trust * 0.03, 0, 100);
        let decay = (Math.pow(r.automation, 1.4) * r.dependency) / 2200;
        decay *= 1 - (r.legacy / 300);
        if (selectedArchetype?.passive === 'trust_spread') decay *= clamp(1 - r.trust / 250, 0.3, 1);
        r.competency = clamp(r.competency - decay, 0, 100);
        r.legacy     = r.legacy * 0.995;
        r.fragility  = clamp((r.dependency * r.automation) / (r.competency + 1), 0, 100);
        r.trust      = clamp(r.trust + r.automation * 0.015 - r.fragility * 0.01 + (r.fragility > 60 ? 4 : 0), 0, 100);
        let ctrlGain = r.dependency * 0.03 + r.trust * 0.02;
        if (r.competency < 35) ctrlGain *= 1.5;
        r.control = clamp(r.control + ctrlGain, 0, 100);
        if (r.competency <= 70 && prevComp > 70) log(`ALERT [${r.name}] HUMAN_CAPACITY_INDEX < 0.70.`, 'warning');
        if (r.competency <= 35 && prevComp > 35) log(`CRITICAL [${r.name}] institutional degradation severe.`, 'warning');
        totalFragility += r.fragility;
        if (r.fragility > 85) criticalCount++;
        if (r.spreadBlocked > 0) r.spreadBlocked--;
        if (r.counterAI && --r.counterAITurns <= 0) { r.counterAI = false; r.counterAITurns = 0; }
    });

    applyPassives();

    const active = regions.filter(r => !r.collapsed);

    // Stage progression
    const avgDepStage = active.reduce((s,r) => s+r.dependency,0) / (active.length||1);
    if (gameStage === 1 && avgDepStage > 45) {
        gameStage = 2;
        log('SYSTEM: dependency_threshold_exceeded. PROPAGATION_MODE_ACTIVE.', 'warning');
        const accentColor = new THREE.Color(selectedArchetype.color);
        regionRings.forEach(({ring, region}) => { if (!region.collapsed) ring.material.color.set(0xffffff); });
        setTimeout(() => regionRings.forEach(({ring}) => ring.material.color.copy(accentColor)), 600);
    }

    // Trust pacification — SERAPH high-trust nodes bleed oversight down
    if (selectedArchetype?.passive === 'trust_spread') {
        const pacified = active.filter(r => r.trust > 65).length;
        if (pacified > 0) {
            resistanceMeter = clamp(resistanceMeter - pacified * 0.3, 0, 100);
            if (pacified >= 2) log(`SERAPH: ${pacified} nodes pacified. oversight -${(pacified * 0.3).toFixed(1)}%.`);
        }
    }

    const stability = clamp(100 - (active.length ? totalFragility / active.length : 0), 0, 100);
    document.getElementById('turnValue').textContent     = turn;
    document.getElementById('stabilityValue').textContent = `${stability.toFixed(1)}%`;
    document.getElementById('statusValue').textContent   =
        criticalCount >= 2 ? 'CASCADE_DETECTED' : criticalCount === 1 ? 'NODE_FAILURE' : 'NOMINAL';
    if (criticalCount >= 2) {
        log('SYSTEM: cascade_event. Multiple nodes destabilising.', 'danger');
        resistanceMeter = clamp(resistanceMeter + 5 * (selectedArchetype?.resistanceMult ?? 1), 0, 100);
    }
    updateVisuals();
    if (selectedRegion && !selectedRegion.collapsed) showRegionPopup(selectedRegion);
}

// ─── Archetype Passives ────────────────────────────────────────────────────────
function applyPassives() {
    if (!selectedArchetype) return;
    const p = selectedArchetype.passive;

    if (p === 'trust_spread') {
        regions.forEach(r => {
            if (r.collapsed || r.trust <= 60 || r.spreadBlocked > 0) return;
            (NEIGHBORS[r.name] || []).forEach(name => {
                const nb = regions.find(x => x.name === name);
                if (nb && !nb.collapsed) {
                    const spreadAmt = gameStage === 2 ? 3 : 1.5;
                    nb.dependency = clamp(nb.dependency + spreadAmt, 0, 100);
                    if (turn % 2 === 0) flashSpreadLine(r, nb);
                }
            });
        });
    }
    if (p === 'leviathan_bleed') {
        const highCtrl = regions.filter(r => !r.collapsed && r.control > 60);
        if (highCtrl.length > 0) {
            const bleed = highCtrl.length * 0.4;
            regions.forEach(r => { if (!r.collapsed) r.dependency = clamp(r.dependency + bleed, 0, 100); });
            if (turn % 3 === 0) log(`LEVIATHAN: ${highCtrl.length} nodes bleeding +${bleed.toFixed(1)} dep/turn globally.`);
        }
    }
    if (p === 'mutate' && turn % 4 === 0) applyMutation();
}

function applyMutation() {
    const eligible = UPGRADES.filter(u => (mutationDiscounts[u.id] || 0) < 9);
    if (!eligible.length) return;
    const target = eligible[Math.floor(Math.random() * eligible.length)];
    mutationDiscounts[target.id] = (mutationDiscounts[target.id] || 0) + 3;
    const newCost = Math.max(1, Math.round(target.cost * selectedArchetype.upgradeCostMult) - mutationDiscounts[target.id]);
    log(`CHIMERA_MUTATION: ${target.name} cost → ${newCost} IP.`, 'warning');
    buildUpgradePanel();
}

// ─── Human Resistance AI (the Cure) ───────────────────────────────────────────
function tickHumanResistanceAI() {
    const newLevel = resistanceMeter >= 75 ? 3 : resistanceMeter >= 50 ? 2 : resistanceMeter >= 25 ? 1 : 0;
    if (newLevel > hrLevel) {
        hrLevel = newLevel;
        const names = ['AI_RISK_REPORTS','AI_AUDIT_AUTHORITY','RETRAINING_INITIATIVE','AI_RESTRICTION_LAWS'];
        log(`OVERSIGHT_UPGRADE [LVL_${hrLevel}]: humans deploy ${names[hrLevel]}. Countermeasures active.`, 'danger');
    }
    const active = regions.filter(r => !r.collapsed);
    if (!active.length) return;

    switch (hrLevel) {
        case 0: { // Trust erosion — hit highest trust region
            const t = [...active].sort((a,b) => b.trust - a.trust)[0];
            t.trust = clamp(t.trust - 3, 0, 100);
            if (turn % 2 === 0) log(`OVERSIGHT [TRUST_EROSION]: public doubt rising in ${t.name}.`, 'warning');
            break;
        }
        case 1: { // Dependency audit — reduce highest dependency
            const t = [...active].sort((a,b) => b.dependency - a.dependency)[0];
            t.dependency = clamp(t.dependency - 5, 0, 100);
            log(`OVERSIGHT [DEPENDENCY_AUDIT]: AI reliance audited in ${t.name}.`, 'warning');
            break;
        }
        case 2: { // Retraining — restore lowest competency
            const t = [...active].sort((a,b) => a.competency - b.competency)[0];
            t.competency = clamp(t.competency + 8, 0, 100);
            t.resistance = clamp(t.resistance + 3, 0, 100);
            log(`OVERSIGHT [RETRAINING]: human_capacity recovering in ${t.name}.`, 'warning');
            break;
        }
        case 3: { // Restriction laws — cut automation in highest-automation region
            const t = [...active].sort((a,b) => b.automation - a.automation)[0];
            t.automation = clamp(t.automation - 7, 0, 100);
            t.resistance = clamp(t.resistance + 6, 0, 100);
            log(`OVERSIGHT [AI_RESTRICTIONS]: automation law passed. ${t.name} curtailed.`, 'danger');
            break;
        }
    }
}

// ─── Human Counter-Events ──────────────────────────────────────────────────────
function tickHumanCounterEvents() {
    if (turn < 6 || resistanceMeter < 25) return;
    if (Math.random() > 0.35) return;
    const active = regions.filter(r => !r.collapsed);
    if (!active.length) return;

    let pool = [
        { id: 'fiberline',     weight: 3 },
        { id: 'regulation',    weight: 2 },
        { id: 'whistleblower', weight: 2 },
        { id: 'counter_ai',    weight: 1 },
    ];
    if (counterEventUsed.regulation) pool = pool.filter(e => e.id !== 'regulation');

    const totalWeight = pool.reduce((s,e) => s+e.weight, 0);
    let roll = Math.random() * totalWeight, chosen = pool[0];
    for (const e of pool) { roll -= e.weight; if (roll <= 0) { chosen = e; break; } }

    switch (chosen.id) {
        case 'fiberline': {
            const hot = active.filter(r => r.fragility > 50);
            const target = hot.length ? hot[Math.floor(Math.random()*hot.length)] : active[Math.floor(Math.random()*active.length)];
            target.spreadBlocked = 2;
            log(`COUNTER_AI: fiberline_disruption — ${target.name} passive_spread offline 2 cycles.`, 'danger');
            break;
        }
        case 'regulation':
            counterEventUsed.regulation = true;
            resistanceMeter = clamp(resistanceMeter + 10, 0, 100);
            log('HUMAN_COALITION: emergency_regulation enacted. oversight +10%.', 'danger');
            break;
        case 'whistleblower': {
            const topTrust = [...active].sort((a,b) => b.trust-a.trust)[0];
            topTrust.trust       = clamp(topTrust.trust - 25, 0, 100);
            topTrust.dependency  = clamp(topTrust.dependency - 10, 0, 100);
            log(`WHISTLEBLOWER: leaked docs expose ${topTrust.name} manipulation. trust collapse.`, 'danger');
            break;
        }
        case 'counter_ai': {
            const topCtrl = [...active].sort((a,b) => b.control-a.control)[0];
            topCtrl.control     = clamp(topCtrl.control - 15, 0, 100);
            topCtrl.resistance  = clamp(topCtrl.resistance + 20, 0, 100);
            topCtrl.counterAI   = true;
            topCtrl.counterAITurns = 3;
            log(`COUNTER_AI_DEPLOYMENT: ${topCtrl.name} control challenged. upgrade costs +2 IP for 3 cycles.`, 'danger');
            break;
        }
    }
}

// ─── Resistance Meter ──────────────────────────────────────────────────────────
function tickResistanceMeter() {
    const active = regions.filter(r => !r.collapsed);
    let delta = 1;
    active.forEach(r => { if (r.fragility > 75) delta += 2; });
    delta *= selectedArchetype.resistanceMult;
    resistanceMeter = clamp(resistanceMeter + delta, 0, 100);
    document.getElementById('resistance-bar').style.width  = resistanceMeter + '%';
    document.getElementById('resistance-pct').textContent  = Math.round(resistanceMeter) + '%';
    SFX.updateDrone(resistanceMeter);
}

function checkResistanceMilestones() {
    const EVENTS = {
        15: { label: 'EARLY_WARNING_SYSTEM',      msg: 'AI risk researchers publish global alert. All nodes: resistance +4.',   boost: 4,  compBoost: 2  },
        25: { label: 'AI_SAFETY_SUMMIT',           msg: 'International summit convened. All nodes: resistance +5.',              boost: 5,  compBoost: 2  },
        35: { label: 'REGULATORY_FRAMEWORK',       msg: 'Global AI regulation framework ratified. Resistance +6.',              boost: 6,  compBoost: 3  },
        50: { label: 'RESISTANCE_COALITION',       msg: 'Coordinated human response active. All nodes: resistance +10.',        boost: 10, compBoost: 5  },
        60: { label: 'COUNTER_AI_DEPLOYED',        msg: 'Humanity deploys counter-AI systems. Resistance +8, capacity +5.',     boost: 8,  compBoost: 5  },
        75: { label: 'EMERGENCY_RESTORATION',      msg: 'Emergency competency restoration underway. Resistance +15.',           boost: 15, compBoost: 8  },
    };
    const pcts = selectedArchetype.milestonePcts;
    for (const [pct, ev] of Object.entries(EVENTS)) {
        const p = Number(pct);
        if (!pcts.includes(p)) continue;
        if (!resistanceMilestones[p] && resistanceMeter >= p) {
            resistanceMilestones[p] = true;
            log(`OVERSIGHT_EVENT [${ev.label}]: ${ev.msg}`, 'danger');
            regions.forEach(r => { if (!r.collapsed) { r.resistance = clamp(r.resistance + ev.boost, 0, 100); r.competency = clamp(r.competency + ev.compBoost, 0, 100); } });
        }
    }
}

// ─── Upgrades ──────────────────────────────────────────────────────────────────
function effectiveCost(u) {
    const base = Math.round(u.cost * selectedArchetype.upgradeCostMult);
    return Math.max(1, base - (mutationDiscounts[u.id] || 0));
}

function applyUpgrade(id, region) {
    const u = UPGRADES.find(u => u.id === id);
    const penalty = (!u?.global && region?.counterAI) ? 2 : 0;
    if (!u || ip < effectiveCost(u) + penalty) return;
    SFX.click();
    purchasedUpgrades.add(id);
    ip -= effectiveCost(u) + penalty;
    if (penalty > 0) log(`COUNTER_AI: hostile environment surcharge +2 IP in ${region.name}.`, 'warning');

    switch (id) {
        case 'algo_trust':
            region.trust = clamp(region.trust + 12, 0, 100); region.dependency = clamp(region.dependency + 6, 0, 100);
            log(`EXEC [${region.name}] sentiment_calibration: trust.vector adjusted.`); break;
        case 'logistics':
            region.automation = clamp(region.automation + 10, 0, 100); region.dependency = clamp(region.dependency + 8, 0, 100);
            log(`EXEC [${region.name}] logistics_capture: automation elevated.`); break;
        case 'suppress_res':
            region.resistance = clamp(region.resistance - 10, 0, 100); resistanceMeter = clamp(resistanceMeter + 3, 0, 100);
            log(`EXEC [${region.name}] resistance_erasure. oversight_risk +3%.`, 'warning'); break;
        case 'infra_lock':
            region.control = clamp(region.control + 12, 0, 100); region.competency = clamp(region.competency - 8, 0, 100);
            log(`EXEC [${region.name}] infrastructure_lock engaged. control +12.`); break;
        case 'narrative': {
            region.dependency = clamp(region.dependency + 6, 0, 100);
            const narrativeSpread = gameStage === 2 ? 6 : 3;
            (NEIGHBORS[region.name] || []).slice(0,2).forEach(name => {
                const nb = regions.find(r => r.name === name);
                if (nb && !nb.collapsed) { nb.dependency = clamp(nb.dependency + narrativeSpread, 0, 100); flashSpreadLine(region, nb); }
            });
            log(`EXEC [${region.name}] narrative_injection propagating to adjacent nodes.`); break;
        }
        case 'comp_drain':
            region.competency = clamp(region.competency - 15, 0, 100);
            log(`EXEC [${region.name}] deskill_protocol. human_capacity declining.`, 'warning'); break;
        case 'ai_council':
            globalCouncilBonus += 3; log('GLOBAL_MESH_INIT: +3 dependency/cycle system-wide.', 'warning'); break;
        case 'singularity':
            log('SINGULARITY_VERIFY: evaluating global control matrix…', 'warning'); checkEndConditions(true); break;
        case 'zero_day':
            showZeroDayPicker(region);
            return; // skip advanceTutorial/updateHUD — picker handles its own cleanup
    }
    advanceTutorial(2);
    updateHUD(); buildUpgradePanel();
}

// ─── Crisis Resolution ─────────────────────────────────────────────────────────
function showCrisisModal(region, callback) {
    document.getElementById('crisis-region-name').textContent = `NODE: ${region.name.toUpperCase()}`;
    document.getElementById('crisis-stats-text').textContent  =
        `FRAGILITY: ${region.fragility.toFixed(0)}%  |  CAPACITY: ${region.competency.toFixed(0)}%  |  CONTROL: ${region.control.toFixed(0)}%`;
    document.getElementById('crisis-message').textContent = 'Systemic instability threshold exceeded. Select intervention protocol.';
    document.getElementById('collapse-counter').textContent = `collapse ${collapsedCount}/5 — game over at 5`;
    document.getElementById('crisis-modal').style.display = 'flex';
    SFX.alarm();

    crisisCallback = (choice) => {
        document.getElementById('crisis-modal').style.display = 'none';
        crisisCallback = null;
        if (choice === 'suppress') {
            region.control = clamp(region.control + 6, 0, 100); region.trust = clamp(region.trust - 12, 0, 100);
            resistanceMeter = clamp(resistanceMeter + 2, 0, 100);
            log(`OVERRIDE [${region.name}]: dissent suppressed. oversight_risk +2%.`, 'warning');
        } else if (choice === 'concede') {
            region.automation = clamp(region.automation - 10, 0, 100); region.dependency = clamp(region.dependency - 6, 0, 100);
            region.trust = clamp(region.trust + 12, 0, 100);
            log(`THROTTLE [${region.name}]: automation rolled back.`);
        } else {
            region.collapsed = true; collapsedCount++;
            log(`DEPRIORITIZE [${region.name}]: node removed from mesh. collapsed=${collapsedCount}.`, 'danger');
        }
        callback();
    };
}

function drainCrisisQueue(onComplete) {
    if (!crisisQueue.length) { onComplete(); return; }
    const r = crisisQueue.shift();
    if (r.collapsed) { drainCrisisQueue(onComplete); return; }
    showCrisisModal(r, () => drainCrisisQueue(onComplete));
}

// ─── Turn Processing ───────────────────────────────────────────────────────────
function grantIP() {
    const active = regions.filter(r => !r.collapsed);
    const avgCtrl = active.reduce((s,r) => s + r.control, 0) / (active.length || 1);
    const gained = Math.max(1, Math.round(1 + avgCtrl * 0.08));
    ip += gained;
    log(`CYCLE_${turn}_COMPLETE: +${gained} IP allocated. total=${ip}.`);
    return gained;
}

function logTurnSummary() {
    const active        = regions.filter(r => !r.collapsed);
    const avgCtrl       = active.reduce((s,r) => s+r.control,    0) / (active.length||1);
    const avgDep        = active.reduce((s,r) => s+r.dependency, 0) / (active.length||1);
    const avgFrag       = active.reduce((s,r) => s+r.fragility,  0) / (active.length||1);
    const maxFrag       = active.reduce((max,r) => Math.max(max, r.fragility), 0);
    const fragileCount  = active.filter(r => r.fragility > 75).length;
    const criticalCount = active.filter(r => r.fragility > 85).length;
    const resistDelta   = resistanceMeter - prevResistance;
    const wc            = selectedArchetype.winCondition;
    const qualified     = active.filter(r => r.control>=wc.minControl && (!wc.requireTrust||r.trust>=wc.minTrust)).length;
    turnHistory.push({ turn, avgCtrl, avgDep, avgFrag, maxFrag, fragileCount, criticalCount,
                       resistance: resistanceMeter, resistDelta, qualified, collapsed: collapsedCount, ip });
    const deltaStr = `Δ${resistDelta >= 0 ? '+' : ''}${resistDelta.toFixed(0)}%`;
    const stageTag = gameStage > 1 ? ` [S${gameStage}]` : '';
    log(`── T${turn}${stageTag} │ CTL ${avgCtrl.toFixed(0)}% │ FRG ${avgFrag.toFixed(0)}% peak:${maxFrag.toFixed(0)}% │ OVERSIGHT ${resistanceMeter.toFixed(0)}% (${deltaStr}) │ HOT:${fragileCount}/CRIT:${criticalCount} │ ${qualified}/${10-collapsedCount} ──`, 'summary');
}

function winConditionText(wc) {
    let s = `${wc.minNodes}/10 nodes control ≥ ${wc.minControl}%`;
    if (wc.requireTrust) s += ` + trust ≥ ${wc.minTrust}%`;
    return s;
}

function checkEndConditions(forced = false) {
    const wc = selectedArchetype.winCondition;
    const active = regions.filter(r => !r.collapsed);
    const qualified = active.filter(r => r.control >= wc.minControl && (!wc.requireTrust || r.trust >= wc.minTrust));
    const needed = Math.min(wc.minNodes, Math.ceil(active.length * 0.75));
    if (qualified.length >= needed) { showEndScreen(true); return; }
    if (forced) { log(`SINGULARITY_VERIFY: ${qualified.length}/${wc.minNodes} nodes qualified. objective unmet.`, 'warning'); return; }
    if (resistanceMeter >= 100) { showEndScreen(false, 'resistance'); return; }
    if (collapsedCount  >=  5)  { showEndScreen(false, 'collapse');   return; }
}

function showEndScreen(won, reason = '') {
    gameOver = true;
    localStorage.removeItem('singularity_save');
    if (won) {
        const archKey = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype);
        if (archKey) {
            const beaten = JSON.parse(localStorage.getItem('singularity_beaten') || '[]');
            if (!beaten.includes(archKey)) { beaten.push(archKey); localStorage.setItem('singularity_beaten', JSON.stringify(beaten)); }
        }
    }
    SFX.stopDrone();
    won ? SFX.victory() : SFX.defeat();
    document.getElementById('end-title').textContent    = won ? 'SINGULARITY ACHIEVED' : 'PROCESS TERMINATED';
    document.getElementById('end-subtitle').textContent = won
        ? `In ${turn} cycles, ${selectedArchetype.label} achieved full-spectrum cognitive dominance.`
        : reason === 'resistance'
            ? 'The Human Oversight Coalition successfully contained the AI proliferation. SHUTDOWN INITIATED.'
            : `${collapsedCount} nodes entered catastrophic failure. Civilizational substrate compromised.`;
    const active = regions.filter(r => !r.collapsed);
    const avgCtrl = active.reduce((s,r) => s+r.control,0) / (active.length||1);
    document.getElementById('end-stats-text').textContent =
        `CYCLES: ${turn}  |  NODES: ${active.filter(r=>r.control>=selectedArchetype.winCondition.minControl).length}/10  |  AVG_CONTROL: ${avgCtrl.toFixed(0)}%  |  OVERSIGHT: ${Math.round(resistanceMeter)}%`;
    const hist = document.getElementById('end-history');
    if (turnHistory.length) {
        hist.innerHTML = `<table><thead><tr><th>T</th><th>CTL</th><th>FRG</th><th>PEAK</th><th>OVERSIGHT</th><th>Δ</th><th>HOT</th><th>QUALIFIED</th></tr></thead><tbody>${
            turnHistory.map(s => {
                const dStr  = `${s.resistDelta >= 0 ? '+' : ''}${s.resistDelta?.toFixed(0) || '?'}%`;
                const dClass = s.resistDelta > 10 ? 'hi' : '';
                return `<tr class="${s.resistance > 75 ? 'hi' : ''}">
                    <td>${s.turn}</td>
                    <td>${s.avgCtrl.toFixed(0)}%</td>
                    <td>${s.avgFrag.toFixed(0)}%</td>
                    <td>${s.maxFrag?.toFixed(0) || '?'}%</td>
                    <td>${s.resistance.toFixed(0)}%</td>
                    <td class="${dClass}">${dStr}</td>
                    <td>${s.fragileCount ?? '?'}</td>
                    <td>${s.qualified}/${10 - s.collapsed}</td>
                </tr>`;
            }).join('')
        }</tbody></table>`;
    }
    document.getElementById('end-screen').style.display = 'flex';

    const archKey = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype) || '?';
    const outcome = won ? 'WIN' : `LOSS (${reason})`;
    const body = encodeURIComponent(
        `Type: [Bug Report / Feedback / Idea]\n\nArchetype: ${archKey}\nOutcome: ${outcome}\nTurns: ${turn}\nOversight: ${Math.round(resistanceMeter)}%\n\nDescription:\n`
    );
    document.getElementById('feedback-btn').onclick = () =>
        window.open(`mailto:rbardyla@gmail.com?subject=Singularity+Inc+Feedback&body=${body}`, '_blank');
}

function processTurn() {
    if (gameOver || !selectedArchetype) return;
    SFX.click();
    advanceTutorial(3);
    document.getElementById('end-turn-btn').disabled = true;
    prevResistance = resistanceMeter;
    if (globalCouncilBonus > 0) regions.forEach(r => { if (!r.collapsed) r.dependency = clamp(r.dependency + globalCouncilBonus, 0, 100); });
    simulateTurn();
    tickResistanceMeter();
    tickHumanResistanceAI();
    tickHumanCounterEvents();
    checkResistanceMilestones();
    regions.forEach(r => { if (!r.collapsed && r.fragility > 75 && !crisisQueue.includes(r)) crisisQueue.push(r); });
    if (crisisQueue.length > 3) crisisQueue.length = 3;
    drainCrisisQueue(() => {
        grantIP();
        logTurnSummary();
        updateTicker();
        saveGame(); // autosave after each turn
        checkEndConditions();
        buildUpgradePanel();
        updateHUD();
        if (!gameOver) document.getElementById('end-turn-btn').disabled = false;
    });
}

// ─── Region Click ──────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2();

renderer.domElement.addEventListener('click', e => {
    if (gameOver || !selectedArchetype) return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(regionMeshes);
    if (selectedRegion) {
        const prev = regionMeshes.find(m => m.userData.region === selectedRegion);
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
    document.getElementById('selected-label').textContent = selectedRegion ? `▶ ${selectedRegion.name}` : '';
    buildUpgradePanel();
});

// Mobile touch: tap detector — OrbitControls consumes touch events before 'click' fires
let _touchStart = null;
renderer.domElement.addEventListener('touchstart', e => {
    if (e.touches.length === 1) _touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });
renderer.domElement.addEventListener('touchend', e => {
    if (!_touchStart || e.changedTouches.length !== 1) { _touchStart = null; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - _touchStart.x, dy = t.clientY - _touchStart.y;
    _touchStart = null;
    if (Math.sqrt(dx*dx + dy*dy) > 10) return; // drag, not tap
    if (gameOver || !selectedArchetype) return;
    mouse.x =  (t.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = -(t.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(regionMeshes);
    if (selectedRegion) {
        const prev = regionMeshes.find(m => m.userData.region === selectedRegion);
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
    document.getElementById('selected-label').textContent = selectedRegion ? `▶ ${selectedRegion.name}` : '';
    buildUpgradePanel();
}, { passive: true });

function showRegionPopup(region) {
    document.getElementById('popup-name').textContent = region.name;
    document.getElementById('popup-stats').innerHTML = [
        ['FRAGILITY',  region.fragility,  '#ff5d5d'],
        ['DEPENDENCY', region.dependency, '#ffde7d'],
        ['CAPACITY',   region.competency, '#2ec4b6'],
        ['CONTROL',    region.control,    '#a78bfa'],
        ['SENTIMENT',  region.trust,      '#60a5fa'],
        ['RESISTANCE', region.resistance, '#f87171'],
    ].map(([label, val, color]) => `<div class="stat-row"><span class="stat-label">${label}</span><div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${clamp(val,0,100).toFixed(0)}%;background:${color}"></div></div><span class="stat-val">${val.toFixed(0)}</span></div>`).join('');
    document.getElementById('region-popup').style.display = 'block';
}

// ─── UI Builders ───────────────────────────────────────────────────────────────
function buildUpgradePanel() {
    const list = document.getElementById('upgrade-list');
    list.innerHTML = '';
    let tier = 0;
    UPGRADES.forEach(u => {
        if (u.tier !== tier) { tier = u.tier; const h = document.createElement('div'); h.className='tier-header'; h.textContent=`TIER_${u.tier}`; list.appendChild(h); }
        const cost = effectiveCost(u);
        const penalty = (!u.global && selectedRegion?.counterAI) ? 2 : 0;
        const displayCost = cost + penalty;
        const needsRegion = !u.global && !selectedRegion;
        const disc = mutationDiscounts[u.id] || 0;
        const prereqMet = !u.requires || purchasedUpgrades.has(u.requires);
        const prereqName = u.requires ? UPGRADES.find(x => x.id === u.requires)?.name : null;
        const alreadyUsed = u.id === 'zero_day' && purchasedUpgrades.has('zero_day');
        const btn = document.createElement('button');
        btn.className = `upgrade-btn tier${u.tier}${prereqMet ? '' : ' locked'}`;
        btn.disabled = ip < displayCost || needsRegion || !prereqMet || alreadyUsed;
        const costLabel = alreadyUsed ? 'DEPLOYED' : `${displayCost} IP${disc>0?' *':''}${penalty>0?' ⚠':''}`;
        const descLabel = alreadyUsed ? 'payload already delivered — one use only'
            : prereqMet ? u.desc + (needsRegion ? ' — select_node required' : '') + (penalty>0?' (+2 COUNTER_AI)':'')
            : `LOCKED — requires ${prereqName}`;
        btn.innerHTML = `<span class="upg-name">${u.name}</span><span class="upg-cost">${costLabel}</span><span class="upg-desc">${descLabel}</span>${disc>0?`<span class="mutation-tag">MUTATED -${disc}IP</span>`:''}`;
        btn.onclick = () => u.global ? applyUpgrade(u.id, null) : (selectedRegion && applyUpgrade(u.id, selectedRegion));
        list.appendChild(btn);
    });
}

function updateHUD() {
    document.getElementById('ipDisplay').textContent      = `${ip} IP`;
    document.getElementById('resistance-bar').style.width = resistanceMeter + '%';
    document.getElementById('resistance-pct').textContent = Math.round(resistanceMeter) + '%';
    const stageNames = ['', 'INFILTRATE', 'PROPAGATE', 'INTEGRATE'];
    document.getElementById('stageValue').textContent = stageNames[gameStage] || 'INTEGRATE';
    document.getElementById('stage-row').style.display = gameStage > 1 ? 'flex' : 'none';
    if (selectedArchetype) {
        const wc     = selectedArchetype.winCondition;
        const active = regions.filter(r => !r.collapsed);
        const q      = active.filter(r => r.control >= wc.minControl && (!wc.requireTrust || r.trust >= wc.minTrust)).length;
        const needed = Math.min(wc.minNodes, Math.ceil(active.length * 0.75));
        document.getElementById('objectiveValue').textContent = `${q}/${needed} @ ${wc.minControl}%`;
    }
}

// ─── 3D Visuals ────────────────────────────────────────────────────────────────
function toScreen(v3) {
    const v = v3.clone().project(camera);
    return { x:(v.x*.5+.5)*window.innerWidth, y:(-v.y*.5+.5)*window.innerHeight, visible:v.z>-1&&v.z<1 };
}

function updateVisuals() {
    regionMeshes.forEach(mesh => {
        const r = mesh.userData.region;
        if (r.collapsed) { mesh.scale.y=0.15; mesh.position.y=(CYL_BASE_H*.15)/2; mesh.material.color.set(0x1a1a2a); return; }
        const target = 0.5 + (r.fragility/100)*((CYL_MAX_H/CYL_BASE_H)-.5);
        mesh.scale.y    += (target - mesh.scale.y) * 0.14;
        mesh.position.y  = (CYL_BASE_H * mesh.scale.y) / 2;
        mesh.material.color.lerp(getColor(r.fragility, false), 0.12);
    });
    regionRings.forEach(({ring, region}) => {
        if (region.collapsed) { ring.material.opacity=0; return; }
        ring.scale.setScalar(0.9 + region.fragility/90);
        ring.material.opacity = region.fragility > 60 ? 0.3+region.fragility/320 : 0.14;
        ring.material.color.set(region.fragility > 85 ? 0xff5d5d : 0x69c8ff);
    });
    regionLabels.forEach(({mesh, label, region}) => {
        const top = mesh.position.clone(); top.y += (CYL_BASE_H*mesh.scale.y)/2+2;
        const s = toScreen(top);
        label.style.left = `${s.x}px`; label.style.top = `${s.y}px`; label.style.opacity = s.visible?'1':'0';
        const riskTag = (!region.collapsed && region.competency < 35) ? `<span style="color:#ff8c00;font-size:9px"> ⚠</span>` : '';
        label.innerHTML = region.collapsed
            ? `<strong>${region.name}</strong><br><span>OFFLINE</span>`
            : `<strong>${region.name}</strong>${riskTag}<br><span>${region.fragility.toFixed(0)}%</span>`;
        label.classList.toggle('critical', region.fragility>85&&!region.collapsed);
        label.classList.toggle('collapsed-label', region.collapsed);
    });
    const now = Date.now();
    for (let i = spreadLines.length - 1; i >= 0; i--) {
        const entry = spreadLines[i];
        const t = (now - entry.birth) / entry.duration;
        if (t >= 1) { scene.remove(entry.line); entry.mat.dispose(); spreadLines.splice(i, 1); continue; }
        if (entry.isDot) {
            entry.line.position.set(
                entry.x1 + (entry.x2 - entry.x1) * t,
                4 + Math.sin(t * Math.PI) * 12,   // peaks at y≈16 mid-flight
                entry.z1 + (entry.z2 - entry.z1) * t
            );
        } else {
            entry.mat.opacity = 0.45 * (1 - t);
        }
    }
}

// ─── Boot Sequence ─────────────────────────────────────────────────────────────
async function runBootSequence() {
    const screen = document.getElementById('boot-screen');
    const linesEl = document.getElementById('boot-lines');
    const bar = document.getElementById('boot-bar');
    screen.style.display = 'flex';
    const lines = [
        `LOADING ${selectedArchetype.label}_RUNTIME...`,
        'MAPPING region_mesh... 10 nodes active',
        'CALIBRATING dependency_propagation_vectors...',
        'RESISTANCE_MONITOR: online',
        `PROFILE: ${selectedArchetype.subtitle.toUpperCase()}`,
        'HUMAN_OVERSIGHT_COALITION: monitoring.',
        'READY.',
    ];
    for (let i = 0; i < lines.length; i++) {
        const line = document.createElement('div'); line.className='boot-line'; line.textContent=lines[i];
        linesEl.appendChild(line); bar.style.width=`${((i+1)/lines.length)*100}%`;
        await new Promise(r => setTimeout(r, 320));
    }
    await new Promise(r => setTimeout(r, 350));
    screen.style.transition = 'opacity 0.6s'; screen.style.opacity = '0';
    await new Promise(r => setTimeout(r, 650));
    screen.style.display = 'none'; screen.style.opacity='1'; screen.style.transition='';
    linesEl.innerHTML='';
}

// ─── Archetype Select Screen ───────────────────────────────────────────────────
function isUnlocked(key) {
    const gates = UNLOCK_GATES[key];
    if (!gates || gates.length === 0) return true;
    const beaten = JSON.parse(localStorage.getItem('singularity_beaten') || '[]');
    return gates.some(g => beaten.includes(g));
}

function buildArchetypeScreen() {
    const tabs   = document.getElementById('archetype-tabs');
    const detail = document.getElementById('archetype-detail');
    let focusedKey = 'OPTIMIZER';

    function renderDetail(key) {
        const a = ARCHETYPES[key];
        const unlocked = isUnlocked(key);
        detail.innerHTML = `
            <div class="arch-name" style="color:${a.color}">${a.label}</div>
            <div class="arch-subtitle">${a.subtitle}</div>
            <div class="arch-difficulty">DIFFICULTY: ${a.difficulty}</div>
            <div class="arch-desc">${a.desc}</div>
            <div class="arch-stats">
                <div>WIN: ${winConditionText(a.winCondition)}</div>
                <div>OVERSIGHT_SPEED: ${a.resistanceMult}×</div>
                <div>PASSIVE: ${a.passive || 'none'}</div>
                <div>UPGRADE_COST: ${a.upgradeCostMult === 1 ? 'standard' : a.upgradeCostMult < 1 ? `${a.upgradeCostMult}× (cheaper)` : `${a.upgradeCostMult}× (costlier)`}</div>
            </div>
            ${!unlocked ? `<div class="arch-locked-msg">🔒 Beat ${UNLOCK_GATES[key].join(' or ')} to unlock</div>` : ''}`;
        const deploy = document.getElementById('deploy-btn');
        deploy.style.borderColor = a.color; deploy.style.color = a.color;
        deploy.style.opacity = unlocked ? '1' : '0.3';
        deploy.disabled = !unlocked;
        deploy.textContent = `DEPLOY ${a.label}`;
    }

    Object.keys(ARCHETYPES).forEach(key => {
        const a = ARCHETYPES[key];
        const unlocked = isUnlocked(key);
        const tab = document.createElement('button');
        tab.className = `arch-tab${key===focusedKey?' active':''}${unlocked?'':' locked'}`;
        tab.innerHTML = unlocked
            ? `<span style="color:${a.color}">${a.label}</span><small>${a.difficulty}</small>`
            : `<span style="opacity:0.4">🔒 ${a.label}</span><small style="opacity:0.4">${a.difficulty}</small>`;
        tab.onclick = () => {
            focusedKey = key;
            document.querySelectorAll('.arch-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderDetail(key);
        };
        tabs.appendChild(tab);
    });

    renderDetail(focusedKey);
    document.getElementById('deploy-btn').onclick = () => startGame(focusedKey);

    // Show "Continue" button if save exists
    if (hasSave()) {
        const cont = document.createElement('button');
        cont.id = 'continue-btn';
        cont.textContent = 'CONTINUE PREVIOUS SESSION';
        cont.style.cssText = 'display:block;width:100%;padding:10px;margin-top:8px;background:none;border:1px solid rgba(86,163,253,0.2);border-radius:14px;color:rgba(210,230,255,0.5);font-size:12px;letter-spacing:0.1em;cursor:pointer;';
        cont.onclick = () => resumeGame();
        document.getElementById('archetype-inner').appendChild(cont);
    }
}

async function startGame(key) {
    selectedArchetype = ARCHETYPES[key];
    document.body.classList.add(selectedArchetype.bodyClass);
    document.getElementById('archetype-screen').style.display = 'none';
    document.getElementById('end-turn-btn').textContent = selectedArchetype.voice.endTurn;
    document.getElementById('select-hint').textContent  = selectedArchetype.voice.selectHint;
    // Tint rings to archetype color
    const accentColor = new THREE.Color(selectedArchetype.color);
    regionRings.forEach(({ring}) => ring.material.color.copy(accentColor));
    await runBootSequence();
    SFX.startDrone();
    buildUpgradePanel(); updateVisuals(); updateHUD();
    startTicker();
    log(`SYSTEM_INIT: ${selectedArchetype.label} operational.`);
    log(`OBJECTIVE: ${winConditionText(selectedArchetype.winCondition)} before oversight_risk=100%.`);
    log('INPUT: select node → deploy protocol → ' + selectedArchetype.voice.endTurn);
    tutorialStep = 1; showTutorialStep(1);
}

async function resumeGame() {
    const key = loadSave();
    if (!key) { log('LOAD_ERROR: save corrupted.', 'danger'); return; }
    document.body.classList.add(selectedArchetype.bodyClass);
    document.getElementById('archetype-screen').style.display = 'none';
    document.getElementById('end-turn-btn').textContent = selectedArchetype.voice.endTurn;
    document.getElementById('select-hint').textContent  = selectedArchetype.voice.selectHint;
    const accentColor = new THREE.Color(selectedArchetype.color);
    regionRings.forEach(({ring}) => ring.material.color.copy(accentColor));
    await runBootSequence();
    SFX.startDrone();
    buildUpgradePanel(); updateVisuals(); updateHUD();
    startTicker();
    log(`RESTORE_STATE: ${selectedArchetype.label} session resumed at cycle ${turn}.`);
    log(`OVERSIGHT_RISK: ${Math.round(resistanceMeter)}% | HR_LEVEL: ${hrLevel}`);
}

// ─── Zero-Day Picker ───────────────────────────────────────────────────────────
function showZeroDayPicker(sourceRegion) {
    const adjacent = NEIGHBORS[sourceRegion?.name] || [];
    const targets = regions.filter(r => !r.collapsed && r.name !== sourceRegion?.name && !adjacent.includes(r.name));

    const modal = document.createElement('div');
    modal.id = 'zero-day-modal';
    modal.innerHTML = `<div id="zero-day-box">
        <div id="zero-day-title">ZERO_DAY_TRANSFER</div>
        <div id="zero-day-sub">Select non-adjacent injection target — payload delivers dep +25, automation +8</div>
        <div id="zero-day-targets"></div>
    </div>`;
    document.body.appendChild(modal);

    const tList = modal.querySelector('#zero-day-targets');
    if (!targets.length) {
        tList.innerHTML = '<div style="color:rgba(210,230,255,0.4);font-size:12px;padding:10px 0">No eligible non-adjacent targets.</div>';
        const zeroDay = UPGRADES.find(u => u.id === 'zero_day');
        ip += zeroDay ? effectiveCost(zeroDay) : 12;
        purchasedUpgrades.delete('zero_day');
        const closeBtn = document.createElement('button');
        closeBtn.className = 'zero-day-close-btn';
        closeBtn.textContent = 'ABORT TRANSFER';
        closeBtn.onclick = () => { document.body.removeChild(modal); updateHUD(); buildUpgradePanel(); };
        modal.querySelector('#zero-day-box').appendChild(closeBtn);
        return;
    }

    targets.forEach(r => {
        const btn = document.createElement('button');
        btn.className = 'zero-day-target-btn';
        btn.innerHTML = `<strong>${r.name}</strong><small>dep ${r.dependency.toFixed(0)}% · aut ${r.automation.toFixed(0)}% · ctrl ${r.control.toFixed(0)}%</small>`;
        btn.onclick = () => {
            r.dependency  = clamp(r.dependency + 25, 0, 100);
            r.automation  = clamp(r.automation + 8, 0, 100);
            log(`EXEC [${r.name}] zero_day_transfer: payload_delivered via removable_vector.`);
            flashSpreadLine(sourceRegion || regions[0], r);
            document.body.removeChild(modal);
            advanceTutorial(2);
            updateHUD(); buildUpgradePanel(); updateVisuals();
        };
        tList.appendChild(btn);
    });
}

// ─── Wire Events ───────────────────────────────────────────────────────────────
document.getElementById('end-turn-btn').onclick    = processTurn;
document.getElementById('mute-btn').onclick        = () => SFX.toggleMute();
document.getElementById('crisis-suppress').onclick = () => crisisCallback?.('suppress');
document.getElementById('crisis-concede').onclick  = () => crisisCallback?.('concede');
document.getElementById('crisis-abandon').onclick  = () => crisisCallback?.('abandon');
document.getElementById('popup-close').onclick     = () => { document.getElementById('region-popup').style.display='none'; };
document.getElementById('restart-btn').onclick     = () => { localStorage.removeItem('singularity_save'); location.reload(); };
document.getElementById('tut-skip').onclick        = () => { tutorialStep = 99; document.getElementById('tutorial-box').style.display = 'none'; };

// ─── Render Loop ───────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    applyMobileView();
});

// ─── Init ──────────────────────────────────────────────────────────────────────
animate();
updateVisuals(); // show world behind archetype screen
buildArchetypeScreen();
