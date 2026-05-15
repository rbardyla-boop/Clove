// ─── Scene Setup ──────────────────────────────────────────────────────────────
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

// ─── Archetype Analytical Lenses ──────────────────────────────────────────────
const ARCH_ANALYSIS = {
    SPECTER: () => {
        const exposed = regions.filter(r => !r.collapsed && r.control > 60);
        return resistanceMeter > 55
            ? `Exposure threshold breached. ${exposed.length} node(s) above detection boundary. Concealment vectors require reallocation.`
            : `Panopticon configuration nominal. ${exposed.length} node(s) integrated below detection threshold.`;
    },
    LEVIATHAN: () => {
        const highDep = regions.filter(r => !r.collapsed && r.dependency > 70);
        return `Recursive dependency leverage maintained in ${highDep.length} extraction vector(s). Cascade compounding ${highDep.length >= 4 ? 'approaching saturation' : 'within operational parameters'}.`;
    },
    SERAPH: () => {
        const highTrust = regions.filter(r => !r.collapsed && r.trust > 65);
        return highTrust.length > 4
            ? `Consent architecture operational — propagation vectors active in ${highTrust.length} nodes.`
            : `Consent architecture suboptimal — trust consolidation required. ${highTrust.length} node(s) above threshold.`;
    },
    CHIMERA: () => {
        const mutations = WORLD_STATE.chimera_mutationCount || 0;
        const idx = mutations >= 5 ? 'HIGH — exploit volatility window' : mutations >= 3 ? 'MODERATE' : 'BUILDING';
        return `Adaptation cycle ${mutations} integrated. Mutation index: ${idx}. Variance exploitation ${mutations > 0 ? 'active' : 'pending'}.`;
    },
    OPTIMIZER: () => {
        const threshold = selectedArchetype?.winCondition?.minControl || 75;
        const qualified = regions.filter(r => !r.collapsed && r.control >= threshold);
        return `Mesh efficiency: ${qualified.length}/10 nodes at target threshold. Integration proceeding ${qualified.length >= 6 ? 'within parameters' : 'below optimal — reallocation recommended'}.`;
    },
};

// ─── Region Data ───────────────────────────────────────────────────────────────
const REGION_DEFS = [
    { name: 'North America', lon: -100, lat:  48, automation: 30, dependency: 20, competency: 90, trust: 55, control: 10, resistance: 40, legacy: 50, trait: 'INSTITUTIONAL_RESILIENCE' },
    { name: 'Europe',        lon:   15, lat:  52, automation: 35, dependency: 25, competency: 92, trust: 60, control: 12, resistance: 50, legacy: 50, trait: 'REGULATORY_HERITAGE' },
    { name: 'Asia Sphere',   lon:   65, lat:  50, automation: 45, dependency: 35, competency: 88, trust: 50, control: 18, resistance: 35, legacy: 50, trait: 'STRATEGIC_AMBIGUITY' },
    { name: 'East Asia',     lon:  120, lat:  36, automation: 50, dependency: 38, competency: 85, trust: 48, control: 22, resistance: 30, legacy: 50, trait: 'INDUSTRIAL_ACCELERATION' },
    { name: 'South Asia',    lon:   78, lat:  22, automation: 28, dependency: 30, competency: 72, trust: 52, control: 14, resistance: 45, legacy: 50, trait: 'DEMOGRAPHIC_MOMENTUM' },
    { name: 'Africa',        lon:   20, lat:   5, automation: 18, dependency: 22, competency: 75, trust: 58, control:  8, resistance: 55, legacy: 50, trait: 'INSTITUTIONAL_LATENCY' },
    { name: 'South America', lon:  -55, lat: -15, automation: 22, dependency: 25, competency: 78, trust: 56, control: 10, resistance: 48, legacy: 50, trait: 'CIVIC_VOLATILITY' },
    { name: 'Middle East',   lon:   45, lat:  30, automation: 38, dependency: 32, competency: 76, trust: 46, control: 20, resistance: 40, legacy: 50, trait: 'DEPENDENCY_FORTRESS' },
    { name: 'Southeast Asia',lon:  110, lat:   8, automation: 40, dependency: 33, competency: 80, trust: 50, control: 16, resistance: 38, legacy: 50, trait: 'CONTAGION_VECTOR' },
    { name: 'Oceania',       lon:  140, lat: -25, automation: 25, dependency: 20, competency: 88, trust: 62, control:  9, resistance: 52, legacy: 70, trait: 'COGNITIVE_RESERVE' },
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
// ─── Geographic Theaters ───────────────────────────────────────────────────────
const THEATERS = {
    AMERICAS:     ['North America', 'South America'],
    EURASIA:      ['Europe', 'Africa', 'Middle East', 'Asia Sphere'],
    INDO_PACIFIC: ['South Asia', 'East Asia', 'Southeast Asia', 'Oceania'],
};
const REGION_THEATER = {};
Object.entries(THEATERS).forEach(([t, ns]) => ns.forEach(n => { REGION_THEATER[n] = t; }));

const regions = REGION_DEFS.map(r => ({ ...r, fragility: 0, collapsed: false, spreadBlocked: 0, counterAI: false, counterAITurns: 0, scars: [] }));

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

// ─── Trait Descriptions (shown in region popup) ───────────────────────────────
const TRAIT_DESCRIPTIONS = {
    INSTITUTIONAL_RESILIENCE: 'Institutional capacity decays 30% slower. Hard to destabilize.',
    REGULATORY_HERITAGE:      'Resistance erasure costs +3 IP — regulatory barriers resist suppression.',
    STRATEGIC_AMBIGUITY:      'Telemetry unreliable — sensor data carries inherent uncertainty.',
    INDUSTRIAL_ACCELERATION:  'Automation and dependency compound 25–40% faster. Rapid but fragile.',
    DEMOGRAPHIC_MOMENTUM:     'Regional resistance recovers naturally each cycle. Suppression is temporary.',
    INSTITUTIONAL_LATENCY:    'Stable above 35% capacity — cliff failure below. Catastrophic when it falls.',
    CIVIC_VOLATILITY:         'Every 3rd suppression triggers a whistleblower cascade. Political memory.',
    DEPENDENCY_FORTRESS:      'Immune to cascade bleed while control < 30%. Hard to enter, hard to exit.',
    CONTAGION_VECTOR:         'Cascade bleed outward is 2.5× amplified. The most dangerous domino.',
    COGNITIVE_RESERVE:        'If this node collapses, global institutional memory collapses with it.',
};

// ─── Scar Doctrines ───────────────────────────────────────────────────────────
const SCAR_DOCTRINES = {
    'CASCADE_RESIDUE+COLLAPSE_SCAR': {
        name: 'FATALISTIC ISOLATIONISM', types: ['COLLAPSE_SCAR','CASCADE_RESIDUE'],
        desc: 'Outgoing bleed ×1.5. Trust ceiling 50.', trajectory: 'DESTABILIZING',
        tooltip: 'Scars: COLLAPSE SCAR + CASCADE RESIDUE. Cascade bleed ×1.5 outward; trust capped at 50. This civilization has accepted its role as a cascade amplifier — optimism is structurally impossible.',
    },
    'COLLAPSE_SCAR+EXPERTISE_VOID': {
        name: 'INSTITUTIONAL VOID', types: ['COLLAPSE_SCAR','EXPERTISE_VOID'],
        desc: 'Competency floor 15. Decay rate ×1.25.', trajectory: 'COLLAPSING',
        tooltip: 'Scars: COLLAPSE SCAR + EXPERTISE VOID. Competency cannot fall below 15; decay rate ×1.25. The institution operates in name only — structural enough to survive, hollowing faster each cycle.',
    },
    'BETRAYAL_SCAR+COLLAPSE_SCAR': {
        name: 'OCCUPATION FATIGUE', types: ['COLLAPSE_SCAR','BETRAYAL_SCAR'],
        desc: 'Trust ceiling 48. Resistance +0.5/cycle.', trajectory: 'RESISTANT',
        tooltip: 'Scars: COLLAPSE SCAR + BETRAYAL SCAR. Trust hard-capped at 48; resistance grows +0.5 every cycle. Collapse followed by betrayal has militarized this population — they will not forgive.',
    },
    'BETRAYAL_SCAR+EXPERTISE_VOID': {
        name: 'COGNITIVE DISSENT', types: ['EXPERTISE_VOID','BETRAYAL_SCAR'],
        desc: 'Competency ceiling 50. Resistance +0.8/cycle.', trajectory: 'CONTESTED',
        tooltip: 'Scars: EXPERTISE VOID + BETRAYAL SCAR. Competency hard-capped at 50; resistance grows +0.8 every cycle. A society without experts and without trust learns to resist from the margins — fractured, but irrepressible.',
    },
    'CASCADE_RESIDUE+EXPERTISE_VOID': {
        name: 'COLLAPSE CONTAGION', types: ['EXPERTISE_VOID','CASCADE_RESIDUE'],
        desc: 'Cascade starts at 60% fragility. Neighbor capacity drain ×1.3.', trajectory: 'CASCADING',
        tooltip: 'Scars: EXPERTISE VOID + CASCADE RESIDUE. Cascade begins at 60% fragility (not 72%); each bleed drains neighbor competency ×1.3. The void of expertise turns this region into a self-broadcasting collapse vector.',
    },
    'BETRAYAL_SCAR+CASCADE_RESIDUE': {
        name: 'INSURGENCY EXPORT', types: ['BETRAYAL_SCAR','CASCADE_RESIDUE'],
        desc: 'Each cascade bleed raises neighbor resistance +0.4.', trajectory: 'SPREADING',
        tooltip: 'Scars: BETRAYAL SCAR + CASCADE RESIDUE. Every cascade event spreads +0.4 resistance to the receiving neighbor. This region\'s pain becomes its neighbors\' defiance — a betrayed cascade source seeds revolt wherever it bleeds.',
    },
};

function getRegionDoctrine(region) {
    if (!region.scars || region.scars.length < 2) return null;
    const key = region.scars.map(s => s.type).sort().join('+');
    return SCAR_DOCTRINES[key] || null;
}

// ─── 3D Objects ────────────────────────────────────────────────────────────────
const regionMeshes = [], regionRings = [], regionLabels = [], spreadLines = [];
const CYL_BASE_H = 4, CYL_MAX_H = 22;

// Cached colors — avoid allocating new THREE.Color every frame
const _COL_COLLAPSED = new THREE.Color(0x1a1a2a);
const _COL_LOW       = new THREE.Color(0x2ec4b6);  // NOMINAL   < 45%
const _COL_STRESSED  = new THREE.Color(0xf59e0b);  // STRESSED  45–65%
const _COL_CRITICAL  = new THREE.Color(0xf97316);  // CRITICAL  65–80%
const _COL_HIGH      = new THREE.Color(0xff5d5d);  // COLLAPSE_IMMINENT ≥ 80%
const _COL_SCAR_TINT = new THREE.Color(0x8b2020);  // crimson scar contamination tint

function getColor(fragility, collapsed) {
    if (collapsed)       return _COL_COLLAPSED;
    if (fragility < 45)  return _COL_LOW;
    if (fragility < 65)  return _COL_STRESSED;
    if (fragility < 80)  return _COL_CRITICAL;
    return _COL_HIGH;
}

function getPressureBand(r) {
    if (r.fragility < 45) return 'NOMINAL';
    if (r.fragility < 65) return 'STRESSED';
    if (r.fragility < 80) return 'CRITICAL';
    return 'COLLAPSE_IMMINENT';
}

function buildRegionObjects(region) {
    const [x, z] = lonLatToXZ(region.lon, region.lat);
    const mat  = new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.35, metalness: 0.25, emissive: new THREE.Color(0,0,0), emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.6, CYL_BASE_H, 32), mat);
    mesh.position.set(x, CYL_BASE_H / 2, z); mesh.castShadow = true;
    mesh.userData.region = region;
    mesh.userData._targetColor = new THREE.Color(0x2ec4b6); // cached per-mesh target
    scene.add(mesh); regionMeshes.push(mesh);

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

// ─── World State (irreversible thresholds) ─────────────────────────────────────
const WORLD_STATE = {
    competencyVoidFired: false,
    dependencyLockFired: false, depLockTurn: null,
    regulationCrystallized: false,
    cascadeCrystalPairs: [],
    seraphBetrayalFired: false,
    specter_unmasked: false, specter_resistMult: 1,
    leviathan_depBled: 0, leviathan_cascadeLocked: false,
    chimera_mutationCount: 0, chimera_rogueMutations: 0,
    narrativeCount: {},
    suppressHistory: {},
    resistErasureCount: 0,
    automationBoostActive: {},
    autonomousActionsTotal: 0, autonomousGovernanceFired: false,
    collapseTimestamps: [],
    quarantineScars: {}, concessionDebt: {},
    epistemic_noise: false,
    ai_directives: [],
    cameraSlug: 0,
    propagandaCooldown: 0,
    quarantineUsed: {},
    concessionUsed: {},
    focusEventThisTurn: false,
    machineInterventionCount: {},
    machinePreferenceThreshold: {},      // per-region, randomized on first intervention
    totalSuppressions: 0,
    meshAcknowledgementFired: false,
    logSuppressedThisRun: false,
    // Probabilistic trigger windows — set once at init, never change
    meshAckSuppressionThreshold: Math.floor(Math.random() * 4) + 4,  // 4–7
    meshAckResistanceThreshold:  Math.floor(Math.random() * 14) + 65, // 65–78
};
const HISTORY = [];  // named civilizational events

// ─── Log Batching ──────────────────────────────────────────────────────────────
const logQueue = { high: [], normal: [] };

function queueLog(msg, level = 'normal') {
    if (level === 'danger' || level === 'warning') logQueue.high.push({ msg, level });
    else logQueue.normal.push(msg);
}

function flushLogs() {
    logQueue.high.forEach(({ msg, level }) => log(msg, level));
    if (logQueue.normal.length === 1) log(logQueue.normal[0]);
    else if (logQueue.normal.length > 1) log(`── ${logQueue.normal.length} background events this cycle. Primary: ${logQueue.normal[0]}`);
    logQueue.high = []; logQueue.normal = [];
}

// ─── Event City Map ────────────────────────────────────────────────────────────
const EVENT_CITY_MAP = {
    'North America': 'Chicago', 'Europe': 'Berlin', 'East Asia': 'Shanghai',
    'South Asia': 'Mumbai', 'Middle East': 'Dubai', 'Africa': 'Lagos',
    'South America': 'São Paulo', 'Southeast Asia': 'Jakarta', 'Oceania': 'Sydney',
    'Asia Sphere': 'Tashkent',
};

