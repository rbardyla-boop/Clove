# Creator Foundation CF-4 — Arcade Package Importer + Local Sandbox

**Status:** implemented, **local/operator-only, offline, no live-world load, no deploy.**
**Not:** public upload · live cabinet registration · server ticket/prize authority · economy · ownership · accounts · marketplace.
**Parents:** `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md` (CF-4), `docs/CREATOR_FOUNDATION_CF1.md` (arcade package schema/validator), `docs/CREATOR_FOUNDATION_CF2_APPROVED_LOADER.md` (boundary).

## What CF-4 adds

CF-1 shipped the arcade-package *schema + manifest validator + SDK template + size gate*. CF-4 adds the
two missing pieces — the **importer** and the **behavioral local sandbox runner** — so an operator can
import an arcade package and *run it locally, safely*, behind the cabinet frame contract, with **no path
to the live world**.

```
arcade/creator/arcade-importer/import-arcade-package.mjs   importer (pure): manifest + files + scan
arcade/creator/arcade-sandbox/{index.html,sandbox-runner.mjs}   hardened local sandbox runner
arcade/creator/samples/arcade-sample/{manifest.json,game.mjs,adapter.mjs}   tiny sample package
```

## A. Importer (`import-arcade-package.mjs`, pure)

Reuses the CF-1 `validateArcadePackage` manifest validator (single source of manifest truth) and adds
the file-level checks a folder import needs:

- entry + adapter module files referenced by the manifest **exist**; **no extra files** (assets must be
  empty — no bundled assets);
- a **code-aware static safety scan** of each module source (`SOURCE_FORBIDDEN`): rejects `fetch` /
  `XMLHttpRequest` / `WebSocket` / `EventSource` / `sendBeacon` / workers / `importScripts`, dynamic
  `import()`, `eval` / `new Function`, `localStorage` / `sessionStorage` / `indexedDB` / `document.cookie`,
  external/protocol-relative URLs, `<script>`/markup injection, `serviceWorker`, top/parent navigation,
  `window.open`, and economy/ownership terms;
- static **import specifiers** are constrained: the **entry has no imports**; the **adapter imports only
  `./game.mjs`** (so the sandbox can concatenate them);
- the real file total is within the declared `size_budget_bytes` **and** the schema hard cap (64 KiB);
- resolves the `frame_contract_id` to known sandbox dimensions.

> The data-package `FORBIDDEN_CONTENT_RE` forbids *all* code (functions/arrows/backticks), so it cannot
> scan arcade module source — CF-4 ships its own **code-aware** deny-list instead.

The importer returns `{ ok, errors, warnings, limits, capabilities, frame_contract_id, frame_dims,
entry, adapter, result_trust: 'untrusted_local_proposal' }`. It performs **no I/O**.

## B. Local sandbox runner (`arcade-sandbox/`)

Runs an imported package in a **hardened, isolated iframe**:

- **`sandbox="allow-scripts"` only** → the frame is a **null origin**: no storage, no cookies, no
  same-origin access to the host page, no top-navigation, no forms, no popups;
- a **strict CSP** (`default-src 'none'`; **no `connect-src` → NO network of any kind**; **no
  `'unsafe-eval'` → eval/`new Function` blocked at runtime**; `img-src data:` → no external assets);
- the package game+adapter source is **inlined as one module** (the importer guarantees the entry has no
  imports and the adapter imports only `./game.mjs`, so concatenation is sound; it also rejects
  `</script>`/markup, so inlining is safe);
- the only host↔frame channel is a **narrow postMessage frame contract**: host → frame `{type:'input'}` /
  `{type:'request_result'}`; frame → host `{type:'sandbox_ready'}` / `{type:'result_proposal', proposal,
  trust:'untrusted_local_proposal', server_authorized:false}`. The host verifies the message **source**
  (origin is null).

**The host never trusts the frame.** A proposed result is surfaced as an **untrusted local proposal**;
there is no live cabinet registration, no server ticket/prize/score authority, no network from the frame.

