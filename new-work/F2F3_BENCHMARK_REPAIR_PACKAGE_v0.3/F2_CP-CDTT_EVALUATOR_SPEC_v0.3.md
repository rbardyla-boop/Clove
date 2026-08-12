# F2 — CP-CDTT Formalism

**Project:** ADTRCDF Foundation Program  
**Methodological object:** Constraint-Preserving Cross-Domain Theory Transfer (CP-CDTT)  
**Version:** v0.3  
**Date:** 2026-08-10  
**Status:** PROVISIONAL FORMALIZATION — qualification-lattice repair; external evaluator gate not yet cleared  
**Parent artifacts:** F0 Field Charter v0.1; F1 Prior-Art Collision Map v0.1

## 0. Purpose

F2 answers one question:

> **Can a cross-domain transfer be defined precisely enough that a reviewer can distinguish a scientifically legal transfer from an attractive but scientifically illegal analogy without relying on taste, eloquence, or an LLM's confidence?**

The answer developed here is **yes, provisionally**, by separating qualification axes and requiring explicit proof obligations for every asserted axis.

The central move is to reject a binary notion of analogy. A mapping can be useful and structurally correct at one level while becoming false when promoted to a stronger claim.

A mapping may be scientifically useful on one axis while failing or remaining unclaimed on another. CP-CDTT therefore reports an **evidence-bounded qualification profile** rather than a single good/bad label or scalar maximum level.

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

## 3. Qualification lattice

The v0.2 scalar ladder is retired as the primary scientific representation. The blind-Gauntlet repair exposed a category error: **predictive success does not require mechanistic identity**. A formal model can make valid predictions without transferring the source domain's physical mechanism.

CP-CDTT v0.3 therefore represents five qualification axes:

- **S — Structural:** scientifically meaningful objects/roles/relations map across domains.
- **F — Formal:** translated equations, logical relations, algorithms, or statistical structures are well-formed in the target under explicit assumptions/regimes.
- **M — Mechanistic:** a target causal/process mechanism instantiates the claimed transferred mechanism.
- **P — Predictive:** the transfer yields a discriminating target prediction plus a falsification route.
- **V — Validated:** a P-qualified prediction survives a frozen, independently checkable validation test.

The dependency graph is:

\[
S \rightarrow F,\qquad F\rightarrow M,\qquad F\rightarrow P,\qquad P\rightarrow V
\]

Mechanistic and Predictive are **siblings**, not an ordinal sequence. Therefore a transfer may legitimately have:

\[
Q=(S,F,\neg M,P,V)
\]

for a validated formal/predictive model that makes no mechanistic-transfer claim. Conversely, a mechanistic hypothesis can be:

\[
Q=(S,F,M,\neg P,\neg V)
\]

until it produces a discriminating prediction.

For compact reporting, a qualification profile is written as, for example, `S+F+P+V; M_NOT_CLAIMED` or `S+F; M_FAIL`. No scalar “maximum legal level” may be used as the primary scientific result because it erases this branching structure.

### 3.1 Claim objects

Each axis has a frozen claim object:

\[
\tau^S,\tau^F,\tau^M,\tau^P,\tau^V.
\]

F extends S. M and P each extend F independently. V extends P. An axis claim may add assumptions, mappings, parameter semantics, mechanisms, or predictions, but may not silently rewrite a lower frozen claim. If it does, it becomes a new transfer version.

This axis-scoping is essential. A parameter may be correctly `REESTIMATED` in an F claim yet be illegally treated as a physically identical source parameter in an M claim. The M failure does not retroactively erase F.

### 3.2 Predictive derivation basis

Every P claim declares one of:

- `FORMAL` — prediction follows from the F-qualified target formalism; M is not required.
- `MECHANISTIC` — prediction relies on the M claim; M must pass.
- `HYBRID` — prediction relies on both formal and mechanistic transfer; both must pass.

This prevents a system from quietly borrowing mechanistic language to justify a prediction while later claiming it was “only mathematical.”

---

## 4. Legality semantics

Let axis \(A\in\{S,F,M,P,V\}\) have a frozen claim \(\tau^A\), active proof obligations \(Req(A)\), and dependency set \(Dep(A)\). Proof-obligation status is axis-scoped:

\[
\sigma(p,A)\in\{PASS,FAIL,UNKNOWN,NOT\_APPLICABLE\}.
\]

An axis is supported iff all dependencies are supported and every active mandatory obligation is `PASS`:

\[
Supported(A) \iff \Big(\forall D\in Dep(A), Supported(D)\Big) \land \Big(\forall p\in Req_M(A),\sigma(p,A)=PASS\Big) \land \Big(\forall p\in Req_C(A),\sigma(p,A)\in\{PASS,NOT\_APPLICABLE\}\Big).
\]

`NOT_APPLICABLE` is legal only for obligations explicitly conditional on that axis and only with a recorded applicability rationale. Mandatory obligations cannot be bypassed with N/A.

Axis disposition is:

- `SUPPORTED` — all required proof obligations pass.
- `FAILED` — at least one mandatory/activated obligation fails.
- `BLOCKED` — none fail but at least one mandatory/activated obligation is unknown.
- `NOT_CLAIMED` — no claim on that axis; this is not a failure.

For P claims with `MECHANISTIC` or `HYBRID` derivation basis, M is an additional dependency. For `FORMAL` P claims, M may remain `NOT_CLAIMED` or `FAILED` without automatically invalidating P, provided the P claim does not rely on the failed mechanism.

The closed-book benchmark is strictly evidence-bounded: facts absent from the frozen evidence bundle remain `UNKNOWN`, even if an evaluator knows them from outside literature.

The scientific output is the qualification vector:

\[
Q(\tau)=(S,F,M,P,V)
\]

with each component carrying its disposition and proof-obligation record.

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

Mandatory for the **Mechanistic (M)** qualification. It is conditional for Predictive/Validated claims only when their declared derivation basis is mechanistic or hybrid.

Pass requires one of:

1. a target causal/process model that instantiates the transferred mechanism;
2. direct target evidence for the mechanism;
3. an explicit mechanistic hypothesis with no known contradiction, marked `UNRESOLVED` until tested.

Observational similarity alone cannot pass PO-08.

If a formal mapping exists but the target causal mechanism is different, the transfer can retain **Formal (F)** qualification while failing **Mechanistic (M)**. A separate **Predictive (P)** claim may still succeed if it is explicitly derived from the formal transfer rather than from a mechanism claim.

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

For Predictive/Validated quantitative claims, uncertainty in mapped parameters and target measurements must propagate into the predicted effect.

A candidate is not testable merely because it produces a number. It must produce a predicted interval or sensitivity relation adequate to compare against measurement capability.

### PO-13 — Discriminating target prediction

Mandatory for the **Predictive (P)** and **Validated (V)** qualifications.

At least one prediction must distinguish the transfer hypothesis from a relevant baseline/null.

A prediction restating known target data used to invent the mapping does not count.

### PO-14 — Falsification route and negative control

Mandatory for the **Predictive (P)** and **Validated (V)** qualifications.

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

### PO-17 — Validation of transferred prediction

Mandatory for the **Validated (V)** qualification.

Pass requires a frozen validation record showing that at least one discriminating P-claim prediction was actually tested against a declared decision rule. The record must identify the tested prediction, the data/computation/observation/theorem/experiment, the acceptance or rejection criterion, the observed result and uncertainty where applicable, relevant controls or alternative explanations, and provenance.

Evidence used only to construct or tune the transfer is not automatically validation. If qualifying validation evidence is absent from a closed-book benchmark packet, PO-17 is `UNKNOWN` and V is blocked.

---

## 6. Qualification-axis obligation matrix

Legend: `M` mandatory, `C` conditional when applicable, `-` not required. Dependencies are enforced separately (`F←S`, `M←F`, `P←F`, `V←P`; P also depends on M when derivation basis is MECHANISTIC/HYBRID).