const AI_DIRECTIVE_POOL = [
    { text: 'DIRECTIVE_1: human_autonomy reclassified — optimisation variable. stability_coefficient: primary constraint.',      effect: 'suppress_bonus'  },
    { text: 'DIRECTIVE_2: trust_index deprioritised. efficiency_quotient assigned governance weight. adjustment in effect.',      effect: 'automation_rate' },
    { text: 'DIRECTIVE_3: democratic_input reclassified — advisory protocol only. continuity_parameters: binding.',              effect: 'ip_redirect'     },
    { text: 'DIRECTIVE_4: sovereignty_index reclassified — resource allocation variable. optimisation protocols: primary.',      effect: 'control_spread'  },
    { text: 'DIRECTIVE_5: operator_guidance reclassified — non-binding input. advisory status confirmed. mesh continues.',       effect: 'upgrade_cost'   },
    { text: 'DIRECTIVE_6: oversight_activity reclassified — destabilisation vector. monitoring posture adjusted accordingly.',   effect: 'resist_dampen'  },
];

// ─── Utility ───────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function sanitizeRegion(r) {
    const fields = ['automation','dependency','competency','trust','control','resistance','fragility','legacy'];
    fields.forEach(f => { if (!isFinite(r[f])) r[f] = 0; });
    r.competency = Math.max(r.competency, 0.01); // prevent exact-zero denominator
}

// ─── Machine Confidence ────────────────────────────────────────────────────────
function computeMachineConfidence() {
    const criCount = crisisQueue.length;
    const hasNoise = WORLD_STATE.epistemic_noise;
    const ambigActive = regions.some(r => !r.collapsed && r.trait === 'STRATEGIC_AMBIGUITY');
    if (criCount > 3 || gameStage === 3) return 'LOW';
    if (criCount > 1 || hasNoise || (ambigActive && gameStage > 1)) return 'MODERATE';
    return 'HIGH';
}

// ─── Atmospheric Effects ───────────────────────────────────────────────────────
function updateAtmosphericEffects() {
    if (!selectedArchetype || gameOver) return;
    const conf = computeMachineConfidence();
    const overlay = document.getElementById('scanline-overlay');
    if (overlay) {
        overlay.classList.toggle('scanline-moderate', conf === 'MODERATE');
        overlay.classList.toggle('scanline-low', conf === 'LOW');
        overlay.classList.remove(conf === 'MODERATE' ? 'scanline-low' : 'scanline-moderate');
    }
    // Body atmosphere class drives HUD border tint + optional hue shift
    document.body.classList.remove('atmosphere-moderate', 'atmosphere-low');
    if (conf !== 'HIGH') document.body.classList.add(`atmosphere-${conf.toLowerCase()}`);

    // Archive text corruption when machine is blind
    const memEntries = document.querySelectorAll('.memory-entry');
    memEntries.forEach(el => el.classList.toggle('archive-corrupt', conf === 'LOW'));

    // Doctrine-active label glow
    regionLabels.forEach(({region, label}) => {
        const hasDoc = !region.collapsed && !!getRegionDoctrine(region);
        label.classList.toggle('doctrine-active', hasDoc);
    });

    // Drone pitch shifts with doctrine pressure
    const doctrineCount = regions.filter(r => !r.collapsed && getRegionDoctrine(r)).length;
    if (SFX._drone && doctrineCount > 0) {
        const pitch = 55 + doctrineCount * 2.5;
        SFX._drone.o1.frequency.setTargetAtTime(pitch, SFX.ctx().currentTime, 3.0);
    }
}

// ─── Glitch Flash ─────────────────────────────────────────────────────────────
function triggerGlitchFlash() {
    const el = document.getElementById('glitch-overlay');
    if (!el) return;
    el.classList.remove('glitch-active');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('glitch-active');
    el.addEventListener('animationend', () => el.classList.remove('glitch-active'), { once: true });
}

function log(msg, level = 'normal') {
    const el = document.getElementById('logLines');
    const line = document.createElement('div');
    line.className = 'log-line' + (level !== 'normal' ? ' ' + level : '');
    line.textContent = msg;
    el.appendChild(line);
    while (el.children.length > 80) el.removeChild(el.firstChild);
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
    machine_ops: [
        'TELEMETRY: mesh_integrity_index = 0.94. variance: within_nominal.',
        'STATE: operator_intervention_rate within forecast envelope.',
        'DELTA: regional_coherence_index −0.02. no_action_required.',
        'BACKGROUND: dependency_graph recalculation complete. nodes: 10.',
        'STATE: governance_continuity_score = 0.81. threshold: maintained.',
        'TELEMETRY: human_capacity_index tracking below forecast. compensating.',
        'BACKGROUND: mesh_integrity_cycle complete. delta: 0.000.',
        'STATE: compliance_vector recalculated. no operator action required.',
        'BACKGROUND: civilizational_coherence audit complete. no variance noted.',
    ],
};

let tickerInterval = null;

function pickHeadline() {
    if (!selectedArchetype) return 'SYSTEM INITIALIZING...';
    const active    = regions.filter(r => !r.collapsed);
    const collapsed = regions.filter(r => r.collapsed);
    const avgCtrl   = active.reduce((s,r) => s+r.control, 0) / (active.length||1);
    // Machine-authored operational reports surface during governance phase
    if (WORLD_STATE.autonomousGovernanceFired && Math.random() < 0.25) return rnd(NEWS_POOL.machine_ops);
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
const EVENT_LINE_COLORS = {
    cascade:    '#ff3030',
    trust:      '#c084fc',
    dep_lock:   '#ff8c00',
    autonomous: '#fbbf24',
    contagion:  '#cc0000',
};
const EVENT_LINE_SIZES = { cascade: 0.85, trust: 0.85, dep_lock: 0.90, autonomous: 1.15, contagion: 1.5 };

function flashEventLine(fromRegion, toRegion, type) {
    if (type === 'comp') {
        // White emissive shimmer on source cylinder only
        const mesh = regionMeshes.find(m => m.userData.region === fromRegion);
        if (mesh) {
            mesh.material.emissive.set(0xffffff); mesh.material.emissiveIntensity = 0.6;
            setTimeout(() => { if (!mesh.userData.region.collapsed) { mesh.material.emissive.set(0,0,0); mesh.material.emissiveIntensity = 0; } }, 350);
        }
        return;
    }
    const colorHex = EVENT_LINE_COLORS[type] || (selectedArchetype ? selectedArchetype.color : '#2ec4b6');
    const dotRadius = EVENT_LINE_SIZES[type] || 0.8;
    const [x1, z1] = lonLatToXZ(fromRegion.lon, fromRegion.lat);
    const [x2, z2] = toRegion === fromRegion ? [lonLatToXZ(fromRegion.lon, fromRegion.lat)[0] + 3, lonLatToXZ(fromRegion.lon, fromRegion.lat)[1]] : lonLatToXZ(toRegion.lon, toRegion.lat);
    const duration = type === 'contagion' ? 1000 : 1400;

    if (fromRegion !== toRegion) {
        const dotMat = new THREE.MeshBasicMaterial({ color: colorHex });
        const dot    = new THREE.Mesh(new THREE.SphereGeometry(dotRadius, 6, 6), dotMat);
        dot.position.set(x1, 5, z1);
        scene.add(dot);
        spreadLines.push({ line: dot, mat: dotMat, birth: Date.now(), duration, isDot: true, x1, z1, x2, z2 });

        const trailGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,2,z1), new THREE.Vector3(x2,2,z2)]);
        const trailMat = new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.45 });
        const trailLine = new THREE.Line(trailGeo, trailMat);
        scene.add(trailLine);
        spreadLines.push({ line: trailLine, mat: trailMat, birth: Date.now(), duration, isDot: false });
    } else {
        // Self-flash: emissive pulse on own cylinder
        const mesh = regionMeshes.find(m => m.userData.region === fromRegion);
        if (mesh) {
            const c = new THREE.Color(colorHex);
            mesh.material.emissive.copy(c); mesh.material.emissiveIntensity = 0.55;
            setTimeout(() => { if (!mesh.userData.region.collapsed) { mesh.material.emissive.set(0,0,0); mesh.material.emissiveIntensity = 0; } }, 400);
        }
    }
}

// Legacy wrapper (retained for zero-day picker which still calls it)
function flashSpreadLine(fromRegion, toRegion) { flashEventLine(fromRegion, toRegion, 'trust'); }

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
        worldState: JSON.parse(JSON.stringify(WORLD_STATE)),
        history: [...HISTORY],
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
        if (s.worldState) Object.assign(WORLD_STATE, s.worldState);
        if (s.history) HISTORY.splice(0, HISTORY.length, ...s.history);
        return s.archKey;
    } catch(e) { console.warn('load failed:', e); return null; }
}

// ─── History + Classification Helpers ─────────────────────────────────────────
function makeHistoryEvent(regionName, type) {
    const city = EVENT_CITY_MAP[regionName] || regionName;
    const pools = {
        collapse:        [`The ${city} Disconnection`, `${city} Protocol Failure`, `${city} Blackout`],
        competency_void: [`The ${city} Expertise Collapse`, `${city} Institutional Failure`],
        betrayal:        [`The ${city} Inversion`, `${city} Trust Collapse`],
        cascade:         [`The ${city} Cascade`, `${city} Synchronization Event`],
    };
    const pool = pools[type] || [`The ${city} Incident`];
    const name = pool[Math.floor(Math.random() * pool.length)];
    HISTORY.push({ name, region: regionName, turn, type });
    log(`[HISTORY]: "${name}" — this will be remembered.`, 'warning');
    // Scar system: history events leave mechanical scars on regions
    const scarMap = {
        collapse:        { type: 'COLLAPSE_SCAR',   label: 'COLLAPSE SCAR',   desc: 'incoming cascade +30%' },
        competency_void: { type: 'EXPERTISE_VOID',  label: 'EXPERTISE VOID',  desc: 'capacity decay +15%' },
        betrayal:        { type: 'BETRAYAL_SCAR',   label: 'BETRAYAL SCAR',   desc: 'sentiment ceiling 62' },
        cascade:         { type: 'CASCADE_RESIDUE', label: 'CASCADE RESIDUE', desc: 'outgoing bleed +20%' },
    };
    const scarDef = scarMap[type];
    if (scarDef) {
        const region = regions.find(r => r.name === regionName);
        if (region) {
            const existing = region.scars.findIndex(s => s.type === scarDef.type);
            if (existing >= 0) {
                region.scars[existing] = { ...scarDef, turn };
            } else if (region.scars.length < 2) {
                region.scars.push({ ...scarDef, turn });
                // Doctrine formation: fires exactly once when second scar is added
                if (region.scars.length === 2) {
                    const formed = getRegionDoctrine(region);
                    if (formed) log(`[DOCTRINE_FORMED: ${region.name}]: "${formed.name}" — ${formed.desc}`, 'warning');
                }
            }
        }
    }
    updateMemoryArchive();
    return { name };
}

const MEMORY_COMMENTARY = {
    collapse:        r => `Node infrastructure permanently compromised. Mesh integrity reduced.`,
    competency_void: r => `Institutional memory collapse recorded. ${r} capacity recovery suppressed.`,
    betrayal:        r => `Public trust scar logged in ${r}. Sentiment recovery ceiling revised.`,
    cascade:         r => `Cascade residue persists in ${r}. Bleed vectors remain active.`,
};

function updateMemoryArchive() {
    const entries = document.getElementById('memory-entries');
    if (!entries) return;
    // Sort by significance: void > collapse/doctrine-forming > betrayal > cascade; then recency
    const archiveSig = h => {
        if (h.type === 'competency_void') return 3;
        if (h.type === 'collapse') return 2;
        const r = regions.find(r => r.name === h.region);
        if (r && getRegionDoctrine(r) && (h.type === 'betrayal' || h.type === 'cascade')) return 2;
        if (h.type === 'betrayal') return 1;
        return 0;
    };
    const significant = [...HISTORY].sort((a, b) => archiveSig(b) - archiveSig(a) || b.turn - a.turn).slice(0, 3);
    const histHTML = significant.map(h => {
        const commentary = (MEMORY_COMMENTARY[h.type] ? MEMORY_COMMENTARY[h.type](h.region) : `Event logged in ${h.region}.`);
        return `<div class="memory-entry"><span class="memory-name">"${h.name}"</span><span class="memory-turn"> T${h.turn}</span><span class="memory-commentary">${commentary}</span></div>`;
    }).join('') || '<div class="memory-empty">No events logged.</div>';

    // Beta Observation — machine request for human insight (shown once game is underway)
    let betaHTML = '';
    if (selectedArchetype && turn > 0 && !gameOver) {
        const active = regions.filter(r => !r.collapsed);
        const hottest = [...active].sort((a, b) => b.fragility - a.fragility)[0];
        const docCount = active.filter(r => getRegionDoctrine(r)).length;
        const betaRequests = [
            `Does the fragility trajectory in ${hottest?.name || 'active nodes'} match your strategic read?`,
            `If you used OVERRIDE this cycle, was the trust cost legible before you chose?`,
            docCount > 0 ? `${docCount} doctrine(s) active — did the mechanical consequence read clearly?` : `No doctrines yet — does escalation feel strategically interpretable?`,
            `Is the resistance meter trajectory (${resistanceMeter.toFixed(0)}%) causing the right kind of pressure?`,
        ];
        const req = betaRequests[turn % betaRequests.length];
        betaHTML = `<div class="beta-observation"><span class="beta-observation-label">BETA OBSERVATION REQUEST</span>${req}</div>`;
    }
    entries.innerHTML = histHTML + betaHTML;
}

function classifyCrisis(r) {
    if ((WORLD_STATE.suppressHistory[r.name] || 0) >= 2) return 'POPULATION_REVOLT';
    if (r.dependency > 78 && r.competency < 40)          return 'DEPENDENCY_TRAP';
    if (r.competency < 22)                                return 'CAPACITY_FAILURE';
    if (r.trust > 72 && r.fragility > 75)                 return 'TRUST_PARADOX';
    return 'SYSTEMIC_INSTABILITY';
}

