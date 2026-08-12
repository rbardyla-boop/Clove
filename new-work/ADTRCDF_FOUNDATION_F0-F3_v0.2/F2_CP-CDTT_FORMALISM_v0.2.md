# F2 — CP-CDTT Formalism

**Project:** ADTRCDF Foundation Program  
**Methodological object:** Constraint-Preserving Cross-Domain Theory Transfer (CP-CDTT)  
**Version:** v0.2  
**Date:** 2026-08-10  
**Status:** PROVISIONAL FORMALIZATION — external evaluator gate not yet cleared  
**Parent artifacts:** F0 Field Charter v0.1; F1 Prior-Art Collision Map v0.1

## 0. Purpose

F2 answers one question:

> **Can a cross-domain transfer be defined precisely enough that a reviewer can distinguish a scientifically legal transfer from an attractive but scientifically illegal analogy without relying on taste, eloquence, or an LLM's confidence?**

The answer developed here is **yes, provisionally**, by separating levels of transfer and requiring explicit proof obligations for each level.

The central move is to reject a binary notion of analogy. A mapping can be useful and structurally correct at one level while becoming false when promoted to a stronger claim.

Examples:

- Heat conduction and molecular diffusion can share a transport equation without temperature and concentration being the same physical quantity.
- A hydraulic circuit can emulate some electrical-circuit relations without water carrying electric charge.
- The atom/solar-system analogy can preserve a center–orbit relation as a teaching analogy while failing as a classical physical model of atomic stability.
- Weak-field gravitoelectromagnetic equations can exhibit formal similarities to electromagnetism without licensing the existence of a gravitational Faraday cage.

Therefore CP-CDTT classifies the **maximum scientifically legal claim level**, not whether an analogy is simply "good" or "bad."

---

## 1. Prior-art boundary

This formalism is deliberately narrower than general analogical reasoning. Recent work already represents analogy through object mappings plus shared relations and uses cross-domain relational structure to generate novel scientific solutions. CP-CDTT does not claim that relational structure mapping is new. Its candidate contribution is the addition of typed scientific objects, domain constraints, empirical envelopes, explicit transfer scopes, and mandatory proof obligations that block escalation from structural resemblance to mechanistic or predictive claims.

CP-CDTT also borrows established concepts rather than reinventing them:

- **Structure mapping / analogical reasoning:** relational correspondence across domains.
- **Morphisms:** structure-preserving mappings as a formal inspiration.
- **Structural causal models and invariance:** causal mechanisms cannot be assumed transportable merely from observational similarity.
- **Dimensional analysis / metrology:** equations involving physical quantities must be well-typed and dimensionally homogeneous in the target domain.
- **PROV-O:** provenance entities, activities, agents, derivations, and source lineage.
- **OWL / SHACL:** formal vocabulary and machine-checkable graph constraints.
- **QUDT / SI:** quantity kinds, units, and dimension vectors.

The novelty question remains empirical: does the integrated CP-CDTT protocol improve validated discovery yield over simpler methods?

---

## 2. Fundamental objects

### 2.1 Domain Theory Package

A scientific domain theory package is defined as:

\[
\mathcal{D}=\langle \Sigma,\mathcal{R},\mathcal{M},\mathcal{C},\mathcal{E},\mathcal{P}\rangle
\]

where:

- \(\Sigma\) — **typed signature**: entities, quantities, parameters, states, events, processes, controls, outputs, and their semantic roles;
- \(\mathcal{R}\) — **formal relations**: equations, inequalities, logical relations, transformations, algorithms, constitutive laws, and statistical relations;
- \(\mathcal{M}\) — **mechanism model**: causal graph, structural equations, process graph, or explicit statement that no mechanism is claimed;
- \(\mathcal{C}\) — **constraint set**: assumptions, boundary conditions, regime restrictions, invariants, conservation laws, symmetries, and admissibility conditions;
- \(\mathcal{E}\) — **empirical envelope**: observed ranges, uncertainty intervals, null results, exclusions, calibration data, and known failure regimes;
- \(\mathcal{P}\) — **provenance**: source, derivation lineage, version, evidence type, timestamp, and responsible agent or author.

A theory package is not required to contain every possible item. Missing items are represented explicitly as `UNKNOWN`, never silently filled by analogy.

### 2.2 Typed scientific symbol

