# F0 — Provisional Field Charter

**Working name:** AI-Driven Theory Research and Cross-Domain Field (ADTRCDF)  
**Status:** PROVISIONAL — new-field claim not authorized  
**Version:** v0.1  
**Date:** 2026-08-10  
**Purpose:** Define a falsifiable research program before software, agents, or a gravity pilot are built.

## 1. Problem statement

Modern science has a knowledge-integration problem in addition to a knowledge-generation problem. Relevant mechanisms, equations, boundary conditions, anomalies, and methods can be distributed across specialized literatures that use different vocabularies and representations. Literature-Based Discovery has demonstrated for decades that complementary knowledge can remain logically connected while bibliographically disconnected. Modern AI can traverse far larger corpora, but current systems can also generate plausible but unsupported ideas, overestimate novelty, collapse toward similar hypotheses, and rely on weak automated evaluation.

The project therefore asks a narrower question than “Can AI do science?”

> **Can a formal, provenance-preserving, cross-domain theory-transfer methodology identify scientifically useful connections that strong existing AI-for-science baselines miss, while rejecting invalid transfers early enough to improve net discovery yield?**

## 2. Primary hypothesis

**H1 (provisional):** A structured workflow that represents scientific mechanisms and constraints in domain-neutral form, transfers those structures across disciplinary boundaries, and imposes explicit proof/falsification obligations will produce a higher rate of novel, valid, testable hypotheses than domain-bounded retrieval, unconstrained LLM ideation, and current multi-agent hypothesis-generation baselines at comparable research cost.

### Null hypothesis

**H0:** After controlling for retrieval quality, model capability, compute, and expert input, the proposed cross-domain theory-transfer methodology does not improve the rate, novelty, validity, or testability of surviving hypotheses over simpler existing methods.

If H0 survives controlled evaluation, the project does not claim a new field.

## 3. Candidate object of study

The proposed scientific object is a **Constraint-Preserving Cross-Domain Theory Transfer (CP-CDTT)**.

A candidate source-domain structure is represented as:

`S = {entities/variables, relations/equations, mechanism, assumptions, boundary conditions, empirical bounds, evidence provenance}`

A transfer from source domain B to target domain A is not considered a discovery merely because the structures appear analogous. It creates a set of obligations:

1. **Structural correspondence:** identify which variables/relations actually map.
2. **Constraint preservation:** identify which assumptions and boundary conditions must remain valid.
3. **Mechanistic compatibility:** show why the transferred mechanism could physically or logically operate in the target domain.
4. **Dimensional/formal validity:** equations, units, conservation laws, causal assumptions, and mathematical constraints must survive the transfer.
5. **Novelty audit:** determine whether the same transfer or consequence already exists in the literature.
6. **Quantitative consequence:** derive at least one discriminating prediction where the target domain permits quantification.
7. **Falsification route:** specify evidence, computation, or experiment capable of rejecting the transferred theory.

This object is provisional and must be revised if prior art already formalizes an equivalent construct.

## 4. Non-claims

This project does **not** presently claim that:

- ADTRCDF is a new scientific field.
- AI is superior to human scientists.
- interdisciplinary research is new.
- cross-domain analogy is new.
- AI-generated theory is new.
- autonomous scientific agents are new.
- knowledge graphs for discovery are new.
- literature-based discovery is new.
- adversarial multi-agent critique is new.
- automated experimentation is new.
- current scientific institutions are failing.
- gravity manipulation is possible.

The project may only claim novelty for a method, benchmark, theoretical object, or empirical result after direct comparison with prior art.

## 5. Research questions

### RQ1 — Representation
Can scientific knowledge from materially different disciplines be encoded at a structural level that preserves the constraints needed for valid transfer?

### RQ2 — Transfer
Can explicit structure-preserving transfer find useful hypotheses that semantic similarity, citation graphs, retrieval, and ordinary interdisciplinary prompting miss?

### RQ3 — Falsification
Does forcing every transfer through formal, quantitative, causal, prior-art, and experimental rejection gates materially reduce plausible nonsense without destroying useful novelty?

### RQ4 — Evaluation
Can cross-domain theory discovery be benchmarked without relying primarily on LLM-as-judge scoring or contaminated historical knowledge?

### RQ5 — Human/AI division of labor
Which steps benefit from AI scale, which require formal tools, which require experimental evidence, and which should remain under expert human judgment?

### RQ6 — Generalization
Does the method work across more than one scientific domain, or only in domains with unusually compatible representations?

## 6. Minimum distinction required for the project to survive

The foundation survives only if the project can demonstrate a methodological unit not already subsumed by Literature-Based Discovery, scientific knowledge graphs, AI Co-Scientist/AI Scientist systems, THEORIZER, cross-domain analogical reasoning, and Agentic Science.

The current candidate distinction is:

> **A typed, constraint-carrying transfer of theory structure between domains in which each mapping automatically produces proof obligations and cannot advance to “hypothesis” status until it survives provenance, prior-art, formal/causal, quantitative, and falsification gates.**

This is a *candidate contribution*, not a cleared novelty claim.

## 7. Success criteria for Foundation v1.0

Foundation status becomes **PASS** only if all of the following are true:

1. A prior-art audit finds no existing method equivalent to the proposed full transfer-and-proof-obligation protocol.
2. The object of study can be defined formally enough that two independent evaluators can agree on whether a candidate transfer satisfies it.
3. At least one leakage-resistant benchmark can distinguish the method from strong baselines.
4. Evaluation includes negative hypotheses and deliberate rejection, not only idea generation.
5. Every scientific claim can retain source provenance and boundary conditions.
6. The method can be ablated so any measured gain can be attributed to the proposed cross-domain transfer machinery rather than simply more compute, better retrieval, or more agents.
7. A pre-registered pilot can return a valid negative result without the project redefining success.

## 8. Terminal states

### FOUNDATION_PASS
Evidence supports a distinct research methodology and a credible case for proposing a new subfield or field after benchmark validation.

### FRAMEWORK_PASS
The method appears useful and potentially novel, but belongs inside an established umbrella such as AI for Science / Agentic Science / Literature-Based Discovery / computational scientific discovery. This is presently the leading outcome.

### FOUNDATION_FAIL
Prior art already implements the substantive methodology, or the proposed distinction cannot be measured independently.

## 9. Governing epistemic rule

**Connection is not discovery.**

A candidate advances through:

`OBSERVATION -> STRUCTURAL MATCH -> TRANSFER PROPOSAL -> MECHANISM -> HYPOTHESIS -> QUANTITATIVE/FORMAL PREDICTION -> TESTABLE -> TESTED -> REPLICATED`

A parallel disposition state is mandatory:

`SUPPORTED / UNRESOLVED / CONTRADICTED / RETIRED`

No AI system may promote a scientific claim solely because another AI system approves it.

## 10. Immediate prohibition

Until F1 is complete and independently reviewed:

- do not publish “ADTRCDF” as an invented field;
- do not build the agent architecture;
- do not make gravity the flagship claim;
- do not write a founding paper that presupposes novelty.

The next permitted work is boundary refinement and benchmark design.