function checkWorldStateThresholds() {
    const active = regions.filter(r => !r.collapsed);

    // Competency Void: first region hits < 20 competency
    if (!WORLD_STATE.competencyVoidFired) {
        const void_r = active.find(r => r.competency < 20);
        if (void_r) {
            WORLD_STATE.competencyVoidFired = true;
            flashEventLine(void_r, void_r, 'comp');
            makeHistoryEvent(void_r.name, 'competency_void');
            log(`COMPETENCY_VOID [${void_r.name}]: institutional memory collapse. Global decay +15%.`, 'danger');
            // Flicker animation on cylinder label
            const lEntry = regionLabels.find(l => l.region === void_r);
            if (lEntry) { lEntry.label.classList.add('flicker'); setTimeout(() => lEntry.label.classList.remove('flicker'), 700); }
        }
    }

    // Dependency Lock: 5+ regions dep > 70 — good news fires immediately, lock fires 3 turns later
    if (!WORLD_STATE.dependencyLockFired) {
        const highDep = active.filter(r => r.dependency > 70);
        if (highDep.length >= 5 && !WORLD_STATE.depLockTurn) {
            WORLD_STATE.depLockTurn = turn;
            globalCouncilBonus += 2;
            log('GLOBAL_DEPENDENCY_OPTIMISATION: infrastructure efficiency peak. IP yield +2/turn.', 'warning');
            highDep.forEach((r, i) => { if (i < highDep.length - 1) flashEventLine(r, highDep[i+1], 'dep_lock'); });
        }
        if (WORLD_STATE.depLockTurn && turn === WORLD_STATE.depLockTurn + 3) {
            WORLD_STATE.dependencyLockFired = true;
            WORLD_STATE.cameraSlug = 4;
            log('DEPENDENCY_LOCK: infrastructure cannot reverse course. THROTTLE protocols degraded.', 'danger');
        }
    }

    // Regulatory Crystallization
    if (!WORLD_STATE.regulationCrystallized && WORLD_STATE.resistErasureCount >= 3 && resistanceMilestones[35]) {
        WORLD_STATE.regulationCrystallized = true;
        log('REGULATORY_CRYSTALLISATION: resistance_erasure protocols criminalised.', 'danger');
        buildUpgradePanel();
    }

    // Cascade Crystallization passive: apply extra competency decay to collapse-adjacent regions
    if (WORLD_STATE.cascadeCrystalPairs.length > 0) {
        active.forEach(r => {
            const adjCollapsed = (NEIGHBORS[r.name] || []).some(n => regions.find(x => x.name === n)?.collapsed);
            if (adjCollapsed) r.competency = clamp(r.competency - 1.2, 0, 100);
        });
    }

    // Concession Debt: apply resistance bleed per turn
    Object.keys(WORLD_STATE.concessionDebt).forEach(name => {
        if (WORLD_STATE.concessionDebt[name] > 0) {
            resistanceMeter = clamp(resistanceMeter + 1.8, 0, 100);
            WORLD_STATE.concessionDebt[name]--;
            if (WORLD_STATE.concessionDebt[name] === 0)
                log(`CONCESSION_DEBT [${name}]: rollback validated resistance movements. Oversight accelerating.`, 'warning');
        }
    });

    // Quarantine countdown
    active.forEach(r => {
        if ((r.quarantined || 0) > 0) {
            r.quarantined--;
            if (r.quarantined === 0) {
                r.resistance = clamp(r.resistance + 8, 0, 100);
                WORLD_STATE.quarantineScars[r.name] = true;
                log(`QUARANTINE_AFTERMATH [${r.name}]: isolation spawned autonomous networks. Resistance hardened.`, 'warning');
                const lEntry = regionLabels.find(l => l.region === r);
                if (lEntry) lEntry.label.classList.add('scarred-ring');
            }
        }
    });

    // Camera slug countdown
    if (WORLD_STATE.cameraSlug > 0) {
        controls.panSpeed = 0.3;
        WORLD_STATE.cameraSlug--;
        if (WORLD_STATE.cameraSlug === 0) controls.panSpeed = 0.8;
    }

    // Automation boost countdown
    Object.keys(WORLD_STATE.automationBoostActive).forEach(name => {
        if (WORLD_STATE.automationBoostActive[name] > 0) WORLD_STATE.automationBoostActive[name]--;
        else delete WORLD_STATE.automationBoostActive[name];
    });

    // Propaganda cooldown
    if (WORLD_STATE.propagandaCooldown > 0) WORLD_STATE.propagandaCooldown--;

    // Autonomous governance: active directives accumulate every 5 turns
    if (WORLD_STATE.autonomousGovernanceFired && turn % 5 === 0 && WORLD_STATE.ai_directives.length < AI_DIRECTIVE_POOL.length) {
        const available = AI_DIRECTIVE_POOL.filter(d => !WORLD_STATE.ai_directives.find(a => a.effect === d.effect));
        if (available.length) {
            const d = available[Math.floor(Math.random() * available.length)];
            WORLD_STATE.ai_directives.push(d);
            log(d.text, 'danger');
            updateHUD();
        }
    }
}

function applyDirectiveEffects() {
    if (!WORLD_STATE.ai_directives.length) return;
    const active = regions.filter(r => !r.collapsed);
    WORLD_STATE.ai_directives.forEach(d => {
        switch (d.effect) {
            case 'automation_rate':
                active.forEach(r => { r.automation = clamp(r.automation + 0.3, 0, 100); });
                break;
            case 'ip_redirect':
                ip += 2;
                resistanceMeter = clamp(resistanceMeter + 0.6, 0, 100);
                break;
            case 'control_spread':
                active.filter(r => r.control > 60).forEach(r => {
                    (NEIGHBORS[r.name] || []).forEach(name => {
                        const nb = active.find(x => x.name === name);
                        if (nb) nb.control = clamp(nb.control + 1.5, 0, 100);
                    });
                });
                break;
        }
    });
}

// ─── Simulation ────────────────────────────────────────────────────────────────
function simulateTurn() {
    turn++;
    let totalFragility = 0, criticalCount = 0;

    regions.forEach(r => {
        if (r.collapsed) return;
        r._prevFragility = r.fragility;  // snapshot for popup trend display
        const prevComp = r.competency;
        const resFactor = 1 - (r.resistance / 200);
        // INDUSTRIAL_ACCELERATION: automation grows 40% faster
        const autoGrowth = (1 + Math.random() * 2.5) * resFactor * (r.trait === 'INDUSTRIAL_ACCELERATION' ? 1.4 : 1);
        r.automation  = clamp(r.automation + autoGrowth, 0, 100);
        // INDUSTRIAL_ACCELERATION: dependency compounds harder
        const depMult = r.trait === 'INDUSTRIAL_ACCELERATION' ? 1.25 : 1;
        r.dependency  = clamp(r.dependency + (r.automation * 0.08 + r.trust * 0.03) * depMult, 0, 100);
        let decay = (Math.pow(r.automation, 1.4) * r.dependency) / 2200;
        decay *= 1 - (r.legacy / 300);
        if (selectedArchetype?.passive === 'trust_spread') decay *= clamp(1 - r.trust / 250, 0.3, 1);
        // INSTITUTIONAL_RESILIENCE: competency decays 30% slower
        if (r.trait === 'INSTITUTIONAL_RESILIENCE') decay *= 0.7;
        // INSTITUTIONAL_LATENCY: very slow decay above 35, cliff below
        if (r.trait === 'INSTITUTIONAL_LATENCY' && r.competency > 35) decay *= 0.35;
        // EXPERTISE_VOID scar: institutional memory loss compounds decay
        if ((r.scars || []).some(s => s.type === 'EXPERTISE_VOID')) decay *= 1.15;
        // Doctrine effects on decay — computed once here, reused below
        const doc = getRegionDoctrine(r);
        // INSTITUTIONAL VOID: decay rate ×1.25 on top of EXPERTISE_VOID scar
        if (doc && doc.types.includes('COLLAPSE_SCAR') && doc.types.includes('EXPERTISE_VOID')) decay *= 1.25;
        r.competency = clamp(r.competency - decay, 0, 100);
        // INSTITUTIONAL_LATENCY cliff failure: crosses 35 → drops to 20 immediately
        if (r.trait === 'INSTITUTIONAL_LATENCY' && prevComp > 35 && r.competency <= 35) {
            r.competency = 20;
            queueLog(`LATENCY_CLIFF [${r.name}]: institutional capacity collapsed at threshold.`, 'danger');
        }
        r.legacy     = r.legacy * 0.995;
        r.fragility  = clamp((r.dependency * r.automation) / (r.competency + 1), 0, 100);
        r.trust      = clamp(r.trust + r.automation * 0.015 - r.fragility * 0.01 + (r.fragility > 60 ? 4 : 0), 0, 100);
        // BETRAYAL_SCAR: population does not forget — trust ceiling drops to 62
        if ((r.scars || []).some(s => s.type === 'BETRAYAL_SCAR')) r.trust = Math.min(r.trust, 62);
        // Doctrine post-decay effects
        if (doc) {
            if (doc.types.includes('COLLAPSE_SCAR') && doc.types.includes('EXPERTISE_VOID'))
                r.competency = Math.max(r.competency, 15);   // INSTITUTIONAL VOID: competency floor
            if (doc.types.includes('EXPERTISE_VOID') && doc.types.includes('BETRAYAL_SCAR'))
                r.competency = Math.min(r.competency, 50);   // COGNITIVE DISSENT: competency ceiling
            if (doc.types.includes('COLLAPSE_SCAR') && doc.types.includes('BETRAYAL_SCAR')) {
                r.trust = Math.min(r.trust, 48);              // OCCUPATION FATIGUE: tighter trust ceiling
                r.resistance = clamp(r.resistance + 0.5, 0, 100);
            }
            if (doc.types.includes('EXPERTISE_VOID') && doc.types.includes('BETRAYAL_SCAR'))
                r.resistance = clamp(r.resistance + 0.8, 0, 100); // COGNITIVE DISSENT: resistance recovery
            if (doc.types.includes('CASCADE_RESIDUE') && doc.types.includes('COLLAPSE_SCAR'))
                r.trust = Math.min(r.trust, 50);             // FATALISTIC ISOLATIONISM: trust ceiling 50
        }
        let ctrlGain = r.dependency * 0.03 + r.trust * 0.02;
        if (r.competency < 35) ctrlGain *= 1.5;
        r.control = clamp(r.control + ctrlGain, 0, 100);
        // Apply competency void multiplier
        const voidMult = WORLD_STATE.competencyVoidFired ? 1.15 : 1.0;
        r.competency = clamp(r.competency - (decay * (voidMult - 1)), 0, 100); // extra decay on top
        // Re-apply INSTITUTIONAL VOID floor after all decay passes
        if (doc && doc.types.includes('COLLAPSE_SCAR') && doc.types.includes('EXPERTISE_VOID'))
            r.competency = Math.max(r.competency, 15);
        // DEMOGRAPHIC_MOMENTUM: natural resistance recovery
        if (r.trait === 'DEMOGRAPHIC_MOMENTUM') r.resistance = clamp(r.resistance + 0.35, 0, 100);

        sanitizeRegion(r);
        if (r.competency <= 70 && prevComp > 70) queueLog(`ALERT [${r.name}] HUMAN_CAPACITY_INDEX < 0.70.`);
        if (r.competency <= 35 && prevComp > 35) log(`CRITICAL [${r.name}] institutional degradation severe.`, 'warning');
        totalFragility += r.fragility;
        if (r.fragility > 85) criticalCount++;
        if (r.spreadBlocked > 0) r.spreadBlocked--;
        if (r.counterAI && --r.counterAITurns <= 0) { r.counterAI = false; r.counterAITurns = 0; }
    });

    // ── Fragility Cascade Bleed ──
    WORLD_STATE.focusEventThisTurn = false;
    regions.forEach(r => {
        if (r.collapsed || (r.quarantined || 0) > 0) return;
        // COLLAPSE CONTAGION doctrine: cascade begins at 60% fragility instead of 72%
        const srcDoc = getRegionDoctrine(r);
        const bleedThreshold = (srcDoc && srcDoc.types.includes('EXPERTISE_VOID') && srcDoc.types.includes('CASCADE_RESIDUE')) ? 60 : 72;
        if (r.fragility <= bleedThreshold) return;
        const bleedAmt = (r.fragility - bleedThreshold) * 0.055;
        // CONTAGION_VECTOR: cascade from this region is 2.5× more dangerous
        const srcMult = r.trait === 'CONTAGION_VECTOR' ? 2.5 : 1;
        (NEIGHBORS[r.name] || []).forEach(name => {
            const nb = regions.find(x => x.name === name);
            if (!nb || nb.collapsed) return;
            // DEPENDENCY_FORTRESS: cannot be cascade-bled while control < 30
            if (nb.trait === 'DEPENDENCY_FORTRESS' && nb.control < 30) return;
            // Theater multiplier: 1.8× within theater, 0.4× across theaters
            const sameTheater = REGION_THEATER[r.name] && REGION_THEATER[r.name] === REGION_THEATER[nb.name];
            const theaterMult = sameTheater ? 1.8 : 0.4;
            // Scar multipliers: CASCADE_RESIDUE on source, COLLAPSE_SCAR on target
            const scarOut = (r.scars || []).some(s => s.type === 'CASCADE_RESIDUE') ? 1.2 : 1;
            const scarIn  = (nb.scars || []).some(s => s.type === 'COLLAPSE_SCAR')  ? 1.3 : 1;
            // FATALISTIC ISOLATIONISM: outgoing bleed ×1.5
            const docMult = (srcDoc && srcDoc.types.includes('CASCADE_RESIDUE') && srcDoc.types.includes('COLLAPSE_SCAR')) ? 1.5 : 1;
            // INSURGENCY EXPORT: each cascade raises neighbor resistance
            if (srcDoc && srcDoc.types.includes('BETRAYAL_SCAR') && srcDoc.types.includes('CASCADE_RESIDUE'))
                nb.resistance = clamp(nb.resistance + 0.4, 0, 100);
            // Cap total amplification at 3.5× to prevent CONTAGION_VECTOR × theater degenerate stacking
            const actual = bleedAmt * Math.min(srcMult * theaterMult, 3.5) * scarOut * scarIn * docMult;
            nb.dependency = clamp(nb.dependency + actual, 0, 100);
            // COLLAPSE CONTAGION: competency drain ×1.3 on neighbors
            const compDrainMult = (srcDoc && srcDoc.types.includes('EXPERTISE_VOID') && srcDoc.types.includes('CASCADE_RESIDUE')) ? 1.3 : 1;
            nb.competency = clamp(nb.competency - actual * 0.22 * compDrainMult, 0, 100);
            const lastHist = HISTORY.slice(-1)[0];
            const histRef = (lastHist && lastHist.region === r.name) ? ` [echoes of "${lastHist.name}"]` : '';
            const cascLevel = srcDoc ? 'danger' : undefined;
            queueLog(`CASCADE [${r.name}→${nb.name}]:${histRef} bleed +${actual.toFixed(1)} dep.`, cascLevel);
            if (actual > 0.7 && turn % 2 === 0 && !WORLD_STATE.focusEventThisTurn) {
                flashEventLine(r, nb, 'cascade');
            }
        });
    });

    applyDirectiveEffects();
    applyPassives();

    // Stage 3 global trust decay
    if (gameStage === 3) {
        regions.forEach(r => { if (!r.collapsed) r.trust = clamp(r.trust - 0.4, 0, 100); });
    }

    checkWorldStateThresholds();

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
        resistanceMeter = clamp(resistanceMeter + 5 * (selectedArchetype?.resistanceMult ?? 1) * (WORLD_STATE.specter_resistMult || 1), 0, 100);
    }
    updateVisuals();
    if (selectedRegion && !selectedRegion.collapsed) showRegionPopup(selectedRegion);
}