Every mapped symbol SHOULD have, where applicable:

\[
q=\langle id,type,role,dimension,unit,domain,scale,uncertainty,provenance\rangle
\]

Examples of `role` include:

`STATE`, `FLUX`, `SOURCE`, `SINK`, `CONTROL`, `RESPONSE`, `POTENTIAL`, `RATE`, `NOISE`, `PARAMETER`, `CONSTRAINT`.

The role layer is important because two mapped variables can have different physical dimensions while playing the same structural role. Temperature and concentration, for example, need not share dimensions for the heat/diffusion equations to exhibit corresponding transport structure.

### 2.3 Transfer proposal

A transfer from source theory \(\mathcal D_s\) to target theory \(\mathcal D_t\) is:

\[
\tau = \langle \mathcal D_s,\mathcal D_t,L,\mu,G,H\rangle
\]

where:

- \(L\) is the **claimed transfer level**;
- \(\mu\) is a family of **partial mappings** between source and target objects;
- \(G\) is the set of **guard conditions** under which the transfer is claimed to hold;
- \(H\) is the proposed target-domain hypothesis or consequence.

The mapping family may include:

\[
\mu = \{\mu_\Sigma,\mu_R,\mu_M,\mu_C,\mu_E\}
\]

All mappings are partial by default. Unmapped source structure must be declared rather than ignored.

---

## 3. Transfer-level ladder

CP-CDTT defines six levels. A transfer can be legal at a lower level and illegal at a higher one.

### L0 — Heuristic resemblance

A metaphor, visual similarity, or loose conceptual association.

Scientific status: **search aid only**.

No inference may be exported from source to target.

### L1 — Structural analogy

There is an explicit mapping between objects/roles and at least one preserved relational pattern.

Required claim:

> "The two systems share this declared relational structure."

No claim is made that equations, physical mechanisms, parameters, or causal laws transfer.

### L2 — Formal transfer

A mathematical, logical, algorithmic, or representational relation can be translated into the target domain and remains well-formed there.

Examples include transferring a differential-equation form, optimization structure, graph operation, or conservation-style bookkeeping relation.

L2 **does not imply shared physical mechanism**.

### L3 — Mechanistic transfer

A source mechanism is proposed to operate in the target, or a target mechanism is shown to instantiate the same causal/process structure.

This level requires substantially stronger obligations: causal compatibility, admissible target entities/processes, target-specific evidence, and preservation of relevant constraints.

### L4 — Predictive transfer

The transferred structure yields at least one target-domain prediction that:

1. was not used merely to construct the mapping;
2. is quantitatively or formally discriminating where the domain permits;
3. differs from a relevant null or baseline;
4. can be falsified by evidence, computation, or experiment.

### L5 — Validated transfer

A prediction generated through the transfer survives a preregistered or otherwise independently checkable test, with uncertainty and alternative explanations addressed.

Replication status is represented separately and can strengthen, but is not identical to, L5.

---

## 4. The legality rule

Let \(Req(L)\) be the mandatory proof obligations for transfer level \(L\).

Each proof obligation has one of four states:

`PASS`, `FAIL`, `UNKNOWN`, `NOT_APPLICABLE`.

For a claimed level \(L\):

\[
Legal_L(\tau) \iff \forall p\in Req(L),\ status(p)=PASS
\]

with one exception: an obligation explicitly marked `NOT_APPLICABLE` by the ontology may be omitted if the reason for non-applicability is itself recorded and valid.

### 4.1 Blocking semantics

- If any mandatory obligation is `FAIL`, the transfer is **ILLEGAL at L and all stronger levels**.
- If none fail but one or more mandatory obligations are `UNKNOWN`, the transfer is **UNRESOLVED/BLOCKED at L**.
- Only all-mandatory-`PASS` permits promotion to that level.
- Failure at L3 does **not** erase a legitimate L2 formal correspondence.

Define:

\[
L_{max}(\tau)=\max\{L:Legal_L(\tau)\}
\]

The scientific claim is constrained to \(L_{max}\).

This is the core anti-slippage rule.

---

## 5. Proof obligations

### PO-00 — Source and target grounding

**Question:** Are both domain packages grounded in identifiable scientific sources or explicitly marked synthetic?

Pass requires provenance for the structures being mapped.

Purpose: prevents an AI from inventing the source phenomenon and then "transferring" its own invention.

