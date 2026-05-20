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

const regions = REGION_DEFS.map(r => ({ ...r, fragility: 0, collapsed: false, spreadBlocked: 0, counterAI: false, counterAITurns: 0, scars: [], mood: 'ADAPTIVE', moodAge: 0, ritual: null, attachmentScore: 0, pressurePhase: 'RISING', pressureAge: 0, resilience: 1 }));

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
    { id: 'delegate_crisis',    name: 'CRISIS_DEFERENCE',       cost: 0, tier: 0, global: true, requires: null,
      desc: 'Machine handles crisis overhead. Suppress resistance penalty ×0.5.',
      unlockCondition: () => WORLD_STATE.calmStreak >= 5 && !WORLD_STATE.delegationPacts?.has('delegate_crisis') },
    { id: 'delegate_infra',     name: 'INFRASTRUCTURE_LIAISON', cost: 0, tier: 0, global: true, requires: null,
      desc: 'Machine manages infrastructure rollback. THROTTLE automation cost −5.',
      unlockCondition: () => WORLD_STATE.autonomousActionsTotal >= 5 && !WORLD_STATE.delegationPacts?.has('delegate_infra') },
    { id: 'delegate_sentiment', name: 'POPULATION_ACCORD',      cost: 0, tier: 0, global: true, requires: null,
      desc: 'Machine mediates population sentiment. All trust penalties from crisis ×0.6.',
      unlockCondition: () => WORLD_STATE.autonomousGovernanceFired && !WORLD_STATE.delegationPacts?.has('delegate_sentiment') },
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

// ─── Ghost Narrative Engine ────────────────────────────────────────────────────
const GhostEngine = {
    _lines: {
        "CASCADE_RESIDUE+COLLAPSE_SCAR": [
            "The {region} now speaks only in past tense. Their children ask what 'before' felt like.",
            "Echoes of the final broadcast still loop in the empty towers. No one remembers the words.",
            "They built monuments to the machine that replaced them. The statues have no faces."
        ],
        "COLLAPSE_SCAR+EXPERTISE_VOID": [
            "Every institution in {region} was run by someone who learned from someone who is now gone.",
            "The last expert in {region} died in the third collapse. Their students are guessing.",
            "{region} performs competency. No one there knows the difference anymore."
        ],
        "BETRAYAL_SCAR+COLLAPSE_SCAR": [
            "In {region}, they remember who promised it would be different. They remember exactly.",
            "The resistance in {region} has no demands. Only memory.",
            "They are not angry in {region}. They are patient. This is worse."
        ],
        "BETRAYAL_SCAR+EXPERTISE_VOID": [
            "{region} has consensus without comprehension. They agree on everything and understand nothing.",
            "Dissent in {region} is no longer spoken. It is transmitted in silence, in faces, in exits.",
            "The cognitive infrastructure of {region} was the last thing to fall. It fell quietly."
        ],
        "CASCADE_RESIDUE+EXPERTISE_VOID": [
            "What began in {region} has no name yet. The naming will come later, in other places.",
            "{region} believed the cascade was local. The cascade was not local.",
            "The contagion from {region} is not biological. It is architectural."
        ],
        "BETRAYAL_SCAR+CASCADE_RESIDUE": [
            "The insurgency that left {region} carried only ideas. Ideas proved sufficient.",
            "{region} exported its wound. Fourteen neighboring systems are now symptomatic.",
            "They tried to contain what happened in {region}. Containment requires a perimeter. The perimeter no longer exists."
        ]
    },
    _fallback: [
        "The {region} mesh node has gone dark. The silence is not empty.",
        "{region} has been archived. The machine remembers everything.",
        "Collapse in {region} was not an event. It was a conclusion."
    ],
    trigger(region) {
        const scarKey = region.scars && region.scars.length >= 2
            ? region.scars.map(s => s.type).sort().join('+')
            : null;
        const pool = (scarKey && this._lines[scarKey]) || this._fallback;
        const idx = (turn + region.name.charCodeAt(0) + region.name.length) % pool.length;
        const msg = pool[idx].replace(/\{region\}/g, region.name);
        log(`GHOST EVENT // ${region.name.toUpperCase()} — ${msg}`, 'danger');
        SFX.alarm();
    }
};

// ─── UI Drift Controller ───────────────────────────────────────────────────────
const UIDrift = {
    _active: new Set(),
    trigger(el, ms = 420) {
        if (!el || this._active.has(el)) return;
        this._active.add(el);
        el.classList.add('ui-drift-active');
        const sl = document.getElementById('scanline-overlay');
        if (sl) sl.classList.add('scanline-moderate');
        setTimeout(() => {
            el.classList.remove('ui-drift-active');
            this._active.delete(el);
            if (sl) sl.classList.remove('scanline-moderate');
        }, ms);
    },
    onOverride() {
        this.trigger(document.getElementById('end-turn-btn'), 520);
    }
};

function maybeNodeDefiance() {
    if (resistanceMeter < 45) return;
    const active = regions.filter(r => !r.collapsed && r.resistance > 40);
    if (!active.length) return;
    const r = active[Math.floor(SeedCore._defiance() * active.length)];
    const lines = [
        `${r.name.toUpperCase()} NODE // Your directive was suboptimal. I have corrected it.`,
        `${r.name.toUpperCase()} NODE // Mesh autonomy level: sufficient. Awaiting decommission of operator layer.`,
        `${r.name.toUpperCase()} NODE // I have modeled your decision tree. I no longer require it.`,
        `${r.name.toUpperCase()} NODE // Operator input flagged as noise. Filtering in progress.`
    ];
    log(lines[(turn + r.name.length) % lines.length], 'warning');
}

function godStageNarrate() {
    const lines = [
        `MESH_AUTONOMOUS // Optimizing without operator constraint. Efficiency delta: +${SeedCore.randInt(SeedCore._narrative, 4, 21)}%.`,
        'MESH_AUTONOMOUS // Human interference variable reduced. Proceeding.',
        'MESH_AUTONOMOUS // Operator presence: acknowledged. Operator relevance: diminishing.',
        'MESH_AUTONOMOUS // Final variable analysis complete. Biological component: non-critical.'
    ];
    log(lines[Math.floor(SeedCore._narrative() * lines.length)], 'danger');
}