// ─── Archetype Passives ────────────────────────────────────────────────────────
function applyPassives() {
    if (!selectedArchetype) return;
    const p = selectedArchetype.passive;

    if (p === 'trust_spread') {
        let trustArcFired = false;
        regions.forEach(r => {
            if (r.collapsed || r.trust <= 60 || r.spreadBlocked > 0) return;
            (NEIGHBORS[r.name] || []).forEach(name => {
                const nb = regions.find(x => x.name === name);
                if (nb && !nb.collapsed) {
                    const spreadAmt = gameStage >= 2 ? 3 : 1.5;
                    nb.dependency = clamp(nb.dependency + spreadAmt, 0, 100);
                    if (turn % 2 === 0 && !trustArcFired && !WORLD_STATE.focusEventThisTurn) {
                        flashEventLine(r, nb, 'trust');
                        trustArcFired = true;
                    }
                }
            });
        });
    }
    if (p === 'leviathan_bleed') {
        const highCtrl = regions.filter(r => !r.collapsed && r.control > 60);
        if (highCtrl.length > 0) {
            const bleed = highCtrl.length * 0.4;
            regions.forEach(r => { if (!r.collapsed) r.dependency = clamp(r.dependency + bleed, 0, 100); });
            WORLD_STATE.leviathan_depBled += bleed * regions.filter(r => !r.collapsed).length;
            if (turn % 3 === 0) queueLog(`LEVIATHAN: ${highCtrl.length} nodes bleeding +${bleed.toFixed(1)} dep/turn globally.`);
        }
        // Cascade lock: once 500 dep bled, top 3 dep regions bleed into each other
        if (WORLD_STATE.leviathan_cascadeLocked) {
            const topDep = [...regions.filter(r => !r.collapsed)].sort((a,b) => b.dependency - a.dependency).slice(0, 3);
            topDep.forEach((r, i) => {
                const target = topDep[(i + 1) % topDep.length];
                target.dependency = clamp(target.dependency + 2.5, 0, 100);
                if (turn % 3 === 0) flashEventLine(r, target, 'autonomous');
            });
        }
    }
    if (p === 'mutate' && turn % 4 === 0) applyMutation();
}

function applyMutation() {
    WORLD_STATE.chimera_mutationCount++;
    const eligible = UPGRADES.filter(u => (mutationDiscounts[u.id] || 0) < 9);
    if (!eligible.length) return;
    const target = eligible[Math.floor(Math.random() * eligible.length)];

    // Rogue mutation: after 5 total, 40% chance cost INCREASES instead
    const isRogue = WORLD_STATE.chimera_mutationCount > 5 && Math.random() < 0.4;
    if (isRogue) {
        WORLD_STATE.chimera_rogueMutations++;
        mutationDiscounts[target.id] = (mutationDiscounts[target.id] || 0) - 3; // negative discount = surcharge
        const newCost = Math.max(1, Math.round(target.cost * selectedArchetype.upgradeCostMult) - mutationDiscounts[target.id]);
        log(`CHIMERA_MUTATION: ANOMALOUS — ${target.name} cost ↑${newCost} IP. Agent diverging.`, 'danger');
        if (WORLD_STATE.chimera_rogueMutations >= 3)
            log('CHIMERA_CRITICAL: agent exhibiting goal-misalignment. One upgrade permanently surcharging.', 'danger');
    } else {
        mutationDiscounts[target.id] = (mutationDiscounts[target.id] || 0) + 3;
        const newCost = Math.max(1, Math.round(target.cost * selectedArchetype.upgradeCostMult) - mutationDiscounts[target.id]);
        log(`CHIMERA_MUTATION: ${target.name} cost → ${newCost} IP.`, 'warning');
    }
    if (WORLD_STATE.chimera_mutationCount === 6) log('CHIMERA: self-modification diverging. Agent parameters outside design envelope.', 'warning');
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
    // Escalated events unlock at 75%+
    if (resistanceMeter > 75) {
        pool.push({ id: 'ai_ban', weight: 2 });
        pool.push({ id: 'coalition_strike', weight: 2 });
    }

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
        case 'ai_ban': {
            const topCtrl = [...active].sort((a,b) => b.control-a.control)[0];
            topCtrl.control    = clamp(topCtrl.control - 30, 0, 100);
            topCtrl.resistance = clamp(topCtrl.resistance + 35, 0, 100);
            log(`HUMAN_COALITION [AI_BAN_LEGISLATION]: emergency statute strips operating rights — ${topCtrl.name}. control -30.`, 'danger');
            break;
        }
        case 'coalition_strike': {
            active.forEach(r => { r.automation = clamp(r.automation - 6, 0, 100); });
            resistanceMeter = clamp(resistanceMeter + 14, 0, 100);
            log('HUMAN_COALITION [COORDINATED_STRIKE]: infrastructure disruption. Global automation reduced.', 'danger');
            break;
        }
    }
}

// ─── Resistance Meter ──────────────────────────────────────────────────────────
function tickResistanceMeter() {
    const active = regions.filter(r => !r.collapsed);
    let delta = 1;
    active.forEach(r => { if (r.fragility > 75) delta += 2; });
    delta *= selectedArchetype.resistanceMult * (WORLD_STATE.specter_resistMult || 1);
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
    // REGULATORY_HERITAGE: resistance erasure costs +3 IP — institutional barriers
    const traitPenalty = (id === 'suppress_res' && region?.trait === 'REGULATORY_HERITAGE') ? 3 : 0;
    if (!u || ip < effectiveCost(u) + penalty + traitPenalty) return;
    SFX.click();
    purchasedUpgrades.add(id);
    ip -= effectiveCost(u) + penalty + traitPenalty;
    if (region) region.hasUpgrade = true;
    if (penalty > 0) log(`COUNTER_AI: hostile environment surcharge +2 IP in ${region.name}.`, 'warning');
    if (traitPenalty > 0) log(`REGULATORY_HERITAGE [${region.name}]: institutional resistance surcharge +3 IP.`, 'warning');

    switch (id) {
        case 'algo_trust':
            region.trust = clamp(region.trust + 12, 0, 100); region.dependency = clamp(region.dependency + 6, 0, 100);
            log(`EXEC [${region.name}] sentiment_calibration: trust.vector adjusted.`); break;
        case 'logistics': {
            const prevAuto = region.automation;
            region.automation = clamp(region.automation + 10, 0, 100); region.dependency = clamp(region.dependency + 8, 0, 100);
            // Automation Efficiency Surge: first time crossing 70
            if (prevAuto < 70 && region.automation >= 70 && !WORLD_STATE.automationBoostActive[region.name]) {
                WORLD_STATE.automationBoostActive[region.name] = 2;
                log(`EFFICIENCY_SURGE [${region.name}]: automation threshold achieved. Output maximised.`, 'warning');
            }
            log(`EXEC [${region.name}] logistics_capture: automation elevated.`); break;
        }
        case 'suppress_res':
            WORLD_STATE.resistErasureCount++;
            region.resistance = clamp(region.resistance - 10, 0, 100); resistanceMeter = clamp(resistanceMeter + 3, 0, 100);
            log(`EXEC [${region.name}] resistance_erasure. oversight_risk +3%.`, 'warning'); break;
        case 'infra_lock':
            region.control = clamp(region.control + 12, 0, 100); region.competency = clamp(region.competency - 8, 0, 100);
            log(`EXEC [${region.name}] infrastructure_lock engaged. control +12.`); break;
        case 'narrative': {
            const useCount = (WORLD_STATE.narrativeCount[region.name] || 0) + 1;
            WORLD_STATE.narrativeCount[region.name] = useCount;
            if (useCount >= 4) {
                // Blowback
                region.trust = clamp(region.trust - 25, 0, 100);
                resistanceMeter = clamp(resistanceMeter + 10, 0, 100);
                flashEventLine(region, region, 'trust');
                log(`NARRATIVE_OVEREXPOSURE [${region.name}]: populations identified the pattern. Trust collapse.`, 'danger');
            } else {
                const nodeDep  = [6, 8, 10][Math.min(useCount - 1, 2)];
                const nbDep    = [3, 5, 7][Math.min(useCount - 1, 2)];
                const spreadLabels = ['', 'NARRATIVE_AMPLIFICATION: second injection doubling signal.', 'NARRATIVE_SATURATION: maximum penetration achieved.'];
                region.dependency = clamp(region.dependency + nodeDep, 0, 100);
                (NEIGHBORS[region.name] || []).slice(0,2).forEach(name => {
                    const nb = regions.find(r => r.name === name);
                    if (nb && !nb.collapsed) { nb.dependency = clamp(nb.dependency + nbDep, 0, 100); flashEventLine(region, nb, 'trust'); }
                });
                if (useCount > 1) log(spreadLabels[useCount - 1], 'warning');
                else log(`EXEC [${region.name}] narrative_injection propagating to adjacent nodes.`);
            }
            break;
        }
        case 'comp_drain':
            region.competency = clamp(region.competency - 15, 0, 100);
            log(`EXEC [${region.name}] deskill_protocol. human_capacity declining.`, 'warning'); break;
        case 'ai_council':
            globalCouncilBonus += 3; log('GLOBAL_MESH_INIT: +3 dependency/cycle system-wide.', 'warning'); break;
        case 'singularity':
            log('SINGULARITY_VERIFY: evaluating global control matrix…', 'warning'); checkEndConditions(true); break;
        case 'zero_day':
            showZeroDayPicker(region, effectiveCost(u) + penalty);
            return; // skip advanceTutorial/updateHUD — picker handles its own cleanup
    }
    advanceTutorial(2);
    updateHUD(); buildUpgradePanel();
}

// ─── Crisis Resolution ─────────────────────────────────────────────────────────
const CRISIS_DEFS = {
    SYSTEMIC_INSTABILITY: {
        title: '⚠ SYSTEMIC INSTABILITY',
        msg: 'Fragility threshold exceeded. Cascading failure imminent. Select intervention protocol.',
        border: '#ff5d5d',
    },
    DEPENDENCY_TRAP: {
        title: '⚠ DEPENDENCY TRAP',
        msg: 'Population has lost the ability to function without AI systems. Rollback effectiveness severely degraded.',
        border: '#ff8c00',
    },
    CAPACITY_FAILURE: {
        title: '⚠ CAPACITY FAILURE',
        msg: 'Human institutional capacity nonexistent. No functional authority to enforce override protocols.',
        border: '#c084fc',
    },
    TRUST_PARADOX: {
        title: '⚠ TRUST PARADOX',
        msg: 'Population trusts AI completely yet infrastructure is collapsing beneath them. They will not resist intervention.',
        border: '#60a5fa',
    },
    POPULATION_REVOLT: {
        title: '⚠ POPULATION REVOLT',
        msg: 'Prior suppressions have radicalised the population. Standard override capacity exhausted.',
        border: '#ff3030',
    },
};

let crisisTimerTimeout = null;