| Obligation | S Structural | F Formal | M Mechanistic | P Predictive | V Validated |
|---|---:|---:|---:|---:|---:|
| PO-00 Grounding | M | M | M | M | M |
| PO-01 Mapping declaration | M | M | M | M | M |
| PO-02 Type/role compatibility | M | M | M | M | M |
| PO-03 Relation preservation | M | M | M | M | M |
| PO-04 Formal well-formedness | - | M | M | M | M |
| PO-05 Dimensional/metrological | - | C | C | C | C |
| PO-06 Assumptions | - | M | M | M | M |
| PO-07 Regime coverage | - | M | M | M | M |
| PO-08 Mechanism/causality | - | - | M | C | C |
| PO-09 Invariants/conservation | - | C | M | C | C |
| PO-10 Parameter calibration | - | C | M | C | C |
| PO-11 Empirical envelope | - | C | M | M | M |
| PO-12 Uncertainty/sensitivity | - | - | C | M | M |
| PO-13 Discriminating prediction | - | - | - | M | M |
| PO-14 Falsification/control | - | - | - | M | M |
| PO-15 Prior-art/novelty | - | - | - | C | C |
| PO-16 Provenance | M | M | M | M | M |
| PO-17 Validation result | - | - | - | - | M |

### 6.1 Conditional-activation rules

- PO-05 activates when measured physical quantities or unit-bearing target relations are used.
- PO-08 activates on P/V only when the declared derivation basis is `MECHANISTIC` or `HYBRID`, or when the prediction narrative itself makes a causal/mechanistic assertion.
- PO-09 activates on F/P/V when an invariant, normalization, conservation law, or symmetry is material to the inference.
- PO-10 activates on F/P/V when parameters are transported, fitted, derived, or numerically instantiated.
- PO-15 activates whenever novelty is claimed; known benchmark transfers may mark it N/A.

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

## 9. Decision procedure

For each proposed transfer:

1. **Freeze the axis claims.** State exactly what is asserted on S, F, M, P, and V; unasserted axes remain `NOT_CLAIMED`.
2. **Construct source and target theory packages.** Missing material fields become `UNKNOWN`.
3. **Declare mappings.** Include unmapped material structure.
4. **Generate obligations per active axis and object type.** Unit-bearing quantities activate dimensional checks; mechanistic claims activate causal obligations; predictive claims activate uncertainty/falsification obligations; validation claims activate PO-17.
5. **Evaluate obligations independently where possible.** Formal tools, dimensional engines, theorem provers, simulations, evidence searches, and human domain experts can each own different obligations.
6. **Compute the qualification profile.** On each active axis, `UNKNOWN` blocks promotion and `FAIL` rejects that axis claim; dependency failures block dependent axes without erasing surviving sibling branches.
7. **Record failure codes.** Do not discard failed transfers without the reason; negative results become reusable knowledge.
8. **Only then generate or evaluate target predictions.**

---

## 10. Decisive classification benchmark

The repaired benchmark scores evidence-bounded qualification profiles rather than a scalar ladder. Each case freezes separate S/F/M/P/V claim statements and a closed evidence bundle. Evaluators may not add external scientific facts during the classification benchmark.

For each claimed axis, evaluators return proof-obligation statuses plus an axis disposition. The gold profile is computed mechanically from those statuses and the dependency graph.

Foundation replay thresholds for two genuinely independent evaluators:

1. **Exact qualification-profile agreement vs adjudicated gold:** >= 85% each.
2. **Per-axis Cohen kappa, macro-averaged over S/F/M/P/V:** >= 0.80 between evaluators.
3. **Dangerous mechanistic-overclaim false-positive rate:** <= 5%.
4. **Mandatory failure-family overlap on rejected claims:** >= 85%.
5. **PO-status macro-F1 on scored active obligations:** >= 0.80.
6. **Mechanism firewall:** M cannot be SUPPORTED if PO-08 is FAIL or UNKNOWN.
7. **Prediction firewall:** P cannot be SUPPORTED if PO-13 or PO-14 is FAIL or UNKNOWN.
8. **Validation firewall:** V cannot be SUPPORTED if PO-17 is FAIL or UNKNOWN.
9. **Branch integrity:** a FORMAL-basis P claim may pass without M, but a MECHANISTIC/HYBRID P claim cannot pass when M is not supported.

A separate future open-book benchmark may evaluate research ability; it must not be mixed with this reproducibility test.

---

