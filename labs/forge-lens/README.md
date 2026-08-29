# FORGE × Clove Lens Authority Lab

Status: **LAB-ONLY / NON-PRODUCTION**

This lab tests whether FORGE's authority-lifecycle ideas improve Clove's existing research discovery boundary without changing the live Worker, routes, UI, deployment, secrets, or production upload.

## Why this exists

Clove already separates source discovery from evidence extraction:

```text
question -> source recipe -> discovery adapter -> normalized candidates -> retrieval/extraction later
```

The missing authority question is:

> When an agent can see several candidate sources, what prevents it from retrieving a different source, following an attacker-controlled redirect, or treating newly read content as permission to widen its own authority?

The lab tests one narrow answer: **discovery is not retrieval authority**.

## Proposed boundary

```text
Clove discovery (metadata only)
        |
        v
candidate list visible to agent/user
        |
        | user chooses one candidate through a trusted UI/host boundary
        v
host-issued short-lived retrieval grant
        |
        v
agent may retrieve only the exact server-canonical target
        |
        +-- no caller-supplied URL
        +-- recipe-specific origin allowlist
        +-- HTTPS only / private-network targets denied
        +-- redirect denied
        +-- byte budget bound into grant
        +-- question + recipe + discovery snapshot + candidate bound into grant
        v
retrieved bytes remain UNTRUSTED until extraction/verification
```

The grant is HMAC-SHA256 in this lab because the point being tested is exact binding and custody, not production identity design. The signing key is a fixture only in the simulator. A production key/capability must live outside the agent runtime.

## Run

```bash
node labs/forge-lens/attack-sim.mjs
node labs/forge-lens/fuzz-sim.mjs
```

No network, provider API, Cloudflare mutation, secret, external write, or deployment is used.

## Attack result

Targeted simulation:

- 21/21 attack/control cases pass.
- 1 expected negative control is preserved: if the agent receives the host signing authority, it can mint its own retrieval grant. That is a trust-boundary failure, not something HMAC can repair.

Deterministic mutation simulation:

- 1,000/1,000 single-character grant mutations are rejected.

The targeted matrix covers:

- missing grant;
- unavailable discovery;
- unknown and duplicate candidate IDs;
- candidate substitution;
- URL mutation;
- question replay;
- recipe replay;
- expiry;
- signature mutation;
- caller-supplied arbitrary URL;
- hostile text in candidate metadata;
- raw retrieved content incorrectly becoming trusted;
- non-HTTPS targets;
- byte-budget tampering;
- redirect escape;
- already-followed redirect;
- private-network target;
- metadata-only DOI without a discovered direct retrieval target;
- adapter output outside the recipe's origin allowlist.

## Important negative result

A same-origin browser click is **not** cryptographic proof of human approval if an agent runs with the same browser/origin privileges.

Therefore a production Lens integration must keep the grant issuer outside the agent's authority domain. Valid options include a trusted host process, a separately constrained UI/agent tool boundary, or an equivalent deterministic capability boundary. Merely adding a `selectedBy: "human"` field would be security theater.

## Current Clove-specific path

The lab intentionally does **not** modify `workers/research/`.

The next production integration, if authorized later, should add two separate operations:

1. `select` — trusted UI/host only. Re-runs or validates server-canonical discovery, selects exactly one unique `sourceId`, derives the adapter-approved retrieval target, and issues a short-lived grant.
2. `retrieve` — agent-usable. Accepts the grant only; accepts no arbitrary URL; enforces exact target, recipe origin policy, `redirect: manual/error`, timeout, content-type and byte bounds; returns bytes plus provenance with content still marked untrusted.

Do **not** wire this directly into `runResearchExperience` until the UI/agent authority separation exists. The current experience path can perform discovery and extraction as one server-side research workflow; changing that is a product/UX decision, not a lab patch.

## Recipe policy observations from current Clove adapters

The lab freezes the current first-party origins as examples:

- `canadian_law` -> `https://laws-lois.justice.gc.ca`; canonical XML is already discovered in `identifiers.xmlUrl`.
- `official_canadian_statistic` -> `https://www150.statcan.gc.ca`.
- `canadian_trade_statistic` -> Global Affairs Canada / international.canada.ca / Statistics Canada first-party origins.
- `scientific_finding` -> Crossref is metadata discovery. A DOI alone is not treated as a direct retrieval capability; a bounded resolver or a second approval step is required before publisher retrieval.

These policies should remain adapter-owned. An LLM must not invent or widen them.

## Production boundary

This directory is under `labs/`, which Clove's curated static-upload builder hard-excludes from production. This lab introduces no Worker route and no deployable client surface.

## Decision

**PROCEED WITH THE ARCHITECTURE, NOT WITH PRODUCTION WIRING YET.**

The useful FORGE contribution is proven at the correct seam: candidate metadata may expand, while retrieval authority stays exact and separately granted. The next required product decision is where the trusted host/UI boundary lives when Clove gains an agent runtime.