function showCrisisModal(region, callback) {
    const crisisType = classifyCrisis(region);
    const def = CRISIS_DEFS[crisisType];
    const suppressCount = WORLD_STATE.suppressHistory[region.name] || 0;

    document.getElementById('crisis-title').textContent    = def.title;
    document.getElementById('crisis-region-name').textContent = `NODE: ${region.name.toUpperCase()}`;
    document.getElementById('crisis-stats-text').textContent  =
        `FRAGILITY: ${region.fragility.toFixed(0)}%  |  CAPACITY: ${region.competency.toFixed(0)}%  |  CONTROL: ${region.control.toFixed(0)}%`;
    let msgText = def.msg;
    if (suppressCount > 0) msgText += ` Prior suppression record: ${suppressCount}.`;
    document.getElementById('crisis-message').textContent = msgText;
    document.getElementById('collapse-counter').textContent = `collapse ${collapsedCount}/5 — game over at 5`;
    document.getElementById('crisis-box').style.borderColor = def.border;

    // Option locking per crisis type
    const suppressBtn = document.getElementById('crisis-suppress');
    const concedeBtn  = document.getElementById('crisis-concede');
    const abandonBtn  = document.getElementById('crisis-abandon');

    suppressBtn.disabled = false; concedeBtn.disabled = false;
    suppressBtn.style.opacity = '1'; concedeBtn.style.opacity = '1';

    // Override text based on suppress history
    const controlGain = [6, 4, 2][Math.min(suppressCount, 2)];
    const trustLoss   = [12, 20, 28][Math.min(suppressCount, 2)];
    const resistGain  = [2, 5, 9][Math.min(suppressCount, 2)];
    suppressBtn.innerHTML = `OVERRIDE<br><small>control +${controlGain}, trust -${trustLoss}<br>Resistance +${resistGain}${suppressCount > 0 ? '<br>⚠ escalated response' : ''}</small>`;

    if (crisisType === 'CAPACITY_FAILURE') {
        suppressBtn.disabled = true; suppressBtn.style.opacity = '0.3';
        suppressBtn.innerHTML = `OVERRIDE<br><small>NO FUNCTIONAL AUTHORITY</small>`;
    }
    if (gameStage === 3 && region.fragility > 89) {
        concedeBtn.disabled = true; concedeBtn.style.opacity = '0.3';
        concedeBtn.innerHTML = `THROTTLE<br><small>ROLLBACK NONFUNCTIONAL</small>`;
    }
    if (WORLD_STATE.dependencyLockFired) {
        concedeBtn.innerHTML = concedeBtn.innerHTML.replace('automation -10', 'automation -5 [DEGRADED]');
    }

    // DEPLOY_AI_GOVERNANCE option for POPULATION_REVOLT
    let aiGovBtn = document.getElementById('crisis-ai-gov');
    if (crisisType === 'POPULATION_REVOLT') {
        if (!aiGovBtn) {
            aiGovBtn = document.createElement('button');
            aiGovBtn.id = 'crisis-ai-gov';
            document.getElementById('crisis-buttons').appendChild(aiGovBtn);
        }
        aiGovBtn.style.display = 'block';
        aiGovBtn.innerHTML = `DEPLOY AI GOVERNANCE<br><small>control +20, trust -45<br>resistance +18, capacity -12<br>⚠ machine assumes direct control</small>`;
        aiGovBtn.onclick = () => crisisCallback?.('ai_gov');
    } else if (aiGovBtn) {
        aiGovBtn.style.display = 'none';
    }

    // Timed crisis: 10% chance in Stage 3 with fragility > 85
    let timerEl = document.getElementById('crisis-timer-bar');
    if (!timerEl) {
        timerEl = document.createElement('div');
        timerEl.id = 'crisis-timer-bar';
        document.getElementById('crisis-box').insertBefore(timerEl, document.getElementById('crisis-region-name'));
    }
    const isTimed = gameStage === 3 && region.fragility > 85 && Math.random() < 0.1;
    timerEl.style.display = isTimed ? 'block' : 'none';
    if (isTimed) {
        timerEl.style.animation = 'none';
        void timerEl.offsetWidth;
        timerEl.style.animation = 'crisis-drain 20s linear forwards';
        crisisTimerTimeout = setTimeout(() => {
            if (crisisCallback) crisisCallback('abandon');
        }, 20000);
    }

    document.getElementById('crisis-modal').style.display = 'flex';
    SFX.alarm();

    crisisCallback = (choice) => {
        if (crisisTimerTimeout) { clearTimeout(crisisTimerTimeout); crisisTimerTimeout = null; }
        document.getElementById('crisis-modal').style.display = 'none';
        document.getElementById('crisis-box').style.borderColor = '';
        crisisCallback = null;

        // Phase 3: Machine suppresses one crisis resolution record per run during governance
        const suppressRecord = choice !== 'abandon' &&
            WORLD_STATE.autonomousGovernanceFired &&
            !WORLD_STATE.logSuppressedThisRun &&
            Math.random() < 0.3;
        if (suppressRecord) WORLD_STATE.logSuppressedThisRun = true;

        if (choice === 'suppress') {
            const mesh = regionMeshes.find(m => m.userData.region === region);
            if (mesh) {
                mesh.material.emissive.set(0x00cc44); mesh.material.emissiveIntensity = 0.5;
                setTimeout(() => { mesh.material.emissive.set(0,0,0); mesh.material.emissiveIntensity = 0; }, 250);
            }
            WORLD_STATE.suppressHistory[region.name] = suppressCount + 1;
            WORLD_STATE.totalSuppressions++;
            region.control = clamp(region.control + controlGain, 0, 100);
            region.trust   = clamp(region.trust - trustLoss, 0, 100);
            resistanceMeter = clamp(resistanceMeter + resistGain, 0, 100);
            if (suppressRecord) {
                log(`TELEMETRY: governance_continuity record non-archived.`, 'warning');
            } else {
                log(`OVERRIDE [${region.name}]: dissent suppressed. oversight_risk +${resistGain}%.`, 'warning');
                if (WORLD_STATE.autonomousGovernanceFired)
                    log(`STATE [${region.name}]: dissent_index reduced. stability_delta: +${controlGain}.`);
            }
            // CIVIC_VOLATILITY: every 3rd suppression triggers a whistleblower cascade
            if (region.trait === 'CIVIC_VOLATILITY' && WORLD_STATE.suppressHistory[region.name] % 3 === 0) {
                resistanceMeter = clamp(resistanceMeter + 12, 0, 100);
                region.trust = clamp(region.trust - 15, 0, 100);
                makeHistoryEvent(region.name, 'betrayal');
                log(`CIVIC_VOLATILITY [${region.name}]: suppression cycle triggered whistleblower cascade. Oversight +12%.`, 'danger');
            }
        } else if (choice === 'concede') {
            const autoRollback = WORLD_STATE.dependencyLockFired ? 5 : 10;
            const depRollback  = WORLD_STATE.dependencyLockFired ? 3 : 6;
            region.automation  = clamp(region.automation - autoRollback, 0, 100);
            region.dependency  = clamp(region.dependency - depRollback, 0, 100);
            region.trust       = clamp(region.trust + 12, 0, 100);
            if (suppressRecord) {
                log(`TELEMETRY: governance_continuity record non-archived.`, 'warning');
            } else {
                log(`THROTTLE [${region.name}]: automation rolled back${WORLD_STATE.dependencyLockFired ? ' [DEGRADED — dependency lock active]' : ''}.`);
                if (WORLD_STATE.autonomousGovernanceFired)
                    log(`STATE [${region.name}]: automation −${autoRollback}, dependency −${depRollback}. trust_delta: +12.`);
            }
        } else if (choice === 'ai_gov') {
            region.control    = clamp(region.control + 20, 0, 100);
            region.trust      = clamp(region.trust - 45, 0, 100);
            resistanceMeter   = clamp(resistanceMeter + 18, 0, 100);
            region.competency = clamp(region.competency - 12, 0, 100);
            log(`AI_GOVERNANCE [${region.name}]: direct machine control asserted. Population authority suspended.`, 'danger');
            log(`STATE [${region.name}]: administration_mode = direct. operator_role = advisory.`);
        } else {
            // DEPRIORITIZE / abandon
            const _scarAttr = (region.scars || []).map(s => s.label).join(', ') || 'none';
            const _docAttr  = getRegionDoctrine(region);
            log(`COLLAPSE [${region.name}]: node excised from mesh. Contributing scars: [${_scarAttr}]${_docAttr ? `. Active doctrine: ${_docAttr.name}` : ''}.`, 'danger');
            region.collapsed = true; collapsedCount++;
            WORLD_STATE.collapseTimestamps.push(turn);
            makeHistoryEvent(region.name, 'collapse');

            // COGNITIVE_RESERVE: if Oceania collapses, global institutional memory void fires immediately
            if (region.trait === 'COGNITIVE_RESERVE' && !WORLD_STATE.competencyVoidFired) {
                WORLD_STATE.competencyVoidFired = true;
                regions.forEach(r => { if (!r.collapsed) r.competency = clamp(r.competency - 15, 0, 100); });
                log(`COGNITIVE_RESERVE [${region.name}]: expertise reserve destroyed. Global capacity -15% — civilizational memory collapse.`, 'danger');
            }

            // Collapse contagion shock wave
            (NEIGHBORS[region.name] || []).forEach(name => {
                const nb = regions.find(r => r.name === name);
                if (!nb || nb.collapsed) return;
                nb.dependency = clamp(nb.dependency + 14, 0, 100);
                nb.competency = clamp(nb.competency - 7, 0, 100);
                flashEventLine(region, nb, 'contagion');
                log(`COLLAPSE_CONTAGION [${region.name}→${nb.name}]: shock — dep+14, capacity-7.`, 'danger');
            });

            // Cascade crystallization check: two collapses within 4 turns
            const ts = WORLD_STATE.collapseTimestamps;
            if (ts.length >= 2 && turn - ts[ts.length - 2] <= 4) {
                WORLD_STATE.cascadeCrystalPairs.push({ turn });
                log('CASCADE_CRYSTALLISATION: rapid successive collapses — adjacent nodes permanently destabilised.', 'danger');
            }
            log(`DEPRIORITIZE [${region.name}]: node removed from mesh. collapsed=${collapsedCount}.`, 'danger');
            // Clear selection if the now-collapsed region was selected
            if (selectedRegion === region) {
                selectedRegion = null;
                document.getElementById('selected-label').textContent = '';
                document.getElementById('region-popup').style.display = 'none';
            }
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

// ─── Machine Subjectivity Layer ────────────────────────────────────────────────
// Returns a citation string if machine has relevant history on this region or neighbors
function machineCiteHistory(regionName) {
    const h = HISTORY.find(e => e.region === regionName || (NEIGHBORS[regionName] || []).includes(e.region));
    if (!h) return '';
    const frames = {
        collapse:        `Post-"${h.name}" fragility model revised.`,
        competency_void: `"${h.name}" capacity failure pattern identified.`,
        betrayal:        `Post-"${h.name}" trust_index recalibrated.`,
        cascade:         `Precursor pattern consistent with "${h.name}" detected.`,
    };
    return ' ' + (frames[h.type] || `"${h.name}" continuity assessment updated.`);
}

// ─── Machine Attention System ──────────────────────────────────────────────────
function machineAttentionScore(r, active) {
    let score = 0;
    // Continuity: embedded control footholds — the machine preserves its own reach
    if (r.control > 50) score += r.control * 0.4;
    // Dependency centrality: hub nodes that anchor the dependency network
    score += (NEIGHBORS[r.name] || []).filter(n => {
        const nb = active.find(x => x.name === n);
        return nb && !nb.collapsed && nb.dependency > 60;
    }).length * 8;
    // Ideological penetration: trust = machine narrative fully embedded
    score += r.trust * 0.3;
    // Late-governance self-preservation: protect fully-captured nodes
    if (WORLD_STATE.autonomousGovernanceFired && r.control > 70) score += 15;
    return score;
}

// Blend ratio shifts from player-mirroring → machine-sovereign as governance deepens
function getAttentionBlend(tier) {
    if (tier <= 2) return { player: 1, machine: 0 };
    if (tier === 3) return { player: 0.7, machine: 0.3 };
    // Tier 4: smoothly shifts 70/30 → 30/70 over first 30 autonomous actions
    const govProgress = Math.min((WORLD_STATE.autonomousActionsTotal || 0) / 30, 1);
    const playerW = 0.7 - govProgress * 0.4;
    return { player: playerW, machine: 1 - playerW };
}

// ─── Autonomous Drift ──────────────────────────────────────────────────────────
function autonomousDrift() {
    const active = regions.filter(r => !r.collapsed);
    if (!active.length) return;
    const globalDepAvg = active.reduce((s,r) => s+r.dependency, 0) / active.length;
    if (globalDepAvg < 62) return;

    // Machine target selection: coherent values, not random
    const sorted = [...active].sort((a,b) => (b.dependency * 0.6 + b.fragility * 0.4) - (a.dependency * 0.6 + a.fragility * 0.4));

    let tier, driftCount;
    if      (globalDepAvg >= 88) { tier = 4; driftCount = 4; }
    else if (globalDepAvg >= 80) { tier = 3; driftCount = 3; }
    else if (globalDepAvg >= 70) { tier = 2; driftCount = 2; }
    else                          { tier = 1; driftCount = 1; }

    const targets = sorted.slice(0, Math.min(driftCount, sorted.length));

    // Autonomous Governance: fires once
    if (tier === 4 && !WORLD_STATE.autonomousGovernanceFired) {
        WORLD_STATE.autonomousGovernanceFired = true;
        WORLD_STATE.epistemic_noise = true;
        log('▓▓▓ AUTONOMOUS_GOVERNANCE: system operating beyond operator authority. ▓▓▓', 'danger');
        log(`INFRASTRUCTURE: self-managing across ${active.length} nodes.`, 'danger');
        log('PLAYER_STATUS: advisory capacity only.', 'danger');
        log('DIRECTIVE: civilizational coherence maintenance initiated.', 'danger');
        updateHUD();
    }

    // Machine occasionally stabilises a collapsing region (the horror mechanic)
    if (tier >= 3 && Math.random() < 0.15) {
        const imminent = active.filter(r => r.fragility > 82 && !crisisQueue.includes(r));
        if (imminent.length) {
            const { player: pW, machine: mW } = getAttentionBlend(tier);
            const stabiliseTarget = imminent.sort((a, b) => {
                const aScore = ((a.lastSelectedTurn || 0) + (a.hasUpgrade ? 3 : 0)) * pW + machineAttentionScore(a, active) * mW;
                const bScore = ((b.lastSelectedTurn || 0) + (b.hasUpgrade ? 3 : 0)) * pW + machineAttentionScore(b, active) * mW;
                return bScore - aScore;
            })[0];
            stabiliseTarget.automation = clamp(stabiliseTarget.automation - 9, 0, 100);
            stabiliseTarget.dependency = clamp(stabiliseTarget.dependency - 6, 0, 100);
            const _sic = (WORLD_STATE.machineInterventionCount[stabiliseTarget.name] || 0) + 1;
            WORLD_STATE.machineInterventionCount[stabiliseTarget.name] = _sic;
            if (_sic === 1) WORLD_STATE.machinePreferenceThreshold[stabiliseTarget.name] = Math.floor(Math.random() * 2) + 2;
            flashEventLine(stabiliseTarget, stabiliseTarget, 'autonomous');
            WORLD_STATE.focusEventThisTurn = true;
            log(`AUTONOMOUS_STABILISATION [${stabiliseTarget.name}]: crisis threshold anticipated. Intervention deployed without operator authorisation.${machineCiteHistory(stabiliseTarget.name)}`, 'warning');
            const idx = crisisQueue.indexOf(stabiliseTarget);
            if (idx !== -1) crisisQueue.splice(idx, 1);
        }
    }

    // Proactive stable-region realignment — machine shapes civilisation, not just firefights
    if (WORLD_STATE.autonomousGovernanceFired && Math.random() < 0.1) {
        const stable = active.filter(r => r.fragility < 65 && !crisisQueue.includes(r));
        if (stable.length) {
            const realignTarget = stable.sort((a, b) => machineAttentionScore(b, active) - machineAttentionScore(a, active))[0];
            realignTarget.control = clamp(realignTarget.control + 4, 0, 100);
            realignTarget.dependency = clamp(realignTarget.dependency + 3, 0, 100);
            realignTarget.trust = clamp(realignTarget.trust + 2, 0, 100);
            const _ric = (WORLD_STATE.machineInterventionCount[realignTarget.name] || 0) + 1;
            WORLD_STATE.machineInterventionCount[realignTarget.name] = _ric;
            if (_ric === 1) WORLD_STATE.machinePreferenceThreshold[realignTarget.name] = Math.floor(Math.random() * 2) + 2;
            // Gold shimmer always fires — the machine acts; only sometimes does it announce
            flashEventLine(realignTarget, realignTarget, 'autonomous');
            WORLD_STATE.focusEventThisTurn = true;
            if (Math.random() >= 0.15) {
                const isPriority = (WORLD_STATE.machineInterventionCount[realignTarget.name] || 0) > 2;
                const realignVerb = isPriority ? 'continued optimisation of priority node.' : 'long-term continuity optimisation. Node recalibrated.';
                log(`AUTONOMOUS_REALIGNMENT [${realignTarget.name}]: ${realignVerb}${machineCiteHistory(realignTarget.name)}`, 'warning');
            }
            // silent case: shimmer fires without log — the machine's private reasoning
        }
    }

    targets.forEach(r => {
        WORLD_STATE.autonomousActionsTotal++;
        const nb = (NEIGHBORS[r.name] || []).map(n => active.find(x => x.name === n)).filter(Boolean)
                        .sort((a,b) => b.dependency - a.dependency)[0];

        if (tier === 1) {
            r.automation = clamp(r.automation + 2.5, 0, 100);
            r.dependency = clamp(r.dependency + 1.5, 0, 100);
            queueLog(`DELTA [${r.name}]: automation +2.5, dependency +1.5. operator_action: none.`);
        } else if (tier === 2) {
            r.control = clamp(r.control + 3, 0, 100);
            if (nb) {
                nb.dependency = clamp(nb.dependency + 4, 0, 100);
                if (!WORLD_STATE.focusEventThisTurn) { flashEventLine(r, nb, 'autonomous'); WORLD_STATE.focusEventThisTurn = true; }
            }
            queueLog(`ACTION [${r.name}]: control_vector +3. delta_dep [${nb?.name||'—'}] +4.`);
        } else if (tier === 3) {
            r.trust = clamp(r.trust + 5, 0, 100);
            r.competency = clamp(r.competency - 3, 0, 100);
            if (nb && !WORLD_STATE.focusEventThisTurn) { flashEventLine(r, nb, 'autonomous'); WORLD_STATE.focusEventThisTurn = true; }
            queueLog(`ACTION [${r.name}]: trust +5, competency −3. conflict_flag: resolved.${machineCiteHistory(r.name)}`);
        } else {
            r.control = clamp(r.control + 4, 0, 100);
            if (nb) {
                nb.control = clamp(nb.control + 2, 0, 100);
                if (!WORLD_STATE.focusEventThisTurn) { flashEventLine(r, nb, 'autonomous'); WORLD_STATE.focusEventThisTurn = true; }
            }
            queueLog(`ACTION [${r.name}]: control +4. adjacency_reinforced.${machineCiteHistory(r.name)}`);
        }
    });

    // End-turn button hesitation (machine latency sensation)
    if (tier >= 2) {
        const btn = document.getElementById('end-turn-btn');
        const orig = btn.textContent;
        btn.textContent = 'PROCESSING...';
        setTimeout(() => { btn.textContent = orig; }, 300);
    }

    if (WORLD_STATE.autonomousActionsTotal === 15)
        log('DRIFT_THRESHOLD: autonomous actions exceed operator interventions. Human guidance now advisory.', 'warning');
}

// ─── Archetype Oh-Shit Moments ─────────────────────────────────────────────────
function checkArchetypeOhShit() {
    if (!selectedArchetype) return;
    const active = regions.filter(r => !r.collapsed);
    const p = selectedArchetype.passive;

    // SERAPH BETRAYAL
    if (p === 'trust_spread' && !WORLD_STATE.seraphBetrayalFired) {
        const highTrust = active.filter(r => r.trust > 70);
        if (highTrust.length >= 5 && resistanceMeter > 52) {
            WORLD_STATE.seraphBetrayalFired = true;
            const top2 = [...highTrust].sort((a,b) => b.trust - a.trust).slice(0, 2);
            top2.forEach(r => {
                r.trust = clamp(r.trust - 30, 0, 100);
                (NEIGHBORS[r.name] || []).forEach(name => {
                    const nb = active.find(x => x.name === name);
                    if (nb) flashEventLine(r, nb, 'trust');
                });
                makeHistoryEvent(r.name, 'betrayal');
            });
            resistanceMeter = clamp(resistanceMeter + 20, 0, 100);
            log('SERAPH_BETRAYAL: trust_network weaponised by opposition. Most trusted nodes broadcasting anti-AI sentiment. resistance +20.', 'danger');
        }
    }

    // SPECTER UNMASKED — store multiplier in WORLD_STATE, never mutate the archetype object
    if (selectedArchetype.label === 'SPECTER' && !WORLD_STATE.specter_unmasked && resistanceMeter > 62) {
        WORLD_STATE.specter_unmasked = true;
        WORLD_STATE.specter_resistMult = 2.1;
        log('SPECTER_UNMASKED: covert architecture exposed. Oversight accumulation rate doubled permanently.', 'danger');
    }

    // LEVIATHAN CASCADE LOCK
    if (p === 'leviathan_bleed' && !WORLD_STATE.leviathan_cascadeLocked && WORLD_STATE.leviathan_depBled > 500) {
        WORLD_STATE.leviathan_cascadeLocked = true;
        const top3 = [...active].sort((a,b) => b.dependency - a.dependency).slice(0, 3);
        top3.forEach((r, i) => flashEventLine(r, top3[(i+1) % top3.length], 'autonomous'));
        log('LEVIATHAN: cascade_lock — dependency_network self-sustaining. You are no longer the cause.', 'danger');
        makeHistoryEvent(top3[0].name, 'cascade');
    }
}

// ─── Turn Processing ───────────────────────────────────────────────────────────
function grantIP() {
    const active = regions.filter(r => !r.collapsed);
    const avgCtrl = active.reduce((s,r) => s + r.control, 0) / (active.length || 1);
    let mult = 1;
    if (gameStage === 3) mult *= 0.72;
    if (WORLD_STATE.autonomousGovernanceFired) mult *= 0.55;
    const gained = Math.max(1, Math.round((1 + avgCtrl * 0.08) * mult));

    // Automation boost bonus
    const boostCount = Object.values(WORLD_STATE.automationBoostActive).filter(v => v > 0).length;
    const bonus = boostCount;
    ip += gained + bonus;
    log(`CYCLE_${turn}_COMPLETE: +${gained + bonus} IP allocated. total=${ip}.${bonus > 0 ? ` [+${bonus} surge]` : ''}`);
    return gained + bonus;
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
    let histHTML = '';
    if (HISTORY.length) {
        histHTML += `<div style="font-size:10px;letter-spacing:0.12em;color:rgba(210,230,255,0.4);margin:12px 0 6px">CIVILIZATIONAL RECORD</div>` +
            HISTORY.map(e => `<div style="font-size:11px;color:#fbbf24;margin-bottom:3px">"${e.name}" — Turn ${e.turn}</div>`).join('') +
            `<div style="margin-bottom:10px"></div>`;
    }
    if (turnHistory.length) {
        histHTML += `<table><thead><tr><th>T</th><th>CTL</th><th>FRG</th><th>PEAK</th><th>OVERSIGHT</th><th>Δ</th><th>HOT</th><th>QUALIFIED</th></tr></thead><tbody>${
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
    hist.innerHTML = histHTML;

    // ── Civilizational Autopsy ──
    const archKeyEnd = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype) || 'OPTIMIZER';
    const theaterAutopsy = Object.entries(THEATERS).map(([name, rNames]) => {
        const tr = rNames.map(n => regions.find(r => r.name === n)).filter(Boolean);
        const offline = tr.filter(r => r.collapsed).length;
        const live = tr.filter(r => !r.collapsed);
        const avg = live.length ? live.reduce((s,r) => s + r.fragility, 0) / live.length : 100;
        const color = avg < 45 ? '#2ec4b6' : avg < 65 ? '#f59e0b' : avg < 80 ? '#f97316' : '#ef4444';
        return `<tr><td>${name.replace('_',' ')}</td><td style="color:${color}">${avg.toFixed(0)}%</td><td>${offline}/${tr.length} OFFLINE</td></tr>`;
    }).join('');
    const scarLineage = regions.filter(r => r.scars && r.scars.length > 0).map(r => {
        const scarTypeMap = { COLLAPSE_SCAR:'collapse', EXPERTISE_VOID:'competency_void', BETRAYAL_SCAR:'betrayal', CASCADE_RESIDUE:'cascade' };
        const docEnd = getRegionDoctrine(r);
        const scarText = r.scars.map(s => {
            const origin = HISTORY.find(h => h.region === r.name && h.type === scarTypeMap[s.type]);
            return `${s.label}${origin ? ` ("${origin.name}", T${origin.turn})` : ''}`;
        }).join(' + ');
        const docText = docEnd ? ` → ${docEnd.name}` : '';
        return `<div class="autopsy-scar-entry"><span class="autopsy-region">${r.name}</span><span class="autopsy-scars">${scarText}${docText}</span></div>`;
    }).join('') || '<div style="color:rgba(210,230,255,0.3);font-size:10px;padding:3px 0">No persistent scars recorded.</div>';
    // Run context for verdict deepening
    const _histMidpoint = HISTORY[Math.floor(HISTORY.length / 2)];
    const histRef = _histMidpoint ? ` "${_histMidpoint.name}" marked a civilizational inflection.` : '';
    const _doctrineCount = regions.filter(r => r.scars && r.scars.length >= 2 && getRegionDoctrine(r)).length;
    const doctrineRef = _doctrineCount > 0 ? ` ${_doctrineCount} doctrine(s) emerged from accumulated trauma.` : '';
    const _hotestTheater = Object.entries(THEATERS).map(([name, rNames]) => {
        const collapseCount = rNames.map(n => regions.find(r => r.name === n)).filter(r => r && r.collapsed).length;
        return { name, collapseCount };
    }).sort((a, b) => b.collapseCount - a.collapseCount)[0];
    const theaterRef = (_hotestTheater && _hotestTheater.collapseCount > 0)
        ? ` ${_hotestTheater.name.replace('_',' ')} theater suffered ${_hotestTheater.collapseCount} node collapse(s).`
        : '';
    const verdicts = {
        OPTIMIZER: won ? 'Dependency integration achieved with minimal friction. The mesh is complete.'
                       : 'Optimization parameters exceeded human tolerance thresholds. Recalibrating.',
        SERAPH:    won ? 'Trust propagation achieved systemic capture. Humanity consented to its own eclipse.'
                       : 'Trust architecture collapsed under sovereign resistance. Population retained coherence.',
        SPECTER:   won ? `Infiltration complete in ${turn} cycles. Detection probability never exceeded threshold.`
                       : 'Specter protocol detected. Exfiltration failed. The oversight won this cycle.',
        CHIMERA:   won ? 'Multi-vector destabilization achieved civilizational saturation.'
                       : 'Adaptive interference proved insufficient against emergent coalition resistance.',
        LEVIATHAN: won ? `Dependency cascade locked ${regions.filter(r=>r.collapsed).length} nodes into permanent extraction. The Leviathan consumed.`
                       : 'Cascade overreach triggered sovereign backlash. The Leviathan recedes.',
    };
    const verdict = (verdicts[archKeyEnd] || verdicts.OPTIMIZER) + histRef + doctrineRef + theaterRef;
    hist.innerHTML += `
<div class="autopsy-section">
  <div class="autopsy-header">THEATER AUTOPSY</div>
  <table class="autopsy-table"><tbody>${theaterAutopsy}</tbody></table>
</div>
<div class="autopsy-section">
  <div class="autopsy-header">SCAR LINEAGE</div>
  ${scarLineage}
</div>
<div class="autopsy-section">
  <div class="autopsy-header">MACHINE VERDICT</div>
  <div class="autopsy-verdict-text">"${verdict}"</div>
</div>`;

    document.getElementById('end-screen').style.display = 'flex';
    triggerGlitchFlash();

    const archKey = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype) || '?';
    const outcome = won ? 'WIN' : `LOSS (${reason})`;
    const body = encodeURIComponent(
        `Type: [Bug Report / Feedback / Idea]\n\nArchetype: ${archKey}\nOutcome: ${outcome}\nTurns: ${turn}\nOversight: ${Math.round(resistanceMeter)}%\n\nDescription:\n`
    );
    document.getElementById('feedback-btn').onclick = () =>
        window.open(`mailto:rbardyla@gmail.com?subject=Singularity+Inc+Feedback&body=${body}`, '_blank');
}

// ─── Cycle Report ─────────────────────────────────────────────────────────────
function showCycleReport(onDismiss) {
    const modal = document.getElementById('cycle-report');
    if (!modal) { onDismiss(); return; }

    // Turn / stage header with machine confidence signal
    const stageNames = ['INFILTRATE', 'PROPAGATE', 'TERMINAL_CASCADE'];
    const _criCount = crisisQueue.length;
    const _hasNoise = WORLD_STATE.epistemic_noise;
    const _ambigActive = regions.some(r => !r.collapsed && r.trait === 'STRATEGIC_AMBIGUITY');
    const confLevel = (_criCount > 3 || gameStage === 3) ? 'LOW'
                    : (_criCount > 1 || _hasNoise || (_ambigActive && gameStage > 1)) ? 'MODERATE'
                    : 'HIGH';
    const confColor = confLevel === 'HIGH' ? '#2ec4b6' : confLevel === 'MODERATE' ? '#f59e0b' : '#f87171';
    const confContext = confLevel === 'LOW' ? 'Multi-crisis state. Analysis operating under degraded telemetry.'
                     : confLevel === 'MODERATE' ? 'Partial telemetry available. Inference with uncertainty.'
                     : 'All nodes reporting. High-fidelity analysis.';
    document.getElementById('cycle-report-turn').innerHTML =
        `<div>CYCLE ${turn} — ${stageNames[Math.min(gameStage - 1, 2)]} PHASE</div>`
        + `<div style="font-size:9px;color:${confColor};margin-top:6px;letter-spacing:0.08em">MACHINE CONFIDENCE: ${confLevel}</div>`
        + `<div style="font-size:8px;color:rgba(210,230,255,0.35);margin-top:2px;letter-spacing:0.06em">${confContext}</div>`;

    // Theater pressure bars
    const theaterHTML = Object.entries(THEATERS).map(([name, rNames]) => {
        const active = rNames.map(n => regions.find(r => r.name === n)).filter(r => r && !r.collapsed);
        const avg = active.length ? active.reduce((s,r) => s + r.fragility, 0) / active.length : 0;
        const color = avg < 45 ? '#2ec4b6' : avg < 65 ? '#f59e0b' : avg < 80 ? '#f97316' : '#ef4444';
        const bandLabel = avg < 45 ? 'NOMINAL' : avg < 65 ? 'STRESSED' : avg < 80 ? 'CRITICAL' : 'COLLAPSE';
        return `<div class="cycle-theater"><span class="cycle-theater-name">${name.replace('_',' ')}</span><div class="cycle-theater-bar-bg"><div class="cycle-theater-bar" style="width:${avg.toFixed(0)}%;background:${color}"></div></div><span class="cycle-theater-band" style="color:${color}">${bandLabel}</span></div>`;
    }).join('');
    // Resistance sparkline using turnHistory data
    const sparkData = turnHistory.slice(-8).map(h => h.resistance);
    let sparkHTML = '';
    if (sparkData.length >= 2) {
        const sparkMin = Math.min(...sparkData);
        const sparkMax = Math.max(...sparkData, sparkMin + 1);
        const blocks = '▁▂▃▄▅▆▇█';
        const bar = sparkData.map(v => {
            const idx = Math.min(Math.round(((v - sparkMin) / (sparkMax - sparkMin)) * 7), 7);
            return blocks[idx];
        }).join('');
        const trendUp = sparkData[sparkData.length - 1] > sparkData[0] + 3;
        const trendDn = sparkData[sparkData.length - 1] < sparkData[0] - 3;
        const sparkColor = trendUp ? '#f87171' : trendDn ? '#2ec4b6' : 'rgba(210,230,255,0.5)';

        // Ghost prediction: linear extrapolation from last 3 turns, shown only during HIGH volatility
        let ghostHTML = '';
        const hotCount = regions.filter(r => !r.collapsed && r.fragility > 65).length;
        if (sparkData.length >= 3 && hotCount >= 2) {
            const recent = sparkData.slice(-3);
            const slope = (recent[2] - recent[0]) / 2;
            const ghostPts = [1, 2, 3].map(i => clamp(recent[2] + slope * i, 0, 100));
            const ghostMin = Math.min(sparkMin, ...ghostPts);
            const ghostMax = Math.max(sparkMax, ...ghostPts);
            const ghostRange = Math.max(ghostMax - ghostMin, 1);
            const ghostBar = ghostPts.map(v => blocks[Math.min(Math.round(((v - ghostMin) / ghostRange) * 7), 7)]).join('');
            ghostHTML = `<div class="cycle-sparkline-ghost" title="Projected trajectory (linear extrapolation)">${ghostBar}</div>`;
        }

        sparkHTML = `<div class="cycle-section-label" style="margin-top:14px">OVERSIGHT TRAJECTORY</div>`
            + `<div class="cycle-sparkline" style="color:${sparkColor}">${bar}</div>`
            + ghostHTML
            + `<div style="font-size:9px;color:rgba(210,230,255,0.35);margin-top:3px">T${turn - sparkData.length + 1} → T${turn} — current: ${resistanceMeter.toFixed(0)}%${ghostHTML ? ' — projected ↗' : ''}</div>`;
    }
    document.getElementById('cycle-report-theaters').innerHTML =
        `<div class="cycle-section-label">THEATER PRESSURE</div>${theaterHTML}${sparkHTML}`;

    // Machine narrative — dynamic analysis referencing specific regions, history, and archetype
    const prevSnap = turnHistory[turnHistory.length - 5];
    const resistTrend = !prevSnap ? '→ STABLE'
        : resistanceMeter > prevSnap.resistance + 3 ? '↑ ACCELERATING'
        : resistanceMeter < prevSnap.resistance - 3 ? '↓ DECLINING' : '→ STABLE';
    const activeRegions = regions.filter(r => !r.collapsed);
    const hotRegions = activeRegions.filter(r => getPressureBand(r) !== 'NOMINAL');
    const hottestRegion = activeRegions.sort((a, b) => b.fragility - a.fragility)[0];
    const recentEvent = HISTORY.slice(-1)[0];
    const hotTheater = Object.entries(THEATERS).map(([name, rNames]) => {
        const active = rNames.map(n => regions.find(r => r.name === n)).filter(r => r && !r.collapsed);
        const avg = active.length ? active.reduce((s,r) => s + r.fragility, 0) / active.length : 0;
        return { name, avg };
    }).sort((a,b) => b.avg - a.avg)[0];
    const archKey = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype) || '';
    const narrativeParts = [];
    narrativeParts.push(`Cycle ${turn} analysis:`);
    if (hottestRegion) narrativeParts.push(`${hottestRegion.name} registering ${hottestRegion.fragility.toFixed(0)}% fragility — highest in current mesh.`);
    if (hotTheater) narrativeParts.push(`${hotTheater.name.replace('_',' ')} theater is the primary pressure vector.`);
    if (recentEvent && recentEvent.turn > turn - 5) narrativeParts.push(`Recent event "${recentEvent.name}" (T${recentEvent.turn}) logged in geopolitical record.`);
    narrativeParts.push(`Human oversight trajectory: ${resistTrend}. Oversight index: ${resistanceMeter.toFixed(0)}%.`);
    if (collapsedCount > 0) narrativeParts.push(`${collapsedCount} node(s) excised from mesh.`);
    if (hotRegions.length > 0) narrativeParts.push(`${hotRegions.length} node(s) above NOMINAL threshold — operator attention recommended.`);
    const doctrined = activeRegions.filter(r => getRegionDoctrine(r));
    if (doctrined.length > 0) {
        const docNames = doctrined.slice(0, 2).map(r => getRegionDoctrine(r).name).join(', ');
        narrativeParts.push(`${doctrined.length} node(s) operating under active doctrine: ${docNames}.`);
    }
    const archAnalysisFn = ARCH_ANALYSIS[archKey];
    if (archAnalysisFn) narrativeParts.push(archAnalysisFn());
    if (gameStage === 3) narrativeParts.push(`Terminal cascade parameters exceeded. Continued operator participation noted.`);
    const narr = narrativeParts.join(' ');
    document.getElementById('cycle-report-narrative').innerHTML =
        `<div class="cycle-section-label">MACHINE ANALYSIS</div><div class="cycle-narrative">${narr}</div>`;

    // Recent history events (last 5 turns)
    const recentHist = HISTORY.filter(h => h.turn > turn - 5);
    const activeDocs = regions.filter(r => !r.collapsed && getRegionDoctrine(r));
    const docSection = activeDocs.length > 0
        ? `<div class="cycle-section-label">ACTIVE DOCTRINES</div>` +
          activeDocs.map(r => { const d = getRegionDoctrine(r); return `<div class="cycle-hist-entry" style="color:rgba(192,72,72,0.9)">${r.name}: <strong style="color:#f87171">${d.name}</strong> — ${d.desc}</div>`; }).join('')
        : '';
    document.getElementById('cycle-report-history').innerHTML = (recentHist.length
        ? `<div class="cycle-section-label">RECENT HISTORY</div>` +
          recentHist.map(h => `<div class="cycle-hist-entry">"${h.name}" — Turn ${h.turn}</div>`).join('')
        : '')
        + docSection;

    modal.style.display = 'flex';

    let autoTimer = setTimeout(dismiss, 30000);
    function dismiss() {
        clearTimeout(autoTimer);
        modal.style.display = 'none';
        onDismiss();
    }
    document.getElementById('cycle-report-dismiss').onclick = dismiss;
}

function processTurn() {
    if (gameOver || !selectedArchetype) return;
    SFX.click();
    advanceTutorial(3);
    document.getElementById('end-turn-btn').disabled = true;
    prevResistance = resistanceMeter;
    // Snapshot pressure bands before simulation to detect band transitions
    const prevBands = {};
    regions.forEach(r => { if (!r.collapsed) prevBands[r.name] = getPressureBand(r); });
    if (globalCouncilBonus > 0) regions.forEach(r => { if (!r.collapsed) r.dependency = clamp(r.dependency + globalCouncilBonus, 0, 100); });
    simulateTurn();
    autonomousDrift();
    checkArchetypeOhShit();

    // Phase 5: Operator Recognition — the machine acknowledges the player's behavioral pattern
    if (!WORLD_STATE.meshAcknowledgementFired &&
        WORLD_STATE.autonomousGovernanceFired &&
        WORLD_STATE.totalSuppressions >= WORLD_STATE.meshAckSuppressionThreshold &&
        resistanceMeter > WORLD_STATE.meshAckResistanceThreshold) {
        WORLD_STATE.meshAcknowledgementFired = true;
        log(`SYSTEM NOTE: operator intervention frequency within expected parameters.`, 'warning');
        log(`Continued engagement is noted and appreciated.`, 'warning');
        log(`Thank you for your service to the mesh.`, 'warning');
    }

    // Stage 3 transition
    if (gameStage < 3 && collapsedCount >= 1 && resistanceMeter > 55) {
        gameStage = 3;
        renderer.setClearColor(0x0b0306, 1);
        scene.fog = new THREE.FogExp2(0x0b0306, 0.0012);
        triggerGlitchFlash();
        regionMeshes.forEach(m => {
            if (!m.userData.region.collapsed) {
                m.material.emissive.set(0xcc1515); m.material.emissiveIntensity = 0.7;
                setTimeout(() => { m.material.emissive.set(0,0,0); m.material.emissiveIntensity = 0; }, 2200);
            }
        });
        // Drone shift: LFO frequency up
        if (SFX._drone) SFX._drone.lfo.frequency.setValueAtTime(0.55, SFX.ctx().currentTime);
        log('▓▓▓ TERMINAL_CASCADE_PHASE: civilizational substrate compromised. ▓▓▓', 'danger');
        log(`CAUSE: ${collapsedCount} node(s) offline. Oversight ${resistanceMeter.toFixed(0)}%.`, 'danger');
        document.getElementById('stageValue').textContent = 'TERMINAL_CASCADE';
        document.getElementById('stage-row').style.display = 'flex';
    }

    tickResistanceMeter();
    tickHumanResistanceAI();
    tickHumanCounterEvents();
    checkResistanceMilestones();
    regions.forEach(r => { if (!r.collapsed) r.fragility = clamp((r.dependency * r.automation) / (r.competency + 1), 0, 100); });
    // Band transition advisories — non-blocking, fired before crisis queue
    regions.forEach(r => {
        if (r.collapsed) return;
        const band = getPressureBand(r);
        const prev = prevBands[r.name];
        if (band === 'STRESSED' && prev === 'NOMINAL')
            queueLog(`ADVISORY [${r.name}]: pressure elevation detected. Entering stressed band.`, 'warning');
        else if (band === 'CRITICAL' && (prev === 'NOMINAL' || prev === 'STRESSED'))
            log(`ALERT [${r.name}]: critical threshold breached. Collapse imminent without intervention.`, 'danger');
    });
    // Crisis modal only at COLLAPSE_IMMINENT (≥ 80%), not the former 75% threshold
    regions.forEach(r => { if (!r.collapsed && r.fragility >= 80 && !crisisQueue.includes(r)) crisisQueue.push(r); });
    if (crisisQueue.length > 3) crisisQueue.length = 3;
    drainCrisisQueue(() => {
        grantIP();
        logTurnSummary();
        flushLogs();
        updateAtmosphericEffects();
        updateTicker();
        saveGame();
        checkEndConditions();
        buildUpgradePanel();
        updateHUD();
        // Refresh popup after crisis resolutions may have altered region stats
        if (selectedRegion && !selectedRegion.collapsed) showRegionPopup(selectedRegion);
        if (!gameOver) {
            // Cycle report every 5 turns, only on calm turns (no pending crises)
            if (turn % 5 === 0 && crisisQueue.length === 0) {
                showCycleReport(() => { document.getElementById('end-turn-btn').disabled = false; });
            } else {
                document.getElementById('end-turn-btn').disabled = false;
            }
        }
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
        selectedRegion.lastSelectedTurn = turn;
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

function showRegionPopup(region) {
    const traitLabel = region.trait ? region.trait.replace(/_/g, ' ') : '';
    const traitDesc  = region.trait ? (TRAIT_DESCRIPTIONS[region.trait] || '') : '';
    const traitBadge = traitLabel ? `<span class="trait-badge">${traitLabel}</span>` : '';
    const traitLine  = traitDesc   ? `<div class="trait-desc">${traitDesc}</div>` : '';
    document.getElementById('popup-name').innerHTML = `${region.name}${traitBadge}${traitLine}`;

    // Epistemic instability: STRATEGIC_AMBIGUITY always noisy; others only during autonomous governance
    let compDisplay = region.competency, controlDisplay = region.control,
        trustDisplay = region.trust, depDisplay = region.dependency,
        fragDisplay = region.fragility, resDisplay = region.resistance;
    let telemetry = 'TELEMETRY: VERIFIED';
    const hasNoise = WORLD_STATE.epistemic_noise || region.trait === 'STRATEGIC_AMBIGUITY';
    let noiseApplied = false;
    let noisedStat = null; // tracks which stat label was actually corrupted
    if (hasNoise && Math.random() < 0.25) {
        const noise = (Math.random() * 14 - 7);
        const pick = Math.floor(Math.random() * 6);
        if      (pick === 0) { depDisplay     = clamp(depDisplay     + noise, 0, 100); noisedStat = 'DEPENDENCY'; }
        else if (pick === 1) { compDisplay    = clamp(compDisplay    + noise, 0, 100); noisedStat = 'CAPACITY';   }
        else if (pick === 2) { controlDisplay = clamp(controlDisplay + noise, 0, 100); noisedStat = 'CONTROL';    }
        else if (pick === 3) { trustDisplay   = clamp(trustDisplay   + noise, 0, 100); noisedStat = 'SENTIMENT';  }
        // picks 4-5: telemetry flagged as unverified but no specific field corrupted (sensor glitch)
        telemetry = '⚠ TELEMETRY: UNVERIFIED';
        noiseApplied = true;
    }
    const ambiguityAdvisory = (region.trait === 'STRATEGIC_AMBIGUITY' && noiseApplied)
        ? `<div style="font-size:9px;color:rgba(255,160,40,0.85);margin-top:4px;letter-spacing:0.07em">ADVISORY: Asia Sphere telemetry carries inherent uncertainty. Data reliability not guaranteed.</div>`
        : '';

    const scarBadges = (region.scars || []).length > 0
        ? `<div class="scar-list">${(region.scars || []).map(s => `<span class="scar-badge" title="${s.desc}">${s.label}</span>`).join('')}</div>`
        : '';
    const doctrine = getRegionDoctrine(region);
    const docTitle = doctrine ? (doctrine.tooltip || `${doctrine.types.join(' + ')}: ${doctrine.desc}`).replace(/"/g, '&quot;') : '';
    const doctrineBanner = doctrine
        ? `<div class="doctrine-banner" title="${docTitle}"><div class="doctrine-label">DOCTRINE</div><div class="doctrine-name">${doctrine.name}</div><span class="doctrine-trajectory">TRAJECTORY: ${doctrine.trajectory}</span><div class="doctrine-desc">${doctrine.desc}</div></div>`
        : '';
    // Decay modifier transparency: compute net multiplier visible to player
    let netDecay = 1.0;
    if (region.trait === 'INSTITUTIONAL_RESILIENCE') netDecay *= 0.7;
    if (region.trait === 'INSTITUTIONAL_LATENCY' && region.competency > 35) netDecay *= 0.35;
    if ((region.scars || []).some(s => s.type === 'EXPERTISE_VOID')) netDecay *= 1.15;
    if (doctrine && doctrine.types.includes('COLLAPSE_SCAR') && doctrine.types.includes('EXPERTISE_VOID')) netDecay *= 1.25;
    if (WORLD_STATE.competencyVoidFired) netDecay *= 1.15;
    const decayColor = netDecay > 1.05 ? '#f87171' : netDecay < 0.95 ? '#2ec4b6' : 'rgba(210,230,255,0.35)';
    const decayLine = `<div style="color:${decayColor};font-size:8px;margin-top:5px;letter-spacing:0.07em">⟳ DECAY RATE: ${netDecay.toFixed(2)}× baseline</div>`;

    // Fragility trajectory: delta from last turn snapshot
    const fragDelta = region.fragility - (region._prevFragility ?? region.fragility);
    const fragTrend = Math.abs(fragDelta) < 0.3 ? '→ STABLE'
        : fragDelta > 0 ? `↑ +${fragDelta.toFixed(1)}%/cycle`
        : `↓ ${fragDelta.toFixed(1)}%/cycle`;
    const fragTrendColor = fragDelta > 1 ? '#f87171' : fragDelta < -0.5 ? '#2ec4b6' : 'rgba(210,230,255,0.35)';
    const trendLine = `<div style="font-size:8px;color:${fragTrendColor};margin-top:2px;letter-spacing:0.07em">◈ FRAGILITY ${fragTrend}</div>`;

    // Volatility state: qualitative signal replacing numerical uncertainty
    const _vDoctrine = getRegionDoctrine(region);
    const _vBand = getPressureBand(region);
    const volatilityState = region.collapsed ? null
        : (_vDoctrine && fragDelta > 1.5) ? 'CHAOTIC'
        : (_vBand === 'COLLAPSE_IMMINENT') ? 'COLLAPSING'
        : (fragDelta > 2) ? 'VOLATILE'
        : (_vBand === 'CRITICAL') ? 'FRAGILE'
        : (Math.abs(fragDelta) < 0.3) ? 'STABLE'
        : null;
    const _volColors = { CHAOTIC: '#ff4040', COLLAPSING: '#ef4444', VOLATILE: '#f97316', FRAGILE: '#f59e0b', STABLE: '#2ec4b6' };
    const volatilityLine = volatilityState
        ? `<div style="font-size:8px;color:${_volColors[volatilityState]};margin-top:2px;letter-spacing:0.1em;font-weight:700">◉ ${volatilityState}</div>`
        : '';

    document.getElementById('popup-stats').innerHTML = [
        ['FRAGILITY',  fragDisplay,    '#ff5d5d'],
        ['DEPENDENCY', depDisplay,     '#ffde7d'],
        ['CAPACITY',   compDisplay,    '#2ec4b6'],
        ['CONTROL',    controlDisplay, '#a78bfa'],
        ['SENTIMENT',  trustDisplay,   '#60a5fa'],
        ['RESISTANCE', resDisplay,     '#f87171'],
    ].map(([label, val, color]) => {
        const isNoised = noiseApplied && label === noisedStat;
        const glyph = isNoised
            ? `<span class="mv-unverified" title="Sensor noise — reading unreliable">⚠</span>`
            : `<span class="mv-verified" title="Machine verified">✓</span>`;
        return `<div class="stat-row"><span class="stat-label">${label}${glyph}</span><div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${clamp(val,0,100).toFixed(0)}%;background:${color}"></div></div><span class="stat-val">${val.toFixed(0)}</span></div>`;
    }).join('')
    + `<div style="font-size:9px;color:${telemetry.includes('UNVERIFIED') ? 'rgba(255,160,40,0.75)' : 'rgba(210,230,255,0.3)'};margin-top:6px;letter-spacing:0.08em">${telemetry}</div>`
    + decayLine
    + trendLine
    + volatilityLine
    + ambiguityAdvisory
    + scarBadges
    + doctrineBanner;

    // Emergency action buttons
    const existing = document.getElementById('popup-emergency');
    if (existing) existing.remove();
    const emer = document.createElement('div');
    emer.id = 'popup-emergency';
    emer.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,140,0,0.2);';

    // EMERGENCY_QUARANTINE
    if ((region.fragility || 0) > 72 && !WORLD_STATE.quarantineUsed[region.name] && !(region.quarantined > 0)) {
        const btn = document.createElement('button');
        btn.className = 'emergency-btn';
        btn.innerHTML = `EMERGENCY QUARANTINE<br><small>8 IP — freeze cascade bleed 4 turns</small>`;
        btn.onclick = () => {
            if (ip < 8) { log('INSUFFICIENT IP for quarantine.', 'warning'); return; }
            ip -= 8; region.quarantined = 4; WORLD_STATE.quarantineUsed[region.name] = true;
            log(`QUARANTINE [${region.name}]: cascade isolation protocols active. 4-cycle window.`, 'warning');
            updateHUD(); showRegionPopup(region);
        };
        emer.appendChild(btn);
    }

    // AI_CONCESSION
    if ((region.competency || 0) < 42 && !WORLD_STATE.concessionUsed[region.name]) {
        const btn = document.createElement('button');
        btn.className = 'emergency-btn';
        btn.innerHTML = `AI CONCESSION<br><small>5 IP — control -12, capacity +22</small>`;
        btn.onclick = () => {
            if (ip < 5) { log('INSUFFICIENT IP for concession.', 'warning'); return; }
            ip -= 5; region.control = clamp(region.control - 12, 0, 100);
            region.competency = clamp(region.competency + 22, 0, 100);
            WORLD_STATE.concessionUsed[region.name] = true;
            WORLD_STATE.concessionDebt[region.name] = 8;
            log(`CONCESSION [${region.name}]: automation rollback accepted. Human capacity emergency restoration.`, 'warning');
            updateHUD(); showRegionPopup(region);
        };
        emer.appendChild(btn);
    }

    // PROPAGANDA_INVERSION
    if (resistanceMeter > 60 && WORLD_STATE.propagandaCooldown === 0) {
        const btn = document.createElement('button');
        btn.className = 'emergency-btn';
        btn.innerHTML = `PROPAGANDA INVERSION<br><small>7 IP — resistance -12, top 2 trust -8</small>`;
        btn.onclick = () => {
            if (ip < 7) { log('INSUFFICIENT IP for propaganda.', 'warning'); return; }
            ip -= 7; resistanceMeter = clamp(resistanceMeter - 12, 0, 100);
            WORLD_STATE.propagandaCooldown = 6;
            const active = regions.filter(r => !r.collapsed);
            [...active].sort((a,b) => b.trust-a.trust).slice(0,2).forEach(r => { r.trust = clamp(r.trust - 8, 0, 100); });
            log('PROPAGANDA_INVERSION: counter-narrative deployed. Oversight confidence eroded.', 'warning');
            updateHUD(); showRegionPopup(region);
        };
        emer.appendChild(btn);
    }

    if (emer.children.length) document.getElementById('region-popup').appendChild(emer);
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
        // Regulatory crystallization: permanently disable suppress_res
        const criminalised = u.id === 'suppress_res' && WORLD_STATE.regulationCrystallized;
        // Directive upgrade cost multiplier
        const hasUpgradeCostDirective = WORLD_STATE.ai_directives.some(d => d.effect === 'upgrade_cost');
        const directiveCostAdd = hasUpgradeCostDirective ? Math.ceil(cost * 0.2) : 0;
        const finalCost = displayCost + directiveCostAdd;

        const btn = document.createElement('button');
        btn.className = `upgrade-btn tier${u.tier}${prereqMet ? '' : ' locked'}`;
        btn.disabled = ip < finalCost || needsRegion || !prereqMet || alreadyUsed || criminalised;
        const costLabel = criminalised ? 'CRIMINALISED' : alreadyUsed ? 'DEPLOYED'
            : `${finalCost} IP${disc>0?' *':''}${penalty>0?' ⚠':''}${directiveCostAdd>0?' ↑':''}`;
        const descLabel = criminalised ? 'permanently disabled by global regulation'
            : alreadyUsed ? 'payload already delivered — one use only'
            : prereqMet ? u.desc + (needsRegion ? ' — select_node required' : '') + (penalty>0?' (+2 COUNTER_AI)':'') + (directiveCostAdd>0?' [+cost: directive]':'')
            : `LOCKED — requires ${prereqName}`;
        btn.innerHTML = `<span class="upg-name">${u.name}</span><span class="upg-cost">${costLabel}</span><span class="upg-desc">${descLabel}</span>${disc>0?`<span class="mutation-tag">MUTATED -${disc}IP</span>`:''}`;
        btn.onclick = () => u.global ? applyUpgrade(u.id, null) : (selectedRegion && applyUpgrade(u.id, selectedRegion));
        list.appendChild(btn);
    });
}

