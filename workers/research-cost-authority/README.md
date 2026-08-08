# Clove Research Cost Authority

SQLite-backed Durable Object authority for scarce Clove Research operations.
It is deliberately not a request counter and it has no public HTTP API.

## Contract

The future research Worker calls the typed client only after cheap validation and
cache lookup:

```text
question → cache lookup → needs scarce work → reserve → AI/Browser Run → commit
                                             ↘ failure → release
```

Each daily ledger is a separate Durable Object selected by
`clove-cost-YYYY-MM-DD`. The object stores reservations and ledger usage in
SQLite. Reservations include an expiry, and `operationId` retries are
idempotent. A commit may report actual usage only up to the amount reserved;
the caller must reserve more before spending more.

The default Worker handler returns `404 internal_only`. No ordinary site traffic,
static asset, cached-evidence read, or public request is routed through this
object.

## Commands

```bash
npm install
npm run types
npm run check
npm test
npm run dry-run
```

The test suite runs in the Cloudflare Workers runtime and covers concurrent
oversubscription, idempotency, commit reconciliation, release on failure,
expiry recovery, daily ledger isolation, and the absence of a public route.