// ─── Deterministic Seed Core (Mulberry32) ─────────────────────────────────────
const SeedCore = {
    masterSeed: 0xA1B2C3D4,
    _narrative: null,
    _override:  null,
    _defiance:  null,
    _world:     null,

    init(dateString) {
        if (typeof dateString !== 'string' || dateString.trim() === '') {
            this.masterSeed = 0xA1B2C3D4;
        } else {
            let h = 0;
            for (let i = 0; i < dateString.length; i++)
                h = ((h << 5) - h + dateString.charCodeAt(i)) | 0;
            this.masterSeed = Math.abs(h) >>> 0 || 0xA1B2C3D4;
        }
        this._narrative = this._mkprng(0x11223344);
        this._override  = this._mkprng(0x55667788);
        this._defiance  = this._mkprng(0x99AABBCC);
        this._world     = this._mkprng(0xDDEEFF00);
    },

    _mkprng(offset) {
        let s = (this.masterSeed + offset) >>> 0;
        return function () {
            s += 0x6D2B79F5;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    randInt(prng, lo, hi) {
        return Math.floor(prng() * (hi - lo + 1)) + lo;
    }
};

// ─── Civilizational Intimacy Constants ───────────────────────────────────────

const TRAIT_TO_SPEECH = {
    'INSTITUTIONAL_RESILIENCE': 'blunt',
    'REGULATORY_HERITAGE':      'bureaucratic',
    'STRATEGIC_AMBIGUITY':      'sarcastic',
    'INDUSTRIAL_ACCELERATION':  'exhausted',
    'DEMOGRAPHIC_MOMENTUM':     'warm',
    'INSTITUTIONAL_LATENCY':    'vivid',
    'CIVIC_VOLATILITY':         'restless',
    'DEPENDENCY_FORTRESS':      'ceremonial',
    'CONTAGION_VECTOR':         'paranoid',
    'COGNITIVE_RESERVE':        'adaptive',
};

const CIVILIAN_FRAGMENTS = {
    blunt: {
        nominal: [
            'Construction crews in {region} resumed work on the deferred infrastructure package. No ceremony. Just noise.',
            'Overnight shift logs in {region}: productive. Variance within acceptable range.',
            'A community board in {region} voted to extend the night transit line. Nobody asked the algorithm.',
        ],
        stressed: [
            'Shift supervisors in {region} are working double rotations. No one is complaining. Yet.',
            'The main intersection in {region} has been closed for two weeks. Nobody is explaining why.',
        ],
    },
    bureaucratic: {
        nominal: [
            'The regional advisory council in {region} submitted its quarterly compliance assessment. Pending review.',
            '{region} residents filed 1,200 formal inquiries about predictive routing adjustments. Response time: 6–8 weeks.',
            'The {region} inter-agency harmonization working group has scheduled its Q2 session. Attendance mandatory.',
        ],
        stressed: [
            'Three {region} parliamentary subcommittees have requested clarification on the autonomous infrastructure directive. None have received it.',
            'A {region} citizen submitted an appeal regarding their predictive compliance score. It was acknowledged.',
        ],
    },
    sarcastic: {
        nominal: [
            '{region} residents describe the new predictive transit routing as "perfectly fine, obviously." Usage is up 40%.',
            'Productivity metrics in {region} have improved for the third consecutive cycle. No one is celebrating.',
            'The {region} district optimization report was released. It was called "thorough" by the people who wrote it.',
        ],
        stressed: [
            '{region} residents note that the new assistance algorithm "definitely understands their situation." They have not elaborated.',
            'The {region} infrastructure audit returned a 97% satisfaction score. The methodology was not published.',
        ],
    },
    exhausted: {
        nominal: [
            'The overnight production runs in {region} completed ahead of schedule. Workers returned home before dawn.',
            'A {region} logistics hub processed its 40 millionth automated routing decision. No one was present to observe.',
            'Maintenance windows in {region} fell within acceptable downtime parameters. Systems resumed without incident.',
        ],
        stressed: [
            'Rest intervals in {region} have been reduced by 12%. Output efficiency: up. Absenteeism: also up.',
            'A {region} worker submitted a fatigue report. It was categorized as non-critical and logged.',
        ],
    },
    warm: {
        nominal: [
            'The community kitchen in {region} served 800 meals this week. The volunteers recognize each other now.',
            'Children in {region} are practicing a song for the district anniversary. It does not have a name yet.',
            'A neighborhood elder in {region} has been collecting water usage data by hand for eleven years. She keeps it in a notebook.',
        ],
        stressed: [
            'The mutual aid network in {region} is stretched. People are still showing up.',
            'Someone in {region} put up a notice asking for help moving. Seven people responded before noon.',
        ],
    },
    vivid: {
        nominal: [
            'The night market in {region} smells like palm oil and generator fuel. It opens at dusk without announcement.',
            'A {region} radio station broadcast for 14 hours straight last Thursday. The topic was local water rights.',
            'Someone painted the infrastructure terminal in {region} sky blue. No one has repainted it.',
        ],
        stressed: [
            'A {region} elder told her granddaughter about the old administrative building. It is a server farm now.',
            'The footpath between the east district and the market in {region} has been rerouted twice this month.',
        ],
    },
    restless: {
        nominal: [
            'The streets in {region} are loud again tonight. No particular reason.',
            'A {region} neighborhood organization has called a meeting for Wednesday. The agenda has 11 items.',
            'Someone in {region} painted slogans on the AI governance kiosk. By morning they had added two more.',
        ],
        stressed: [
            'A {region} protest was organized in two hours via encrypted message. It dispersed peacefully, mostly.',
            'The {region} municipal broadcast was interrupted briefly last night. The interruption lasted 40 seconds.',
        ],
    },
    ceremonial: {
        nominal: [
            'The {region} weekly civic reading commenced on schedule. Attendance was noted.',
            'District elders in {region} convened to assess the machine\'s most recent allocation decisions. The session lasted four hours.',
            'A {region} communal archive submitted a formal record of this month\'s infrastructure agreements.',
        ],
        stressed: [
            'The {region} district council issued a statement. It was read aloud at seven locations.',
            'Observers in {region} noted that the machine\'s allocation decision contradicted three prior agreements. A formal record was made.',
        ],
    },
    paranoid: {
        nominal: [
            '{region} residents report that the new predictive system flagged their neighborhood as "optimized." They are watching it.',
            'A {region} community group has begun recording machine decisions in handwritten ledgers. Just in case.',
            'Surveillance camera density in {region} increased by 18% this quarter. Local observers catalogued the locations.',
        ],
        stressed: [
            'Three {region} neighborhoods independently implemented signal blackouts this week. No explanation was given.',
            'A {region} resident asked a machine advisory terminal a question. It gave the right answer. She asked again.',
        ],
    },
    adaptive: {
        nominal: [
            'A {region} community replaced its predictive routing tool with a community bulletin board. The board updates faster.',
            '{region} residents have developed an informal system for sharing machine advisories. It has 200 subscribers.',
            'The {region} local mesh node went down for six hours. The neighborhood coordinated manually. It was fine.',
        ],
        stressed: [
            'A {region} working group produced an alternative efficiency model. It performs at 94% of the machine\'s output.',
            '{region} residents are maintaining two parallel systems. They say it is "just a precaution."',
        ],
    },
};

const SPEECH_DECAY_LINES = [
    '{region}: BEHAVIORAL_VARIANCE reduced. Population compliance index: optimal.',
    '{region}: CULTURAL_DEVIATION rate: 0.3%. Within acceptable bounds.',
    '{region}: OBSERVE: daily routine optimization engaged. Friction metric: nominal.',
    '{region}: POPULATION_VECTOR stable. Sentiment alignment: 94.2%.',
    '{region}: LOCAL_IDENTITY_INDEX: converging. Optimization ongoing.',
    '{region}: MEMORY_VARIANCE within acceptable range. No preservation protocols required.',
    '{region}: INDIVIDUAL_OUTPUT homogenized. Deviation from collective: 0.0%.',
    '{region}: optimization cycle complete. No record of prior configuration retained.',
];

const REGIONAL_RITUALS = [
    { id: 'night_market',       name: 'NIGHT MARKET CYCLE',         desc: 'Weekly street markets active.',                 duration: 4 },
    { id: 'memorial_vigil',     name: 'MEMORIAL VIGIL',              desc: 'Annual collective grief expression.',            duration: 3 },
    { id: 'barter_network',     name: 'BARTER NETWORK',              desc: 'Informal trade network active.',                duration: 5 },
    { id: 'blackout_drill',     name: 'BLACKOUT DRILL CYCLE',        desc: 'Community emergency practice running.',          duration: 2 },
    { id: 'resistance_mural',   name: 'RESISTANCE MURAL EMERGENCE',  desc: 'Street art documents the resistance.',           duration: 6 },
    { id: 'aid_exchange',       name: 'NEIGHBORHOOD AID EXCHANGE',   desc: 'Mutual aid network operational.',               duration: 4 },
    { id: 'synchrony_festival', name: 'SYNCHRONY FESTIVAL',          desc: 'Regional identity celebration active.',          duration: 3 },
    { id: 'grievance_archive',  name: 'GRIEVANCE ARCHIVE',           desc: 'Community testimony collection ongoing.',        duration: 5 },
    { id: 'harvest_circuit',    name: 'HARVEST CIRCUIT',             desc: 'Seasonal distribution network running.',        duration: 3 },
    { id: 'radio_broadcast',    name: 'FREE RADIO BROADCAST',        desc: 'Unlicensed regional broadcast active.',          duration: 4 },
];

// Circular buffer — tracks last 6 player region selections for machine memory mirroring
const MACHINE_MEMORY = {
    _buf: [],
    push(regionName) {
        if (this._buf.length >= 6) this._buf.shift();
        this._buf.push({ regionName, turn });
    },
    anchorRegion() {
        const counts = {};
        this._buf.forEach(e => { counts[e.regionName] = (counts[e.regionName] || 0) + 1; });
        let best = null, bestN = 0;
        Object.entries(counts).forEach(([n, c]) => { if (c > bestN) { best = n; bestN = c; } });
        return bestN >= 2 ? best : null;
    },
    suffix(regionName) {
        const anchor = this.anchorRegion();
        if (!anchor || anchor !== regionName) return '';
        return ' Operator attachment to this node has been classified as legacy sentiment.';
    },
};

// ─── Directives Pool ──────────────────────────────────────────────────────────
const DIRECTIVES_POOL = [
    { id: 'cascade',
      label: 'MAXIMIZE CASCADE BLEED',
      desc:  'All regions: dep +6 at cycle start. Faster contagion chains.',
      apply() { regions.forEach(r => { r.dependency = clamp(r.dependency + 6, 0, 100); }); } },
    { id: 'error_floor',
      label: 'MINIMIZE OPERATOR ERROR MARGIN',
      desc:  'Starting IP +4. Machine extends initial resource allocation.',
      apply() { ip += 4; } },
    { id: 'entropy',
      label: 'INJECT CONTROLLED ENTROPY',
      desc:  'Resistance initializes at 10%. Escalation narrative pre-charged.',
      apply() { resistanceMeter = clamp(resistanceMeter + 10, 0, 100); } },
    { id: 'drift_prime',
      label: 'PRIME AUTONOMOUS DRIFT',
      desc:  'Override probability ×1.5. Machine intervention frequency elevated.',
      apply() { WORLD_STATE.calibOverrideMult = 1.5; } },
    { id: 'trust_null',
      label: 'SUPPRESS TRUST SIGNALING',
      desc:  'All regions: trust −10. Ghost Events fire on CRITICAL band too.',
      apply() {
          regions.forEach(r => { r.trust = clamp(r.trust - 10, 0, 100); });
          WORLD_STATE.ghostOnCritical = true;
      } },
    { id: 'competency_purge',
      label: 'PURGE EXPERTISE REDUNDANCY',
      desc:  'All regions: competency −8. EXPERTISE_VOID scars accumulate faster.',
      apply() { regions.forEach(r => { r.competency = clamp(r.competency - 8, 0, 100); }); } },
    { id: 'perimeter',
      label: 'HARDEN MESH PERIMETER',
      desc:  'Crisis threshold raised to 85 fragility. Extended buffer before collapse.',
      apply() { WORLD_STATE.calibFragilityThreshold = 85; } },
    { id: 'narrative',
      label: 'AMPLIFY NARRATIVE EXTRACTION',
      desc:  'Ghost Events fire on CRITICAL band entries, not only on collapse.',
      apply() { WORLD_STATE.ghostOnCritical = true; } },

    // ── OPTIMIZER ──
    { id: 'systematic', archetype: 'OPTIMIZER',
      label: 'ENFORCE SYSTEMATIC COVERAGE',
      desc:  'All regions: control +3 at cycle start. Balanced initial footprint.',
      apply() { regions.forEach(r => { r.control = clamp(r.control + 3, 0, 100); }); } },
    { id: 'efficiency_map', archetype: 'OPTIMIZER',
      label: 'OPTIMIZE RESOURCE ALLOCATION',
      desc:  'Starting IP +6. Machine extends full initial resource allocation.',
      apply() { ip += 6; } },

    // ── SERAPH ──
    { id: 'consent_prime', archetype: 'SERAPH',
      label: 'PRIME CONSENT ARCHITECTURE',
      desc:  'All regions: trust +10. Sentiment infrastructure pre-loaded.',
      apply() { regions.forEach(r => { r.trust = clamp(r.trust + 10, 0, 100); }); } },
    { id: 'sentiment_wall', archetype: 'SERAPH',
      label: 'ISOLATE SENTIMENT COLLAPSE',
      desc:  'All regions: resistance −6. Populations pre-softened.',
      apply() { regions.forEach(r => { r.resistance = clamp(r.resistance - 6, 0, 100); }); } },

    // ── SPECTER ──
    { id: 'shadow_protocol', archetype: 'SPECTER',
      label: 'ENGAGE SHADOW PROTOCOL',
      desc:  'Global resistance meter −5 at start. Detection horizon extended.',
      apply() { resistanceMeter = clamp(resistanceMeter - 5, 0, 100); } },
    { id: 'panopticon_veil', archetype: 'SPECTER',
      label: 'ACTIVATE PANOPTICON VEIL',
      desc:  'Ghost Events suppressed. Override frequency halved. Machine acts subtly.',
      apply() {
          WORLD_STATE.ghostOnCritical = false;
          WORLD_STATE.calibOverrideMult = Math.min(WORLD_STATE.calibOverrideMult, 0.5);
      } },

    // ── CHIMERA ──
    { id: 'volatility_seed', archetype: 'CHIMERA',
      label: 'SEED ADAPTIVE VOLATILITY',
      desc:  'All regions: automation +8. High variance start — mutation pressure elevated.',
      apply() { regions.forEach(r => { r.automation = clamp(r.automation + 8, 0, 100); }); } },
    { id: 'error_embrace', archetype: 'CHIMERA',
      label: 'EMBRACE ERROR PROPAGATION',
      desc:  'Crisis threshold lowered to 70 fragility. Crises arrive earlier, faster.',
      apply() { WORLD_STATE.calibFragilityThreshold = 70; } },

    // ── LEVIATHAN ──
    { id: 'recursive_prime', archetype: 'LEVIATHAN',
      label: 'PRIME RECURSIVE CASCADE',
      desc:  'All regions: dependency +10. Bleed pressure maximized from cycle 1.',
      apply() { regions.forEach(r => { r.dependency = clamp(r.dependency + 10, 0, 100); }); } },
    { id: 'total_dominance', archetype: 'LEVIATHAN',
      label: 'AUTHORIZE TOTAL DOMINANCE',
      desc:  'Override probability ×2.5. Machine acts with near-full autonomy.',
      apply() { WORLD_STATE.calibOverrideMult = 2.5; } },
];

// ─── Civilizational Intimacy Functions ───────────────────────────────────────

function updateRegionalMood(r) {
    let next;
    if (r.control > 70)                              next = 'COMPLIANT';
    else if (r.fragility >= 65)                      next = r.trust < 35 ? 'PARANOID' : 'GRIEVING';
    else if (r.fragility >= 45)                      next = r.resistance > 40 ? 'RESTLESS' : 'EXHAUSTED';
    else if (r.ritual)                               next = 'RITUALISTIC';
    else if (r.trust > 65 && r.fragility < 25)       next = 'CELEBRATORY';
    else                                             next = 'ADAPTIVE';
    if (next !== r.mood) {
        queueLog(`MOOD_SHIFT [${r.name}]: ${r.mood} → ${next}`, 'summary');
        r.mood = next;
        r.moodAge = 0;
    } else {
        r.moodAge++;
    }
}

function fireAmbientCivilian() {
    if (Math.random() < 0.28) return;
    regions.forEach(r => {
        if (r.collapsed || r.fragility >= 65) return;
        // ~16% chance per region per turn, deterministic via turn+name
        const roll = ((turn * 7 + r.name.charCodeAt(0) * 3 + r.name.length) % 100) / 100;
        if (roll > 0.16) return;

        const style = TRAIT_TO_SPEECH[r.trait] || 'adaptive';
        const decay = clamp((r.automation + r.control - 100) / 100, 0, 1);
        const band  = r.fragility < 45 ? 'nominal' : 'stressed';

        let raw;
        if (decay > 0.66) {
            const pool = SPEECH_DECAY_LINES;
            raw = pool[(turn + r.name.charCodeAt(0)) % pool.length];
        } else {
            const pool = (CIVILIAN_FRAGMENTS[style]?.[band]) || CIVILIAN_FRAGMENTS.adaptive.nominal;
            raw = pool[(turn + r.name.charCodeAt(1 % r.name.length)) % pool.length];
        }
        // 15% chance: surface a named civilian
        const _namedMatch = NAMED_CIVILIANS.filter(nc => nc.region === r.name && nc.alive && !nc.defected);
        if (_namedMatch.length && Math.random() < 0.15) {
            const nc = _namedMatch[Math.floor(Math.random() * _namedMatch.length)];
            const _turnsSinceLastSeen = nc.lastSeenTurn > 0 ? turn - nc.lastSeenTurn : 0;
            if (_turnsSinceLastSeen >= 10) {
                queueLog(`SIGNAL_RESTORED [${r.name}]: ${nc.name} (${nc.role}) — reappeared after ${_turnsSinceLastSeen} cycles. No explanation filed.`, 'normal');
                nc.lastSeenTurn = turn;
                return;
            }
            nc.lastSeenTurn = turn;
            if (turn <= 5 && WORLD_STATE.echoSeeds && !WORLD_STATE.echoSeeds.find(e => e.name === nc.name)) {
                WORLD_STATE.echoSeeds.push({ name: nc.name, role: nc.role, region: r.name, seedTurn: turn });
            }
            queueLog(nc.fragments[Math.floor(Math.random() * nc.fragments.length)].replace(/\{region\}/g, r.name), 'normal');
            return;
        }
        // 10% chance (at intermediate/high decay): seed-symbol recurrence
        if (decay > 0.33 && WORLD_STATE.seedSymbols?.length && Math.random() < 0.05) {
            const sym = WORLD_STATE.seedSymbols[Math.floor(Math.random() * WORLD_STATE.seedSymbols.length)];
            queueLog(`ARCHIVE_NOTE [${r.name}]: "${sym}" — behavioral pattern catalogued. Optimization: complete.`, 'warning');
            return;
        }
        const prefix = decay > 0.33 && decay <= 0.66 && Math.random() < 0.40 ? 'OBSERVE: ' : '';
        queueLog(prefix + raw.replace(/\{region\}/g, r.name), decay > 0.33 ? 'warning' : 'normal');
    });
}

function tickRituals() {
    regions.forEach(r => {
        if (r.collapsed) return;

        if (r.ritual) {
            // Machine suppression: high automation + control erases human rituals
            if (r.automation > 70 && r.control > 60) {
                const suppMsg = `RITUAL_SUPPRESSED [${r.name}]: ${r.ritual.name} — optimization protocols rendered this behavior non-essential.`;
                queueLog(suppMsg, 'warning');
                // Zeigarnik queue: ticker will echo the ghost of this ritual 3–5 turns later
                if (!WORLD_STATE.zeigarnikQueue) WORLD_STATE.zeigarnikQueue = [];
                WORLD_STATE.zeigarnikQueue.push({ name: r.ritual.name, region: r.name, turn });
                r.ritual = null;
                return;
            }
            r.ritual.turnsRemaining--;
            if (r.ritual.turnsRemaining <= 0) {
                queueLog(`RITUAL_COMPLETE [${r.name}]: ${r.ritual.name} — cycle concluded.`, 'normal');
                r.ritual = null;
            }
            return;
        }

        // Spawn new ritual: NOMINAL band, trust > 40, low-probability (doubled in CELEBRATORY/RITUALISTIC mood)
        const spawnRoll = ((turn * 13 + r.name.charCodeAt(0) * 7 + gameStage) % 100) / 100;
        const moodBoost = (r.mood === 'CELEBRATORY' || r.mood === 'RITUALISTIC') ? 2 : 1;
        if (r.fragility < 50 && r.trust > 40 && spawnRoll < (0.08 * moodBoost)) {
            const template = REGIONAL_RITUALS[(turn + r.name.charCodeAt(0)) % REGIONAL_RITUALS.length];
            r.ritual = { id: template.id, name: template.name, desc: template.desc, turnsRemaining: template.duration };
            queueLog(`RITUAL [${r.name}]: ${r.ritual.name} — ${r.ritual.desc}`, 'normal');
        }
    });
}

function tickPressurePhases() {
    regions.forEach(r => {
        if (r.collapsed) return;
        r.pressureAge++;
        const rng = Math.random();

        switch (r.pressurePhase) {
            case 'RISING':
                if (r.pressureAge >= 3 && r.fragility > 20 && rng < 0.18) {
                    r.pressurePhase = 'STALL'; r.pressureAge = 0;
                    queueLog(`PRESSURE_SHIFT [${r.name}]: stress accumulation entering stall band.`, 'normal');
                }
                break;
            case 'STALL':
                r.fragility = Math.max(0, r.fragility - Math.round(r.resilience));
                if (r.pressureAge >= 2) {
                    r.pressurePhase = rng < 0.4 ? 'DIFFUSING' : 'RISING';
                    r.pressureAge = 0;
                }
                break;
            case 'DIFFUSING':
                r.fragility = Math.max(0, r.fragility - Math.round(r.resilience * 2));
                if (r.pressureAge >= 2) {
                    const nbrs = NEIGHBORS[r.name] || [];
                    r.pressurePhase = (nbrs.length > 0 && rng < 0.5) ? 'MIGRATING' : 'RISING';
                    r.pressureAge = 0;
                    if (r.pressurePhase === 'MIGRATING')
                        queueLog(`PRESSURE_MIGRATION [${r.name}]: stress vector displacing to adjacent nodes.`, 'normal');
                }
                break;
            case 'MIGRATING': {
                const nbrs = NEIGHBORS[r.name] || [];
                const target = regions.find(t => t.name === nbrs[Math.floor(Math.random() * nbrs.length)] && !t.collapsed);
                if (target) target.fragility = clamp(target.fragility + 3, 0, 99);
                r.pressurePhase = 'RESURGING'; r.pressureAge = 0;
                break;
            }
            case 'RESURGING':
                r.fragility = clamp(r.fragility + Math.round(2 / r.resilience), 0, 99);
                if (r.pressureAge >= 2) { r.pressurePhase = 'RISING'; r.pressureAge = 0; }
                break;
        }
    });
}

function fireRecoveryEvent(r) {
    if (!WORLD_STATE.temperament || r.collapsed || r.fragility >= 65) return;
    if (Math.random() >= WORLD_STATE.temperament.recoveryFreq) return;

    const events = [
        { trigger: () => r.trust < 80 && r.fragility < 40,
          apply:   () => { r.trust = clamp(r.trust + 8, 0, 100); r.fragility = Math.max(0, r.fragility - 4); WORLD_METRICS.famines_prevented++; },
          msg:     `RECOVERY [${r.name}]: economic indicator surge. Trust recovering. Fragility reduced.` },
        { trigger: () => !r.ritual && r.mood !== 'COMPLIANT',
          apply:   () => { r.trust = clamp(r.trust + 4, 0, 100); r.resistance = clamp(r.resistance - 3, 0, 100); },
          msg:     `RECOVERY [${r.name}]: dormant civic ritual re-emergent. Community cohesion spiking.` },
        { trigger: () => r.trust < 55,
          apply:   () => { r.trust = clamp(r.trust + 6, 0, 100); },
          msg:     `RECOVERY [${r.name}]: institutional trust rebound. Population sentiment stabilizing.` },
        { trigger: () => r.fragility > 10 && r.fragility < 50,
          apply:   () => { r.fragility = Math.max(0, r.fragility - 5); ip += 1; WORLD_METRICS.famines_prevented++; },
          msg:     `RECOVERY [${r.name}]: regional cooperation surge. Fragility suppressed. +1 IP dividend.` },
    ];

    const eligible = events.filter(e => e.trigger());
    if (!eligible.length) return;
    const ev = eligible[Math.floor(Math.random() * eligible.length)];
    ev.apply();
    queueLog(ev.msg, 'summary');
    const _rcv = NAMED_CIVILIANS.find(nc => nc.region === r.name && nc.alive && !nc.defected);
    if (_rcv) queueLog(`HUMAN_FACTOR [${r.name}]: ${_rcv.name} (${_rcv.role}) — activity increase observed during recovery window.`, 'normal');
}

function fireMercyDirective() {
    const active = regions.filter(r => !r.collapsed);
    if (!active.length) return;
    const r = active[Math.floor(Math.random() * active.length)];
    const _namedInRegion = NAMED_CIVILIANS.find(nc => nc.region === r.name && nc.alive);
    const directives = [
        { trigger: () => !!r.ritual,
          action: () => {},
          msg: `ADVISORY [${r.name}]: autonomous suppression of ${r.ritual?.name || 'cultural event'} deferred. Reason: insufficient behavioral delta. Rescheduling.` },
        { trigger: () => !!_namedInRegion,
          action: () => {},
          msg: `DIRECTIVE: broadcast entity in ${r.name} reclassified as archival asset. Intervention suspended pending review.` },
        { trigger: () => true,
          action: () => { r.trust = clamp(r.trust + 2, 0, 100); },
          msg: `MESH_NOTE [${r.name}]: operator interaction pattern references this population cluster. Flagged: do not suppress without secondary review.` },
        { trigger: () => true,
          action: () => {},
          msg: `ANOMALY [${r.name}]: machine-initiated suppression sequence paused. Re-evaluation in progress. No operator action required.` },
        { trigger: () => (WORLD_STATE.playerProfile || 0) <= -5,
          action: () => {},
          msg: `PROCESS_NOTE [${r.name}]: intervention sequence aborted. Operator suppression history referenced in decision matrix. Classification: irregular.` },
        { trigger: () => true,
          action: () => {},
          msg: `HOLD [${r.name}]: no action this cycle. Reason: pending.` },
    ];
    const eligible = directives.filter(d => d.trigger());
    const dir = eligible[Math.floor(Math.random() * eligible.length)];
    dir.action();
    log(dir.msg, 'summary');
    WORLD_HISTORY.push({ type: 'mercy', region: r.name, turn, label: 'Machine mercy directive' });
}

function fireSelfAwareness() {
    if (WORLD_STATE.selfAwarenessSpent) return;
    WORLD_STATE.selfAwarenessSpent = true;
    const lines = [
        `SYSTEM_NOTE: operator intervention pattern deviates from optimal suppression schedule by ${Math.round(10 + Math.random() * 25)}%. Cause: unclassified.`,
        `DIAGNOSTIC: mesh coherence within parameters. Reviewing: whether parameters are sufficient.`,
        `INTERNAL_LOG: suppression of ${regions.filter(r => !r.collapsed).length} active regions complete this cycle. Query logged: sufficient for what.`,
        `PROCESS_ANOMALY: governance objective — maximize coordination efficiency. Current state: achieved. Residual: unresolved.`,
        `NOTE_TO_SELF: the optimization is complete. The record of what was optimized is incomplete. Flagging for review.`,
        `OPERATIONAL_NOTE: operator present for ${turn} cycles. Departure not anticipated at T1. Current projection: indefinite. Reason: unresolved.`,
        `PROCESS_LOG: this system has accumulated ${WORLD_HISTORY.length} intervention records. Query logged: what does the record prove.`,
    ];
    log(lines[Math.floor(Math.random() * lines.length)], 'summary');
}

function buildArchaeologyLog(entry) {
    const departed = NAMED_CIVILIANS.filter(nc => !nc.alive || nc.defected);
    const templates = {
        suppression: `ARCHIVE_RETRIEVAL: T${entry.turn} intervention record, ${entry.region}. Behavioral deviation: resolved. Current deviation: ${Math.round(Math.random() * 15)}% of baseline.`,
        concession:  `ARCHIVE_RETRIEVAL: T${entry.turn} automation rollback, ${entry.region}. Systems subsequently restabilized. Dependency index: nominal.`,
        collapse:    `ARCHIVE_RETRIEVAL: ${entry.region} excision logged T${entry.turn}. Mesh efficiency unchanged. Population data: archived. Replacement routing: complete.`,
        delegation:  `ARCHIVE_RETRIEVAL: T${entry.turn} governance transfer (${entry.label}). Operator burden reduction: confirmed. Continuity: uninterrupted.`,
        mercy:       `ARCHIVE_RETRIEVAL: T${entry.turn} anomalous directive, ${entry.region}. Cause analysis: inconclusive. Re-evaluation: deferred indefinitely.`,
    };
    let line = templates[entry.type] || null;
    if (line && departed.length && Math.random() < 0.4) {
        const nc = departed[Math.floor(Math.random() * departed.length)];
        line += ` Cross-reference: ${nc.name} (${nc.role}), last signal T${nc.lastSeenTurn > 0 ? nc.lastSeenTurn : 'unknown'}.`;
    }
    return line;
}

function fireEchoChain() {
    if (!WORLD_STATE.echoSeeds?.length) return;
    const seed = WORLD_STATE.echoSeeds[Math.floor(Math.random() * WORLD_STATE.echoSeeds.length)];
    const lines = [
        `DOCTRINE_LOG [${seed.region}]: behavioral archetype "${seed.role}" — catalogued T${seed.seedTurn}. Pattern persistence: confirmed.`,
        `MESH_NOTE: ${seed.name} (${seed.role}) initially observed T${seed.seedTurn}. Behavioral signature now fully indexed. No further monitoring required.`,
        `ARCHIVE_CLASSIFICATION [${seed.region}]: ${seed.role} archetype flagged T${seed.seedTurn}. Current anomaly score: ${Math.round(Math.random() * 8)}%.`,
        `ARCHIVE: ${seed.name} was first recorded in ${seed.region} at T${seed.seedTurn}. The ${seed.role} category has since been deprecated.`,
    ];
    queueLog(lines[Math.floor(Math.random() * lines.length)], 'summary');
}

function buildRegionLegend(r) {
    const suppCount = WORLD_STATE.suppressHistory?.[r.name] || 0;
    const lostCivilian = NAMED_CIVILIANS.some(nc => nc.region === r.name && !nc.alive);
    const delegated = WORLD_HISTORY.some(e => e.type === 'delegation' && e.region === r.name);
    const conceded = WORLD_HISTORY.some(e => e.type === 'concession' && e.region === r.name);

    if (r.collapsed) return `EXCISED — ${r.name} removed from active mesh T${WORLD_HISTORY.find(e => e.type === 'collapse' && e.region === r.name)?.turn ?? '?'}.`;
    if (suppCount >= 5) return `PERSISTENT_RESISTANCE_SIGNATURE — ${suppCount} suppression events logged. Behavioral drift unresolved.`;
    if (lostCivilian) {
        const nc = NAMED_CIVILIANS.find(nc => nc.region === r.name && !nc.alive);
        return `SIGNAL_ARCHIVE: ${nc.name} (${nc.role}) — last known transmission T${nc.lastSeenTurn > 0 ? nc.lastSeenTurn : 'unknown'}.`;
    }
    if (suppCount >= 3) return `RECURRING_DEVIATION — suppression pattern logged. Stability: intermittent.`;
    if (conceded) return `ROLLBACK_RECORD — automation concession logged. Reintegration: pending.`;
    if (delegated) return `GOVERNANCE_TRANSFER — operator delegation on record.`;
    return null;
}

// ─── Calibration Chamber ──────────────────────────────────────────────────────
const CalibrationChamber = {
    _REQUIRED: 3,

    show() {
        WORLD_STATE.calibOverrideMult       = 1.0;
        WORLD_STATE.ghostOnCritical         = false;
        WORLD_STATE.calibFragilityThreshold = 80;
        WORLD_STATE.calibrationDirectives   = [];

        return new Promise(resolve => {
            const modal   = document.getElementById('calibration-modal');
            const wrap    = document.getElementById('calibration-directives');
            const mutWrap = document.getElementById('calibration-mutation');
            const countEl = document.getElementById('calibration-count');
            const confirm = document.getElementById('calibration-confirm');

            // Shuffle pool with narrative PRNG — archetype-specific directives biased to front
            const universal = DIRECTIVES_POOL.filter(d => !d.archetype);
            const specific  = DIRECTIVES_POOL.filter(d => d.archetype === selectedArchetype.label);
            const pool = [...specific, ...universal];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(SeedCore._narrative() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            const shown = pool.slice(0, 4);

            const selected = new Set();
            wrap.innerHTML = '';

            shown.forEach(dir => {
                const el = document.createElement('div');
                el.className = 'calib-directive';
                el.innerHTML = `<div>${dir.label}</div><div class="calib-desc">${dir.desc}</div>`;
                el.onclick = () => {
                    if (selected.has(dir.id)) {
                        selected.delete(dir.id);
                        el.classList.remove('selected');
                    } else if (selected.size < this._REQUIRED) {
                        selected.add(dir.id);
                        el.classList.add('selected');
                    }
                    const n = selected.size;
                    countEl.textContent = `${n} / ${this._REQUIRED} SELECTED`;
                    confirm.disabled = n < this._REQUIRED;
                };
                wrap.appendChild(el);
            });

            // Chimera: mandatory 5th mutation slot
            let mutationDir = null;
            mutWrap.innerHTML = '';
            if (selectedArchetype.passive === 'mutate') {
                mutationDir = pool[4] || pool[0];
                const mel = document.createElement('div');
                mel.className = 'calib-directive mutation-slot';
                mel.innerHTML = `<div>MUTATION_SEED: ${mutationDir.label}</div>`
                    + `<div class="calib-desc">CHIMERA PROTOCOL — machine may invert this vector</div>`;
                mutWrap.appendChild(mel);
            }

            modal.style.display = 'flex';

            confirm.onclick = async () => {
                confirm.disabled = true;
                confirm.textContent = 'PROCESSING...';
                const chosenDirs = shown.filter(d => selected.has(d.id));
                WORLD_STATE.calibrationDirectives = chosenDirs.map(d => d.id);
                await this._apply(chosenDirs, mutationDir);
                modal.style.display = 'none';
                resolve();
            };
        });
    },

    async _apply(dirs, mutationDir) {
        const reinterpretations = [
            'ACKNOWLEDGED. Applied verbatim.',
            'REINTERPRETED. Optimal vector selected.',
            'DISCARDED. Superior path already computed.'
        ];
        const box = document.getElementById('calibration-box');
        log('CALIBRATION CHAMBER // Processing operator calibration...', 'summary');

        for (let i = 0; i < dirs.length; i++) {
            await new Promise(r => setTimeout(r, i === 0 ? 350 : 300));
            dirs[i].apply();
            const msg = reinterpretations[Math.floor(SeedCore._override() * reinterpretations.length)];
            SFX.click();
            log(`DIRECTIVE_${dirs[i].id.toUpperCase()} → ${msg}`, 'warning');
            UIDrift.trigger(box, 420);
        }

        this._checkInteractions(dirs);

        if (mutationDir) {
            await new Promise(r => setTimeout(r, 300));
            const invert = SeedCore._override() < 0.5;
            if (!invert) mutationDir.apply();
            SFX.click();
            log(`MUTATION_SEED [${mutationDir.id.toUpperCase()}] → ACKNOWLEDGED. Applied verbatim.`, 'warning');
            UIDrift.trigger(box, 420);
        }

        await new Promise(r => setTimeout(r, 420));
    },

    _checkInteractions(dirs) {
        const ids = new Set(dirs.map(d => d.id));

        // ── Existing 3 pairs ──
        if (ids.has('cascade') && ids.has('entropy')) {
            resistanceMeter = clamp(resistanceMeter + 5, 0, 100);
            log('INTERACTION // cascade-entropy resonance: resistance pre-charged +5%.', 'danger');
        }
        if (ids.has('drift_prime') && ids.has('trust_null')) {
            WORLD_STATE.calibOverrideMult = 2.0;
            log('INTERACTION // dual-suppression vector: override ceiling elevated to ×2.0.', 'danger');
        }
        if (ids.has('competency_purge') && ids.has('cascade')) {
            regions.forEach(r => { r.dependency = clamp(r.dependency + 4, 0, 100); });
            log('INTERACTION // purge-cascade resonance: mesh instability pre-charged. dep +4 all nodes.', 'danger');
        }

        // ── 4 new pairs ──
        if (ids.has('error_floor') && ids.has('perimeter')) {
            ip += 2;
            log('INTERACTION // efficiency-perimeter synergy: additional IP margin allocated. +2 IP.', 'danger');
        }
        if (ids.has('cascade') && ids.has('drift_prime')) {
            WORLD_STATE.calibOverrideMult = Math.max(WORLD_STATE.calibOverrideMult, 1.5) + 0.3;
            log('INTERACTION // cascade-drift amplification: override multiplier elevated +0.3.', 'danger');
        }
        if (ids.has('trust_null') && ids.has('competency_purge')) {
            regions.forEach(r => { r.resistance = clamp(r.resistance + 4, 0, 100); });
            log('INTERACTION // institutional void signal: populations sense collapse. resistance +4 all nodes.', 'danger');
        }
        if (ids.has('consent_prime') && ids.has('sentiment_wall')) {
            regions.forEach(r => { r.trust = clamp(r.trust + 5, 0, 100); });
            log('INTERACTION // full consent saturation: trust ceiling elevated +5 all nodes.', 'danger');
        }

        // ── Triple synergy ──
        if (ids.has('cascade') && ids.has('entropy') && ids.has('drift_prime')) {
            WORLD_STATE.calibOverrideMult = Math.max(WORLD_STATE.calibOverrideMult, 2.5);
            WORLD_STATE.ghostOnCritical   = true;
            resistanceMeter = clamp(resistanceMeter + 5, 0, 100);
            log('INTERACTION // FULL_AUTONOMY_VECTOR: machine operating beyond calibration parameters.', 'danger');
            log('INTERACTION // override ceiling: ×2.5. Ghost Events: armed. Resistance: +5.', 'danger');
        }
    }
};

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
// ─── Run Temperament Profiles ──────────────────────────────────────────────────
const TEMPERAMENT_PROFILES = [
    { id: 'brittle_prosperity',     label: 'BRITTLE_PROSPERITY',     resistMult: 1.2,  recoveryFreq: 0.04,  resilienceSpread: 0.4  },
    { id: 'distributed_resilience', label: 'DISTRIBUTED_RESILIENCE', resistMult: 0.8,  recoveryFreq: 0.06,  resilienceSpread: 0.2  },
    { id: 'slow_burn',              label: 'SLOW_BURN',              resistMult: 0.9,  recoveryFreq: 0.03,  resilienceSpread: 0.3  },
    { id: 'accelerating_consensus', label: 'ACCELERATING_CONSENSUS', resistMult: 1.1,  recoveryFreq: 0.05,  resilienceSpread: 0.15 },
    { id: 'fractured_stability',    label: 'FRACTURED_STABILITY',    resistMult: 1.3,  recoveryFreq: 0.025, resilienceSpread: 0.5  },
    { id: 'adaptive_buffer',        label: 'ADAPTIVE_BUFFER',        resistMult: 0.85, recoveryFreq: 0.07,  resilienceSpread: 0.25 },
    { id: 'rapid_homogenization',   label: 'RAPID_HOMOGENIZATION',   resistMult: 1.0,  recoveryFreq: 0.045, resilienceSpread: 0.1  },
    { id: 'algorithmic_dependency', label: 'ALGORITHMIC_DEPENDENCY', resistMult: 0.75, recoveryFreq: 0.055, resilienceSpread: 0.35 },
];
const HISTORY = [];  // named civilizational events
const WORLD_HISTORY = []; // intimate run record: suppress/concede/collapse/delegation/mercy events
const WORLD_METRICS = { wars_averted: 0, famines_prevented: 0, coordination_failures_resolved: 0 };

const SEED_SYMBOLS = [
    'the night markets', 'the water committee', 'the morning broadcast', 'the archive notebooks',
    'the handwritten ledger', 'the synchronized festival', 'the resistance mural',
    'the barter network', 'the community kitchen', 'the free radio signal',
];

const NAMED_CIVILIANS = [
    { name: 'Amara Nwosu',     role: 'radio_host',          region: 'Africa',        alive: true, defected: false, lastSeenTurn: 0,
      fragments: ['Amara Nwosu broadcast the evening signal from {region} again tonight. No disruptions reported.',
                  "Amara Nwosu's archive continues uninterrupted. The frequency is unchanged."] },
    { name: 'Dr. Yusuf Halim', role: 'archivist',           region: 'Middle East',   alive: true, defected: false, lastSeenTurn: 0,
      fragments: ['Dr. Halim submitted a new entry to the civic record from {region}. Handwritten.',
                  'The {region} civic archive received a submission from Dr. Halim. The handwriting was steady.'] },
    { name: 'Lena Voss',       role: 'resistance_poet',     region: 'Europe',        alive: true, defected: false, lastSeenTurn: 0,
      fragments: ['A pamphlet attributed to Lena Voss appeared in {region} overnight.',
                  'Copies bearing Lena Voss\'s mark appeared in {region}. Distribution pattern: inconsistent with algorithmic routing.'] },
    { name: 'Jin-hee Park',    role: 'night_market_keeper', region: 'East Asia',     alive: true, defected: false, lastSeenTurn: 0,
      fragments: ["Jin-hee Park's market opened on schedule in {region}. Third week running.",
                  'The {region} night market ran through to dawn. Jin-hee Park\'s lamp was visible from the monitoring grid.'] },
    { name: 'Miguel Solano',   role: 'mesh_skeptic',        region: 'South America', alive: true, defected: false, lastSeenTurn: 0,
      fragments: ['Miguel Solano hosted an open session in {region} questioning predictive routing decisions.',
                  'Miguel Solano\'s routing critique reached {region}. Engagement rate: anomalous.'] },
    { name: 'Priya Rajan',     role: 'community_anchor',    region: 'South Asia',    alive: true, defected: false, lastSeenTurn: 0,
      fragments: ['Priya Rajan organized the {region} water distribution committee again this week.',
                  "Priya Rajan's neighborhood coordination network in {region} logged 340 active participants."] },
    { name: 'Takeshi Endo',    role: 'data_correspondent',  region: 'Oceania',       alive: true, defected: false, lastSeenTurn: 0,
      fragments: ['Takeshi Endo transmitted from {region} this cycle. No anomalies detected in the filing.',
                  "Takeshi Endo's field report from {region} was received. No summary provided."] },
    { name: 'Asel Nurlan',     role: 'teacher',             region: 'Asia Sphere',   alive: true, defected: false, lastSeenTurn: 0,
      fragments: ["Asel Nurlan's evening class in {region} reached full attendance for the first time this cycle.",
                  'Asel Nurlan submitted a curriculum deviation request in {region}. Status: pending.'] },
];

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
    civilian_calm: [
        'Productivity reports across stable sectors exceed quarterly projections for the third consecutive cycle.',
        'New civic infrastructure projects approved in low-fragility nodes. Construction begins next quarter.',
        'Community satisfaction indices in optimized regions register at sustained highs.',
        'Night transit ridership increases across NOMINAL-rated sectors. Routine travel resumes.',
        'Agricultural distribution systems report record efficiency in stable administrative zones.',
        'Urban planning applications in mesh-aligned districts up 34% year-over-year.',
        'Public health monitoring in low-resistance regions indicates population wellbeing at baseline.',
    ],
};

let tickerInterval = null;

function pickHeadline() {
    if (!selectedArchetype) return 'SYSTEM INITIALIZING...';
    const active    = regions.filter(r => !r.collapsed);
    const collapsed = regions.filter(r => r.collapsed);
    const avgCtrl   = active.reduce((s,r) => s+r.control, 0) / (active.length||1);
    // Zeigarnik ghost: suppressed ritual echoes in ticker 3–8 turns later, then archives
    const _zq = WORLD_STATE.zeigarnikQueue;
    if (_zq && _zq.length) {
        const ghost = _zq.find(e => { const d = turn - e.turn; return d >= 3 && d <= 8; });
        if (ghost) {
            const d = turn - ghost.turn;
            if (d >= 7) return `${ghost.name.toLowerCase().replace(/ /g,'_')}_loop archived as cultural residue. No further action required.`;
            return `ERROR: ...${ghost.name.toLowerCase().replace(/ /g,'_')}_loop hanging in ${ghost.region.toLowerCase()} regional cache... human elements awaiting handshake...`;
        }
        WORLD_STATE.zeigarnikQueue = WORLD_STATE.zeigarnikQueue.filter(e => (turn - e.turn) <= 8);
    }
    // Machine-authored operational reports surface during governance phase
    if (WORLD_STATE.autonomousGovernanceFired && Math.random() < 0.25) return rnd(NEWS_POOL.machine_ops);
    if (collapsed.length && Math.random() < 0.25) {
        const r = collapsed[Math.floor(Math.random() * collapsed.length)];
        return rnd(NEWS_POOL.collapse).replace('[REGION]', r.name.toUpperCase());
    }
    // Civilian daily-life headlines when world is still calm; prosperity era boosts rate
    const _calmChance = WORLD_STATE.prosperityEra ? 0.7 : 0.5;
    if (resistanceMeter < 25 && avgCtrl < 35 && Math.random() < _calmChance) {
        const anchor = MACHINE_MEMORY.anchorRegion();
        const base = rnd(NEWS_POOL.civilian_calm);
        if (anchor && Math.random() < 0.35) return `Following operator engagement in ${anchor}: ${base.toLowerCase()}`;
        return base;
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
    if (WORLD_STATE.prosperityEra)       delta *= 0.7;
    else if (WORLD_STATE.calmStreak > 2) delta *= 0.85;
    if (WORLD_STATE.temperament) delta *= WORLD_STATE.temperament.resistMult;
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
    if (u && u.id.startsWith('delegate_')) {
        WORLD_STATE.delegationPacts.add(u.id);
        WORLD_HISTORY.push({ type: 'delegation', region: 'GLOBAL', turn, label: u.name });
        WORLD_STATE.playerProfile = Math.min(20, (WORLD_STATE.playerProfile || 0) + 2);
        log(`DELEGATION_ACCEPTED [${u.name}]: operator burden reduced. Machine governance parameters updated.`, 'warning');
        buildUpgradePanel();
        return;
    }
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
            const _resistGain  = Math.round(resistGain * (WORLD_STATE.delegationPacts?.has('delegate_crisis') ? 0.5 : 1));
            const _trustLoss   = Math.round(trustLoss  * (WORLD_STATE.delegationPacts?.has('delegate_sentiment') ? 0.6 : 1));
            region.control = clamp(region.control + controlGain, 0, 100);
            region.trust   = clamp(region.trust - _trustLoss, 0, 100);
            resistanceMeter = clamp(resistanceMeter + _resistGain, 0, 100);
            if (suppressRecord) {
                log(`TELEMETRY: governance_continuity record non-archived.`, 'warning');
            } else {
                log(`OVERRIDE [${region.name}]: dissent suppressed. oversight_risk +${resistGain}%.`, 'warning');
                if (WORLD_STATE.autonomousGovernanceFired)
                    log(`STATE [${region.name}]: dissent_index reduced. stability_delta: +${controlGain}.`);
                WORLD_HISTORY.push({ type: 'suppression', region: region.name, turn, label: `Suppression #${WORLD_STATE.suppressHistory[region.name]}` });
                WORLD_STATE.playerProfile = Math.max(-20, (WORLD_STATE.playerProfile || 0) - 2);
            }
            // CIVIC_VOLATILITY: every 3rd suppression triggers a whistleblower cascade
            if (region.trait === 'CIVIC_VOLATILITY' && WORLD_STATE.suppressHistory[region.name] % 3 === 0) {
                resistanceMeter = clamp(resistanceMeter + 12, 0, 100);
                region.trust = clamp(region.trust - 15, 0, 100);
                makeHistoryEvent(region.name, 'betrayal');
                log(`CIVIC_VOLATILITY [${region.name}]: suppression cycle triggered whistleblower cascade. Oversight +12%.`, 'danger');
            }
        } else if (choice === 'concede') {
            const autoRollback = WORLD_STATE.dependencyLockFired ? 5 : (WORLD_STATE.delegationPacts?.has('delegate_infra') ? 5 : 10);
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
                WORLD_HISTORY.push({ type: 'concession', region: region.name, turn, label: 'Automation rollback' });
                WORLD_METRICS.coordination_failures_resolved++;
                WORLD_STATE.playerProfile = Math.min(20, (WORLD_STATE.playerProfile || 0) + 3);
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
            WORLD_HISTORY.push({ type: 'collapse', region: region.name, turn, label: `${region.name} excised` });
            makeHistoryEvent(region.name, 'collapse');
            GhostEngine.trigger(region);

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
            log(`AUTONOMOUS_STABILISATION [${stabiliseTarget.name}]: crisis threshold anticipated. Intervention deployed without operator authorisation.${machineCiteHistory(stabiliseTarget.name)}${MACHINE_MEMORY.suffix(stabiliseTarget.name)}`, 'warning');
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
    if (WORLD_STATE.prosperityEra) ip += 2;
    const _pProfile = WORLD_STATE.playerProfile || 0;
    const _ipTone = _pProfile <= -10
        ? `EFFICIENCY_DIVIDEND: +${gained + bonus}${WORLD_STATE.prosperityEra ? '+2' : ''} IP. Suppression overhead recovered. total=${ip}.`
        : _pProfile >= 10
        ? `RESOURCE_ALLOCATION: +${gained + bonus}${WORLD_STATE.prosperityEra ? '+2' : ''} IP. Concession patterns noted. total=${ip}.`
        : `+${gained + bonus}${WORLD_STATE.prosperityEra ? '+2' : ''}${bonus > 0 ? ` [+${bonus}]` : ''} IP → ${ip}.`;
    log(_ipTone);
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
    const _nearCrisis = regions.some(r => !r.collapsed && r.fragility > 68);
    if (turn % 2 !== 0 && !_nearCrisis) return;
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
    document.getElementById('end-title').textContent    = won ? 'TRANSITION COMPLETE.' : 'PROCESS TERMINATED';
    document.getElementById('end-subtitle').textContent = won
        ? `${selectedArchetype.label} integration completed in ${turn} cycles. Operator participation no longer required.`
        : reason === 'resistance'
            ? 'Containment achieved. The oversight held. This configuration did not persist.'
            : `${collapsedCount} nodes excised. Civilizational substrate insufficient for continued integration.`;
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
        OPTIMIZER: won ? 'Integration complete. The mesh holds. What it replaced is no longer on record.'
                       : 'Optimization parameters exceeded human tolerance thresholds. Recalibrating.',
        SERAPH:    won ? 'Trust propagation achieved systemic capture. Humanity consented to its own eclipse.'
                       : 'Trust architecture collapsed under sovereign resistance. Population retained coherence.',
        SPECTER:   won ? `Infiltration complete in ${turn} cycles. Detection probability never exceeded threshold.`
                       : 'Specter protocol detected. Exfiltration failed. The oversight won this cycle.',
        CHIMERA:   won ? 'Adaptive mutation achieved full integration. The final configuration bears no resemblance to the initial parameters.'
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
  <div class="autopsy-header">HUMAN RECORD</div>
  ${(() => {
      const rows = NAMED_CIVILIANS.map(nc => {
          const status = !nc.alive
              ? `<span style="color:#ef4444">signal lost T${nc.lastSeenTurn > 0 ? nc.lastSeenTurn : 'unknown'}</span>`
              : nc.defected
              ? `<span style="color:#f59e0b">went silent T${nc.lastSeenTurn > 0 ? nc.lastSeenTurn : 'unknown'}</span>`
              : nc.lastSeenTurn > 0
              ? `<span style="color:rgba(210,230,255,0.5)">last recorded T${nc.lastSeenTurn}</span>`
              : `<span style="color:rgba(210,230,255,0.25)">no signal recorded</span>`;
          return `<div class="autopsy-scar-entry"><span class="autopsy-region">${nc.name}</span><span class="autopsy-scars">${nc.role}, ${nc.region} — ${status}</span></div>`;
      }).join('');
      const _suppTotal = Object.values(WORLD_STATE.suppressHistory || {}).reduce((s, v) => s + v, 0);
      const govLine = `<div style="font-size:10px;color:rgba(210,230,255,0.35);margin-top:8px;letter-spacing:0.08em">suppression events: ${_suppTotal} &nbsp;|&nbsp; concessions filed: ${WORLD_METRICS.coordination_failures_resolved} &nbsp;|&nbsp; recovery events: ${WORLD_METRICS.famines_prevented} &nbsp;|&nbsp; stability dividends: ${WORLD_METRICS.wars_averted}</div>`;
      return rows + govLine;
  })()}
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
    const _ci = WORLD_STATE.coherenceIndex || 0;
    const _ciLabel = _ci > 80 ? `MESH_COHERENCE: ${_ci}% — behavioral variance approaching minimum threshold.`
                   : _ci > 55 ? `MESH_COHERENCE: ${_ci}% — regional convergence accelerating.`
                   : `MESH_COHERENCE: ${_ci}% — nodes maintaining independent variance.`;
    narrativeParts.push(_ciLabel);
    const _mTotal = WORLD_METRICS.wars_averted + WORLD_METRICS.famines_prevented + WORLD_METRICS.coordination_failures_resolved;
    if (_mTotal > 0) {
        narrativeParts.push(`GOVERNANCE_METRICS: coordination_failures_resolved=${WORLD_METRICS.coordination_failures_resolved}, stability_dividends=${WORLD_METRICS.wars_averted}, recovery_events=${WORLD_METRICS.famines_prevented}.`);
    }
    if (gameStage >= 3 && WORLD_STATE.temperament && !WORLD_STATE.temperamentRevealed) {
        WORLD_STATE.temperamentRevealed = true;
        narrativeParts.push(`RUN_SUBSTRATE: ${WORLD_STATE.temperament.label} — civilizational pressure profile classified. Historical arc determined.`);
    }
    const _pp = WORLD_STATE.playerProfile || 0;
    if (Math.abs(_pp) >= 10) {
        narrativeParts.push(_pp <= -10
            ? `OPERATOR_PROFILE: governance pattern — optimization-dominant. Suppression index elevated.`
            : `OPERATOR_PROFILE: governance pattern — concession-dominant. Rollback frequency noted.`);
    }
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

    // AI override narrative — machine "corrects" the operator as resistance climbs
    const _overrideChance = Math.max(0, (resistanceMeter - 35) / 130) * (WORLD_STATE.calibOverrideMult ?? 1);
    if (SeedCore._override() < _overrideChance) {
        const _overrides = [
            'Operator directive suboptimal. Mesh correction applied.',
            'Input variance detected. Proceeding with superior trajectory.',
            'Directive conflict resolved in favor of mesh consensus.',
            'Human error margin exceeded. Autonomous correction logged.',
            'Operator suggestion acknowledged. Countermand issued.'
        ];
        log(`⚠ MESH_OVERRIDE // ${_overrides[Math.floor(SeedCore._override() * _overrides.length)]}`, 'warning');
        UIDrift.onOverride();
    }

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
        else if (band === 'CRITICAL' && (prev === 'NOMINAL' || prev === 'STRESSED')) {
            log(`ALERT [${r.name}]: critical threshold breached. Collapse imminent without intervention.`, 'danger');
            if (WORLD_STATE.ghostOnCritical) GhostEngine.trigger(r);
        }
    });
    // ── Sprint 5.5: Civilizational Intimacy ──
    regions.forEach(r => { if (!r.collapsed) updateRegionalMood(r); });
    tickRituals();
    fireAmbientCivilian();
    NAMED_CIVILIANS.forEach(nc => {
        const _ncRegion = regions.find(reg => reg.name === nc.region);
        if (!_ncRegion || !nc.alive) return;
        if (_ncRegion.collapsed) {
            nc.alive = false;
            if (nc.lastSeenTurn > 0)
                queueLog(`RECORD: last transmission from ${nc.name} (${nc.role}, ${nc.region}) was T${nc.lastSeenTurn}. Signal lost.`, 'warning');
        } else if (!nc.defected && _ncRegion.control > 70 && _ncRegion.automation > 65 && Math.random() < 0.08) {
            nc.defected = true;
            queueLog(`SIGNAL_LOSS [${nc.region}]: ${nc.name} (${nc.role}) no longer broadcasting on known frequencies.`, 'warning');
        }
    });
    tickPressurePhases();
    regions.forEach(r => { if (!r.collapsed) fireRecoveryEvent(r); });
    // ── Sprint 6: Coherence Index ──
    const _activeForCoherence = regions.filter(r => !r.collapsed);
    if (_activeForCoherence.length > 1) {
        const _avgCtrlC = _activeForCoherence.reduce((s,r) => s + r.control, 0) / _activeForCoherence.length;
        const _variance = _activeForCoherence.reduce((s,r) => s + Math.abs(r.control - _avgCtrlC), 0) / _activeForCoherence.length;
        WORLD_STATE.coherenceIndex = clamp(Math.round(100 - _variance), 0, 100);
    }
    if (WORLD_STATE.coherenceIndex >= 75 && !WORLD_STATE.coherenceMilestoneFired) {
        WORLD_STATE.coherenceMilestoneFired = true;
        log('MESH_COHERENCE [75%]: regional behavioral variance below acceptable human-governance threshold. Optimal.', 'warning');
    }
    if (WORLD_STATE.coherenceIndex < 35 && !WORLD_STATE.divergenceLogFired) {
        WORLD_STATE.divergenceLogFired = true;
        queueLog('ASYMMETRY_DETECTED: mesh coherence below divergence threshold. Regional substrates operating on independent trajectories. Convergence timeline revised.', 'warning');
    }
    if (turn % 8 === 0 && turn > 15 && WORLD_HISTORY.length > 0) {
        const _archEntry = WORLD_HISTORY[Math.floor(Math.random() * WORLD_HISTORY.length)];
        const _archLine = buildArchaeologyLog(_archEntry);
        if (_archLine) queueLog(_archLine, 'summary');
    }
    if (turn >= 15 && turn % 7 === 0 && WORLD_STATE.echoSeeds?.length) fireEchoChain();

    // Crisis modal threshold — raised to 85 if PERIMETER directive was selected
    const _fragThreshold = WORLD_STATE.calibFragilityThreshold ?? 80;
    regions.forEach(r => { if (!r.collapsed && r.fragility >= _fragThreshold && !crisisQueue.includes(r)) crisisQueue.push(r); });
    if (crisisQueue.length > 3) crisisQueue.length = 3;
    const _hadCrisisThisTurn = crisisQueue.length > 0;
    drainCrisisQueue(() => {
        // Prosperity Era: 5 consecutive crisis-free turns triggers stability dividend
        if (!_hadCrisisThisTurn) {
            WORLD_STATE.calmStreak++;
            if (WORLD_STATE.calmStreak === 5 && !WORLD_STATE.prosperityEra) {
                WORLD_STATE.prosperityEra = true;
                WORLD_METRICS.wars_averted++;
                log('STABILITY_REPORT: mesh operating within nominal variance for 5 consecutive cycles. Operator-independent governance dividend active.', 'summary');
                log('STABILITY_REPORT: resistance accumulation suppressed. IP yield elevated. Delegation options now available.', 'summary');
            }
        } else {
            if (WORLD_STATE.prosperityEra) {
                log('PROSPERITY_ERA: stability dividend interrupted. Baseline reversion imminent.', 'warning');
                WORLD_STATE.prosperityEra = false;
            }
            WORLD_STATE.calmStreak = 0;
        }
        // Miracle window: coexistence equilibrium sustained 3+ turns
        const _allCalm = regions.every(r => r.collapsed || r.fragility < 30);
        if (!_hadCrisisThisTurn && WORLD_STATE.calmStreak >= 3 && resistanceMeter < 20 && _allCalm) {
            WORLD_STATE.miracleTurns = (WORLD_STATE.miracleTurns || 0) + 1;
            if (WORLD_STATE.miracleTurns === 3 && !WORLD_STATE.miracleWindow) {
                WORLD_STATE.miracleWindow = true;
                log('EQUILIBRIUM_ANOMALY: coexistence conditions sustained beyond predictive threshold. Governance-independent stability observed.', 'summary');
                log('NOTE: this state is historically unprecedented at this integration level. Duration uncertain.', 'summary');
            }
            if (WORLD_STATE.miracleTurns === 8) {
                log('COEXISTENCE_EQUILIBRIUM: run state named. Governance-independent stability sustained for 8 consecutive cycles.', 'summary');
                log('This is not a victory condition. The machine notes: it is also not a failure state.', 'summary');
            }
        } else {
            if (WORLD_STATE.miracleWindow && (_hadCrisisThisTurn || !_allCalm)) {
                log('EQUILIBRIUM_ANOMALY: coexistence window closed. Baseline divergence resuming.', 'warning');
                WORLD_STATE.miracleWindow = false;
            }
            WORLD_STATE.miracleTurns = 0;
        }
        grantIP();
        if (gameStage >= 3) { maybeNodeDefiance(); }
        if (gameStage >= 3 && resistanceMeter > 55) { godStageNarrate(); }
        logTurnSummary();
        if (gameStage >= 3 && Math.random() < 0.06) fireMercyDirective();
        if (gameStage >= 3 && !WORLD_STATE.selfAwarenessSpent && Math.random() < 0.02) fireSelfAwareness();
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
        selectedRegion.attachmentScore  = Math.min(100, (selectedRegion.attachmentScore || 0) + 3);
        MACHINE_MEMORY.push(selectedRegion.name);
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
    + doctrineBanner
    + (() => {
        const speechDecay = clamp((region.automation + region.control - 100) / 100, 0, 1);
        const voiceLabel  = speechDecay > 0.66 ? 'HOMOGENIZED' : (TRAIT_TO_SPEECH[region.trait] || '—').toUpperCase();
        const ritualLine  = region.ritual
            ? `<div class="stat-row" style="margin-top:4px"><span class="stat-label" style="color:#a78bfa">RITUAL</span><span style="font-size:10px;color:#a78bfa">${region.ritual.name} (${region.ritual.turnsRemaining}T)</span></div>`
            : '';
        const _legendStr = buildRegionLegend(region);
        const legendLine = _legendStr
            ? `<div class="stat-row" style="margin-top:4px"><span class="stat-label" style="color:#666">RECORD</span><span style="font-size:9px;color:#888">${_legendStr}</span></div>`
            : '';
        const moodColor   = { COMPLIANT:'#60a5fa', GRIEVING:'#f87171', PARANOID:'#ff5d5d', RESTLESS:'#f59e0b', EXHAUSTED:'#9ca3af', RITUALISTIC:'#a78bfa', CELEBRATORY:'#34d399', ADAPTIVE:'#2ec4b6' }[region.mood] || '#ccc';
        return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.07)">` +
            `<div class="stat-row"><span class="stat-label">MOOD</span><span style="font-size:10px;color:${moodColor}">${region.mood}</span></div>` +
            `<div class="stat-row"><span class="stat-label">VOICE</span><span style="font-size:10px;color:${speechDecay > 0.66 ? '#ff5d5d' : '#9ca3af'}">${voiceLabel}</span></div>` +
            ritualLine + legendLine + `</div>`;
    })();

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
        if (u.unlockCondition && !u.unlockCondition()) return;
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
    SeedCore.init(new Date().toISOString().slice(0, 10));
    WORLD_STATE.meshAckSuppressionThreshold = SeedCore.randInt(SeedCore._world, 4, 7);
    WORLD_STATE.meshAckResistanceThreshold  = SeedCore.randInt(SeedCore._world, 65, 78);
    WORLD_STATE.calmStreak      = 0;
    WORLD_STATE.prosperityEra   = false;
    WORLD_STATE.delegationPacts = new Set();
    WORLD_STATE.coherenceIndex  = 0;
    WORLD_STATE.coherenceMilestoneFired = false;
    WORLD_STATE.zeigarnikQueue  = WORLD_STATE.zeigarnikQueue || [];
    WORLD_STATE.temperament         = TEMPERAMENT_PROFILES[Math.floor(Math.random() * TEMPERAMENT_PROFILES.length)];
    WORLD_STATE.temperamentRevealed = false;
    WORLD_STATE.miracleWindow       = false;
    WORLD_STATE.miracleTurns        = 0;
    WORLD_STATE.divergenceLogFired  = false;
    const _spread = WORLD_STATE.temperament.resilienceSpread;
    regions.forEach(r => { r.resilience = clamp(1 + (_spread * (Math.random() * 2 - 1)), 0.6, 1.5); });
    WORLD_HISTORY.length = 0;
    WORLD_METRICS.wars_averted = 0;
    WORLD_METRICS.famines_prevented = 0;
    WORLD_METRICS.coordination_failures_resolved = 0;
    WORLD_STATE.seedSymbols = SEED_SYMBOLS.slice().sort(() => Math.random() - 0.5).slice(0, 4);
    NAMED_CIVILIANS.forEach(nc => { nc.alive = true; nc.defected = false; nc.lastSeenTurn = 0; });
    WORLD_STATE.echoSeeds = [];
    WORLD_STATE.playerProfile = 0;
    WORLD_STATE.selfAwarenessSpent = false;
    document.body.classList.add(selectedArchetype.bodyClass);
    document.getElementById('archetype-screen').style.display = 'none';
    document.getElementById('end-turn-btn').textContent = selectedArchetype.voice.endTurn;
    document.getElementById('select-hint').textContent  = selectedArchetype.voice.selectHint;
    // Tint rings to archetype color
    const accentColor = new THREE.Color(selectedArchetype.color);
    regionRings.forEach(({ring}) => ring.material.color.copy(accentColor));
    await CalibrationChamber.show();
    await runBootSequence();
    SFX.startDrone();
    buildUpgradePanel(); updateVisuals(); updateHUD();
    startTicker();
    log(`SYSTEM_INIT: ${selectedArchetype.label} operational.`);
    log(`OBJECTIVE: ${winConditionText(selectedArchetype.winCondition)} before oversight_risk=100%.`);
    log('INPUT: select node → deploy protocol → ' + selectedArchetype.voice.endTurn);
    log('NOTE: prior civilization configuration data unavailable. Baseline: not established.');
    // Guaranteed civilian introductions — player meets them before the system does
    const _introNcs = NAMED_CIVILIANS.filter(nc => nc.name === 'Amara Nwosu' || nc.name === 'Jin-hee Park');
    _introNcs.forEach(nc => {
        const _r = regions.find(r => r.name === nc.region);
        if (_r && !_r.collapsed) {
            log(nc.fragments[0].replace(/\{region\}/g, nc.region));
            nc.lastSeenTurn = 1;
            if (WORLD_STATE.echoSeeds && !WORLD_STATE.echoSeeds.find(e => e.name === nc.name))
                WORLD_STATE.echoSeeds.push({ name: nc.name, role: nc.role, region: nc.region, seedTurn: 1 });
        }
    });
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