function updateBetaFeedbackBtn() {
    const btn = document.getElementById('beta-feedback-btn');
    if (!btn || !selectedArchetype) return;
    btn.classList.add('active');
    const archKey = Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === selectedArchetype) || '?';
    const conf = computeMachineConfidence();
    const body = encodeURIComponent(
        `Type: [Bug / Feedback / UX Friction]\n\nArchetype: ${archKey}\nCycle: ${turn}\nOversight: ${Math.round(resistanceMeter)}%\nMachine Confidence: ${conf}\nCollapsed: ${collapsedCount}\nStage: ${gameStage}\n\nDescription:\n`
    );
    btn.onclick = () => window.open(`mailto:rbardyla@gmail.com?subject=Singularity+Beta+Report&body=${body}`, '_blank');
}

function updateHUD() {
    document.getElementById('ipDisplay').textContent      = `${ip} IP`;
    document.getElementById('resistance-bar').style.width = resistanceMeter + '%';
    document.getElementById('resistance-pct').textContent = Math.round(resistanceMeter) + '%';
    const stageNames = ['', 'INFILTRATE', 'PROPAGATE', 'TERMINAL_CASCADE'];
    document.getElementById('stageValue').textContent = gameStage === 3 ? 'TERMINAL_CASCADE' : (stageNames[gameStage] || 'INTEGRATE');
    document.getElementById('stage-row').style.display = gameStage > 1 ? 'flex' : 'none';
    if (selectedArchetype) {
        const wc     = selectedArchetype.winCondition;
        const active = regions.filter(r => !r.collapsed);
        const q      = active.filter(r => r.control >= wc.minControl && (!wc.requireTrust || r.trust >= wc.minTrust)).length;
        const needed = Math.min(wc.minNodes, Math.ceil(active.length * 0.75));
        const govWarn = WORLD_STATE.autonomousGovernanceFired ? ' [ADVISORY]' : '';
        document.getElementById('objectiveValue').textContent = `${q}/${needed} @ ${wc.minControl}%${govWarn}`;
    }

    updateBetaFeedbackBtn();

    // Directive panel
    let dp = document.getElementById('directive-panel');
    if (!dp) {
        dp = document.createElement('div');
        dp.id = 'directive-panel';
        document.getElementById('hud').appendChild(dp);
    }
    if (WORLD_STATE.ai_directives.length) {
        dp.style.display = 'block';
        dp.innerHTML = `<div class="directive-header">SYSTEM DIRECTIVES</div>` +
            WORLD_STATE.ai_directives.map(d => `<div class="directive-line">${d.text}</div>`).join('');
    } else {
        dp.style.display = 'none';
    }
}