> CSP-inheritance note: a `srcdoc` iframe inherits + intersects the parent CSP. The host page therefore
> carries `script-src … 'unsafe-inline'` (it has no inline scripts of its own) so the child's inlined
> module can run at all; the child's **null origin + `default-src 'none'`** remain the real isolation, and
> `connect-src` cannot be loosened into the child (child `default-src 'none'` ∩ parent `'self'` = none).

## Sandbox rules (enforced — two layers)

The **authoritative** layer is the runtime: a null-origin `sandbox="allow-scripts"` iframe + a child CSP
`default-src 'none'` (no `connect-src`, no `'unsafe-eval'`). This holds **even if the static scan misses
an obfuscated form** (e.g. `window['fe'+'tch']`, `constructor.constructor`, blob-URL import) — string-built
network, the Function constructor, blob imports, storage, and parent access all fail at runtime. The
**static source scan is defense-in-depth / best-effort**: it rejects the obvious vectors early so a bad
package is flagged at import rather than silently failing in the frame.

```
                                                           static scan (best-effort)   runtime (authoritative)
no network (fetch/XHR/WebSocket/EventSource/sendBeacon)    ✓ deny-list                  ✓ CSP default-src 'none'
no external assets / remote import                          ✓ deny-list                  ✓ CSP + assets-empty
no eval / new Function / constructor.constructor            ✓ deny-list                  ✓ CSP (no 'unsafe-eval')
no storage (localStorage/sessionStorage/indexedDB/cookie)   ✓ deny-list                  ✓ null-origin sandbox
no WebSocket / workers / service worker                     ✓ deny-list                  ✓ CSP
no parent/top access, popups, navigation                    ✓ deny-list (partial)        ✓ null-origin sandbox attr
no live cabinet registration / server ticket/prize          ✓ runner never registers; result untrusted
result is an explicit "untrusted local proposal"            ✓ server_authorized:false, trust label
```

Imports are constrained so the sandbox can concatenate modules: the **entry imports nothing**; the
**adapter imports only `./game.mjs`** (multiline + side-effect imports are rejected). A non-conforming
import is flagged at import time; even if one slipped through, a relative/bare specifier simply fails to
resolve in the null-origin `default-src 'none'` frame (the game does not run — no escape).

## Isolation from production

All CF-4 files live under `arcade/creator/**`, which `scripts/build-curated-client-upload.mjs` **excludes**
from the production static upload (verified: the curated `--list` contains no `arcade-importer` /
`arcade-sandbox` / `arcade-sample` path; the curated-upload test passes). **No Worker/DO change** (dry-run
byte-identical, 200.81 KiB). No economy/ticket/prize/Host-Rank/Stewardship/Block-Trial/account/ownership
coupling.

## Validation

```
node --test tests/creator/arcade-importer.test.mjs    # 12 pure unit tests (real sample + adversarial variants)
bash  tests/creator/run-arcade-sandbox.sh             # 13-check browser smoke (sandboxed run + blocked package + no off-host net)
node --test tests/creator/*.test.mjs                   # 113 creator unit (101 + 12), green
node --test tests/arcade/*.test.mjs                    # 608 arcade unit (unchanged), green
node --test tests/creator/curated-upload.test.mjs      # creator excluded from curated upload
bash  tests/arcade/run-frame-contract.sh               # frame-contract regression — green
bash  tests/creator/run-block-editor.sh                # CF-1/CF-2/CF-3 editor regression — green
node  tests/arcade/check-production-config.mjs          # PASS; node scripts/check-city-build-size.mjs — within budget
cd workers/arcade && wrangler deploy --dry-run          # byte-identical (200.81 KiB) — no Worker change
```

## Next Creator Foundation phase

```
CF-6  Hive validation SERVICE prototype — local/dev validation boundary that runs the SAME validators
      and emits deterministic reports + hash receipts, granting ZERO live trust (no production, no live
      load). Separate risk surface from CF-4 — its own phase + checkpoint.
CF-7 (= "CF-E")  operator-approved LIVE loader — only behind a human-cleared, separately-authorized
      review; flips LIVE_WORLD_LOADER_ENABLED, which CF-2/CF-3 still forbid today.
```

Detail + boundary lineage: `docs/NEON_CIRCUIT_CREATOR_PIPELINE_ROADMAP.md`. The live world stays closed.