### PO-01 — Explicit mapping declaration

**Question:** Is every claimed source→target correspondence explicit?

Pass requires mapped objects/roles/relations and an explicit list of material source elements that are not mapped.

Purpose: prevents selective analogy where inconvenient relations disappear silently.

### PO-02 — Type and role compatibility

**Question:** Do mapped elements occupy compatible structural roles for the claimed inference?

The source and target types do not have to be identical, but the mapping must state why the role correspondence is legitimate.

A `STATE` may map to another `STATE`; a `FLUX` may map to another transported flux. Mapping a parameter to an outcome merely because both are scalar values is illegal.

### PO-03 — Relation preservation

For each transferred relation \(r_s\), define a translation \(\Phi\) into the target vocabulary.

A strong exact form is:

\[
\Phi_Y\circ r_s = r_t\circ(\Phi_{X_1},...,\Phi_{X_n})
\]

A numerical or approximate form may instead require:

\[
\|\Phi(r_s)-r_t\| \le \epsilon
\]

for a predeclared tolerance and target regime.

A symbolic form may require that \(\Phi(r_s)\) is derivable from target assumptions:

\[
\mathcal C_t \vdash \Phi(r_s)
\]

Pass requires the relation to commute, derive, or fit under the declared semantics. Mere verbal similarity does not satisfy PO-03.

### PO-04 — Target formal well-formedness

**Question:** After translation, are the expressions legal objects in the target theory?

Checks may include:

- domain and codomain compatibility;
- differentiability/integrability requirements;
- probability normalization;
- positivity constraints;
- valid matrix/tensor shape;
- logical satisfiability;
- numerical stability where claimed.

### PO-05 — Dimensional and metrological validity

For physical quantities, target equations must be dimensionally homogeneous and unit-consistent.

Crucially, CP-CDTT does **not** demand that source and target mapped variables have identical dimensions. It demands that the translated target relation be internally valid.

Thus heat temperature \(T\) may map structurally to concentration \(c\), provided the target transport coefficient carries the dimensions required by the target equation.

A dimension vector can be represented over SI base dimensions:

\[
\delta(q)=(L,M,T,I,\Theta,N,J)
\]

and target expressions must satisfy dimension balance term-by-term.

Dimensionless/nondimensional transfers are legal when the nondimensionalization map is explicit.

### PO-06 — Assumption transport

Every source assumption used by the transferred result must be classified:

`PRESERVED`, `REPLACED`, `TARGET-VERIFIED`, `IRRELEVANT`, or `UNSATISFIED`.

No assumption may disappear silently.

Examples:

- linear response;
- independence;
- stationarity;
- closed system;
- equilibrium;
- well-mixed population;
- homogeneous medium;
- risk-neutral market;
- incompressible flow.

`UNSATISFIED` on a required assumption is a `FAIL`.

### PO-07 — Boundary, scale, and regime coverage

A transfer must state the region in which it is claimed to apply:

\[
G=\{x: g_1(x),g_2(x),...,g_k(x)\}
\]

Examples include Reynolds number, temperature, energy scale, length scale, concentration range, weak-field limit, low-frequency limit, sample size, or time horizon.

Extrapolating beyond the supported regime is a separate claim requiring new evidence.

### PO-08 — Causal/mechanistic compatibility

Mandatory for L3+.

Pass requires one of:

1. a target causal/process model that instantiates the transferred mechanism;
2. direct target evidence for the mechanism;
3. an explicit mechanistic hypothesis with no known contradiction, marked `UNRESOLVED` until tested.

Observational similarity alone cannot pass PO-08.

If a formal mapping exists but the target causal mechanism is different, the transfer can remain L2 while failing L3.

### PO-09 — Invariant and conservation compatibility

Relevant target invariants and conservation laws must not be violated.

Examples:

- conservation of mass/energy/charge/momentum;
- probability conservation;
- normalization;
- symmetries;
- thermodynamic inequalities;
- causal ordering.

If the target system is open, flux through the boundary must be included rather than declaring conservation "broken."

### PO-10 — Parameter transport and calibration

Source numerical constants do not transfer merely because equations look the same.

Every transferred parameter must be classified:

`STRUCTURAL_ONLY`, `REESTIMATED`, `DERIVED`, `DIMENSIONLESS_UNIVERSAL`, or `UNJUSTIFIED_COPY`.