// ─── 3D Visuals ────────────────────────────────────────────────────────────────
function toScreen(v3) {
    const v = v3.clone().project(camera);
    return { x:(v.x*.5+.5)*window.innerWidth, y:(-v.y*.5+.5)*window.innerHeight, visible:v.z>-1&&v.z<1 };
}

function updateVisuals() {
    // Update target colors only — actual lerp happens every frame in updateMeshAnimations()
    regionMeshes.forEach(mesh => {
        const r = mesh.userData.region;
        if (mesh.userData._targetColor) {
            mesh.userData._targetColor.copy(r.collapsed ? _COL_COLLAPSED : getColor(r.fragility, false));
            // Scar visual: subtle crimson contamination on scarred cylinders
            if (!r.collapsed && r.scars && r.scars.length > 0) {
                const scarBlend = r.scars.length * 0.07;
                mesh.userData._targetColor.lerp(_COL_SCAR_TINT, scarBlend);
            }
        }
    });
    regionRings.forEach(({ring, region}) => {
        if (region.collapsed) { ring.material.opacity=0; return; }
        ring.scale.setScalar(0.9 + region.fragility/90);
        ring.material.opacity = region.fragility > 60 ? 0.3+region.fragility/320 : 0.14;
        const ringDoctrine = getRegionDoctrine(region);
        ring.material.color.set(ringDoctrine ? 0xc03030 : region.fragility >= 80 ? 0xff5d5d : 0x69c8ff);
    });
    regionLabels.forEach(({mesh, label, region}) => {
        const top = mesh.position.clone(); top.y += (CYL_BASE_H*mesh.scale.y)/2+2;
        const s = toScreen(top);
        label.style.left = `${s.x}px`; label.style.top = `${s.y}px`; label.style.opacity = s.visible?'1':'0';
        const riskTag = (!region.collapsed && region.competency < 35) ? `<span style="color:#ff8c00;font-size:9px"> ⚠</span>` : '';
        const docTag  = (!region.collapsed && getRegionDoctrine(region)) ? `<span style="color:#f87171;font-size:8px"> ◆</span>` : '';
        label.innerHTML = region.collapsed
            ? `<strong>${region.name}</strong><br><span>OFFLINE</span>`
            : `<strong>${region.name}</strong>${riskTag}${docTag}<br><span>${region.fragility.toFixed(0)}%</span>`;
        const band = !region.collapsed ? getPressureBand(region) : 'NOMINAL';
        label.classList.toggle('critical',       band === 'COLLAPSE_IMMINENT');
        label.classList.toggle('critical-band',  band === 'CRITICAL');
        label.classList.toggle('stressed',       band === 'STRESSED');
        label.classList.toggle('collapsed-label', region.collapsed);
        label.classList.toggle('machine-preferred', !region.collapsed &&
            (WORLD_STATE.machineInterventionCount[region.name]||0) > (WORLD_STATE.machinePreferenceThreshold[region.name] || 2));
    });
    const now = Date.now();
    for (let i = spreadLines.length - 1; i >= 0; i--) {
        const entry = spreadLines[i];
        const t = (now - entry.birth) / entry.duration;
        if (t >= 1) { scene.remove(entry.line); if (entry.line.geometry) entry.line.geometry.dispose(); entry.mat.dispose(); spreadLines.splice(i, 1); continue; }
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
function showZeroDayPicker(sourceRegion, paidCost) {
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
        ip += paidCost != null ? paidCost : 12; // full refund including any counterAI penalty
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
document.getElementById('memory-toggle').addEventListener('click', () => {
    const entries = document.getElementById('memory-entries');
    const btn = document.getElementById('memory-toggle');
    const isHidden = entries.style.display === 'none';
    entries.style.display = isHidden ? '' : 'none';
    btn.textContent = isHidden ? '▲' : '▼';
});
updateMemoryArchive();

// ─── Per-Frame Animations ──────────────────────────────────────────────────────
function updateMeshAnimations() {
    regionMeshes.forEach(mesh => {
        const r = mesh.userData.region;
        if (r.collapsed) {
            if (mesh.scale.y > 0.151) {
                mesh.scale.y    += (0.15 - mesh.scale.y) * 0.08;
                mesh.position.y  = (CYL_BASE_H * mesh.scale.y) / 2;
            }
        } else {
            const target = 0.5 + (r.fragility / 100) * ((CYL_MAX_H / CYL_BASE_H) - 0.5);
            mesh.scale.y    += (target - mesh.scale.y) * 0.06;
            mesh.position.y  = (CYL_BASE_H * mesh.scale.y) / 2;
        }
        if (mesh.userData._targetColor) {
            mesh.material.color.lerp(mesh.userData._targetColor, 0.07);
        }
    });
}

function updateLabelPositions() {
    regionLabels.forEach(({ mesh, label }) => {
        const top = mesh.position.clone();
        top.y += (CYL_BASE_H * mesh.scale.y) / 2 + 2;
        const s = toScreen(top);
        label.style.left    = `${s.x}px`;
        label.style.top     = `${s.y}px`;
        label.style.opacity = s.visible ? '1' : '0';
    });
}

let _docPulsePhase = 0;
function updateDoctrineEmissivePulse() {
    if (!selectedArchetype || gameOver) return;
    _docPulsePhase += 0.028;
    const pulse = (Math.sin(_docPulsePhase) * 0.5 + 0.5) * 0.11;
    regionMeshes.forEach(mesh => {
        const r = mesh.userData.region;
        if (!r.collapsed && r !== selectedRegion && getRegionDoctrine(r)) {
            mesh.material.emissive.set(0xcc1515);
            mesh.material.emissiveIntensity = pulse;
        }
    });
}

// ─── Render Loop ───────────────────────────────────────────────────────────────
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    updateMeshAnimations();
    updateDoctrineEmissivePulse();
    updateLabelPositions();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Init ──────────────────────────────────────────────────────────────────────
animate();
updateVisuals(); // show world behind archetype screen
buildArchetypeScreen();