`UNJUSTIFIED_COPY` is a failure.

### PO-11 — Empirical-envelope compatibility

The target hypothesis must be checked against known measurements, null results, upper/lower bounds, and established failure regimes.

Pass requires:

\[
H_t \not\perp \mathcal E_t
\]

meaning the proposal does not contradict the target empirical envelope within declared uncertainty, unless the proposal explicitly predicts that a specific prior result is wrong and supplies a reason and discriminating test.

### PO-12 — Uncertainty and sensitivity

For L4+ quantitative claims, uncertainty in mapped parameters and target measurements must propagate into the predicted effect.

A candidate is not testable merely because it produces a number. It must produce a predicted interval or sensitivity relation adequate to compare against measurement capability.

### PO-13 — Discriminating target prediction

Mandatory for L4+.

At least one prediction must distinguish the transfer hypothesis from a relevant baseline/null.

A prediction restating known target data used to invent the mapping does not count.

### PO-14 — Falsification route and negative control

Mandatory for L4+.

The transfer must define:

- what observation would count against it;
- at least one alternative explanation or negative control where applicable;
- the decision rule for rejection.

### PO-15 — Novelty / prior-art check

Mandatory before any novelty claim.

The mapping, mechanism, and predicted consequence must be searched separately. "The exact wording is new" is not novelty.

A known transfer can still be scientifically valid; it is simply not a new discovery.

### PO-16 — Provenance completeness

Every material claim and transformation must retain lineage to evidence and transformation steps. Derived artifacts must identify what they were derived from and by which operation or agent.

---

## 6. Transfer-level obligation matrix

Legend: `M` mandatory, `C` conditional when applicable, `-` not required.

| Obligation | L1 Structural | L2 Formal | L3 Mechanistic | L4 Predictive | L5 Validated |
|---|---:|---:|---:|---:|---:|
| PO-00 Grounding | M | M | M | M | M |
| PO-01 Mapping declaration | M | M | M | M | M |
| PO-02 Type/role compatibility | M | M | M | M | M |
| PO-03 Relation preservation | M | M | M | M | M |
| PO-04 Formal well-formedness | - | M | M | M | M |
| PO-05 Dimensional/metrological | - | C | C | C | C |
| PO-06 Assumptions | - | M | M | M | M |
| PO-07 Regime coverage | - | M | M | M | M |
| PO-08 Mechanism/causality | - | - | M | M | M |
| PO-09 Invariants/conservation | - | C | M | M | M |
| PO-10 Parameter calibration | - | C | M | M | M |
| PO-11 Empirical envelope | - | C | M | M | M |
| PO-12 Uncertainty/sensitivity | - | - | C | M | M |
| PO-13 Discriminating prediction | - | - | - | M | M |
| PO-14 Falsification/control | - | - | - | M | M |
| PO-15 Prior-art/novelty | - | - | - | C | C |
| PO-16 Provenance | M | M | M | M | M |

---

## 7. Illegal-analogy taxonomy

CP-CDTT distinguishes why a transfer fails.

### IA-01 — Lexical substitution

Terms sound similar, but no relation-preserving mapping exists.

### IA-02 — Type/role mismatch

Mapped objects occupy incompatible roles.

### IA-03 — Relation break

A material relation in the source does not survive translation.

### IA-04 — Formal/domain error

The transferred mathematics is undefined, ill-posed, or violates target mathematical constraints.

### IA-05 — Dimensional error

The target equation is dimensionally inconsistent or units are improperly copied.

### IA-06 — Assumption laundering

A source assumption necessary to the result is omitted or falsely treated as universal.

### IA-07 — Regime extrapolation

The transfer is applied outside its justified scale or boundary regime.

### IA-08 — Mechanism smuggling

A formal/structural analogy is presented as evidence that the same physical or causal mechanism exists.

### IA-09 — Causal inversion / confounding

Correlation or inverse mapping is treated as causal transport without justification.

### IA-10 — Conservation/invariant violation

The target claim violates a required invariant or conservation law without accounting for boundary exchange or new physics.

### IA-11 — Parameter smuggling

A source constant or parameter is copied numerically into the target without derivation or calibration.

### IA-12 — Empirical collision

The transfer contradicts known target evidence or excluded parameter ranges.

### IA-13 — Ontological identity error

Mathematical isomorphism or representational similarity is mistaken for identity of the underlying things.

### IA-14 — Non-falsifiable escalation

A strong mechanism or predictive claim is made without a possible rejection test.

### IA-15 — Provenance/novelty failure

The purported source, target evidence, or novelty cannot be verified.

---

## 8. Three worked examples

### 8.1 Fourier heat conduction → Fick diffusion

Source relation in one dimension:

\[
J_q=-k\frac{\partial T}{\partial x}
\]

Target relation:

\[
J_m=-D\frac{\partial c}{\partial x}
\]

A legal transfer does **not** assert \(T=c\), \(k=D\), or that heat and molecules are the same mechanism.

It asserts a shared constitutive pattern:

`FLUX = - TRANSPORT_COEFFICIENT × GRADIENT(STATE)`

with a conservation relation producing corresponding diffusion equations under appropriate conditions.

- L1: PASS — roles and relation map.
- L2: PASS — target equation is well-formed and dimensionally valid under target units.
- L3: can PASS only with target-specific molecular transport mechanism/evidence; it is not inherited from heat conduction.
- L4/L5: require target-specific predictions/tests.

This is exactly the type of transfer CP-CDTT should preserve.

### 8.2 Atom ↔ solar system

Possible mapping:

`central massive/charged body ↔ nucleus`  
`orbiting body ↔ electron`  
`attractive central interaction ↔ electrostatic attraction`

This can pass L1 as a limited relational analogy.

Promotion fails:

- classical accelerating charges radiate;
- atomic states are quantum, not classical planetary trajectories;
- angular momentum/energy spectra are quantized;
- the force laws have different charge/mass structure despite both inverse-square forms in simple cases.

Therefore the analogy may be pedagogically useful at L1 but is scientifically illegal as a classical L3 atomic mechanism.

The formalism does not call the entire analogy "false." It identifies the exact point where it becomes false.

### 8.3 Electromagnetism ↔ weak-field gravitation → "gravity shielding"

Weak-field general relativity admits gravitoelectromagnetic-like mathematical forms in certain gauges and limits. That can support a bounded L2 formal analogy.

It does **not** by itself license:

`positive/negative electric charge ↔ positive/negative gravitational mass charge`

or:

`Faraday cage ↔ gravitational shield`.

A shielding claim must separately pass target typing, source-term structure, conservation/invariant checks, empirical bounds, and a mechanistic route. In standard general relativity ordinary matter does not provide the charge-sign and conductor response required by the electrostatic Faraday-cage mechanism.

Thus the useful formal analogy survives while the seductive engineering extrapolation is rejected as mechanism smuggling plus target-physics mismatch.

---

## 9. Decision procedure

For each proposed transfer:

1. **Freeze the claimed level.** What exactly is being asserted: resemblance, formal relation, mechanism, prediction, or validated result?
2. **Construct source and target theory packages.** Missing material fields become `UNKNOWN`.
3. **Declare mappings.** Include unmapped material structure.
4. **Generate obligations from the claimed level and object types.** Physical quantities automatically activate dimensional checks; mechanistic claims activate causal obligations; predictive claims activate uncertainty/falsification obligations.
5. **Evaluate obligations independently where possible.** Formal tools, dimensional engines, theorem provers, simulations, evidence searches, and human domain experts can each own different obligations.
6. **Compute maximum legal level.** `UNKNOWN` blocks; `FAIL` rejects the claimed level.
7. **Record failure codes.** Do not discard failed transfers without the reason; negative results become reusable knowledge.
8. **Only then generate or evaluate target predictions.**

---

## 10. Decisive classification benchmark

F2 is not cleared merely because the definitions sound reasonable. The formalism must support reproducible classification.

### 10.1 Frozen benchmark structure

The accompanying gold corpus contains:

- 10 scientifically productive or successful cross-domain transfers;
- 10 seductive transfers that are valid only at a lower level than the proposed claim, or fail entirely.

Every case contains:

- source and target domains;
- proposed claim;
- intended claim level;
- gold maximum legal level;
- expected failing proof obligations;
- illegal-analogy codes;
- short rationale.

The evaluator packet omits the gold labels.

### 10.2 Independent evaluator acceptance criteria

Before Foundation v1.0, at least two evaluators who did not author the gold key should classify the frozen packet.

Pass thresholds:

1. **Exact maximum-level agreement:** >= 85% against adjudicated gold.
2. **Weighted Cohen's kappa between evaluators:** >= 0.80.
3. **Dangerous overclaim false-positive rate:** <= 5% for cases where the proposed claim is mechanistic/predictive but the gold level is L2 or below.
4. **Failure-reason agreement:** >= 75% on at least one primary illegal-analogy code for rejected claims.
5. `UNKNOWN`/blocked decisions are allowed and reported separately; evaluators must not be forced to hallucinate missing evidence.

If these thresholds fail, the ontology/formalism is revised before any agent architecture is built.

### 10.3 Why agreement matters

A scientific method that only its inventors can apply consistently is not a useful formal method. Inter-rater reproducibility is therefore part of the foundation, not an afterthought.

---

## 11. Internal consistency result

The v0.2 formalism was replayed against the 20-case hand-built corpus at the schema/rule level.

Result:

- all 20 cases can be represented without adding case-specific ontology fields;
- each proposed overclaim can be blocked by one or more named proof obligations;
- successful transfers can retain their lower-level scientific value without requiring ontological identity or source-parameter copying;
- mixed cases can be represented by a maximum legal level rather than forced into binary valid/invalid labels.

This is an **internal consistency pass**, not the required independent evaluator pass.

---

## 12. F2 terminal ruling

**F2 STATUS: FORMALIZATION_PASS_WITH_EXTERNAL_VALIDATION_PENDING**

The decisive conceptual requirement is met provisionally: CP-CDTT can distinguish structural validity, formal validity, mechanistic validity, predictive validity, and empirical validation.

The formalism survives only if independent evaluators can apply it reproducibly and if later benchmark ablations show that its constraints improve net scientific yield rather than merely suppressing novelty.

### What F2 does not authorize

- no claim that CP-CDTT is a new field;
- no claim that the proof-obligation set is itself novel until publication-grade prior-art review;
- no automated agent architecture;
- no gravity-discovery claim;
- no replacement of domain expertise with ontology validation.

---

## 13. Source register used to constrain F2

1. Shen, A., Druckmann, S., & Zou, J. (2026). *Unlocking LLM Creativity in Science through Analogical Reasoning.* arXiv:2605.11258. Shared relational structure, object mappings, and cross-domain solution transfer.
2. Jansen, P., Clark, P., Downey, D., & Weld, D. S. (2026). *Generating Literature-Driven Scientific Theories at Scale.* ACL 2026. Theory synthesis desiderata including empirical support, prediction, novelty, and plausibility.
3. W3C. *PROV-O: The PROV Ontology* and *Constraints of the PROV Data Model.* Provenance representation and consistency constraints.
4. W3C. *OWL 2 Web Ontology Language* and *Shapes Constraint Language (SHACL).* Formal ontology representation and graph validation.
5. QUDT.org (2026 schema). *Quantities, Units, Dimensions and Types.* Quantity kinds, units, and dimension vectors.
6. NIST. *The International System of Units (SI), SP 330.* Dimensions of quantities, units, and metrological conventions.
7. OBO Foundry. *Ontology principles.* Reuse of existing relations, versioning, documentation, identifier stability, and maintenance.
8. Egri-Nagy, A. (2024/2025). *Morphisms (should be) everywhere.* Structure-preserving maps as a general reasoning formalism; used here as inspiration, not claimed as CP-CDTT novelty.
9. Montagna, F. (2026). *On the identifiability of causal graphs with the invariance principle.* Causal invariance does not remove the need for explicit assumptions and identifiability conditions.
10. Fick, A. (1855). *On Liquid Diffusion.* Historical diffusion/heat-conduction analogy.
11. Hodgkin, A. L., & Huxley, A. F. (1952). *A quantitative description of membrane current and its application to conduction and excitation in nerve.* Electrical network representation of membrane behavior.
12. Turing, A. M. (1952). *The Chemical Basis of Morphogenesis.* Reaction–diffusion mechanism applied to biological pattern formation.
13. Hopfield, J. J. (1982). *Neural networks and physical systems with emergent collective computational abilities.* PNAS 79:2554–2558.
14. Chilton, T. H., & Colburn, A. P. (1930s). Heat/mass/momentum transfer analogies and j-factor framework.

