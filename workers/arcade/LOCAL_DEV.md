# Neon Circuit Room Authority — Phase 1b Local Development

## Prerequisites
- Node.js 20+
- Wrangler 4+ (`npm install -g wrangler` or use npx)

## Start the Authority Worker (Durable Object)

```bash
cd workers/arcade
npm install          # only needed once for wrangler types
npx wrangler dev --local
```

The Worker will be available at:
- WebSocket: `ws://localhost:8787/arcade/ws`
- Health: `http://localhost:8787/arcade/health`

### Important: WebSocket + Durable Objects in Local Mode

`wrangler dev --local` has known reliability issues with WebSocket upgrades to Durable Objects (especially hibernation). If you see repeated `WebSocket connection failed` + close code `1006` in the browser (even after fixing code bugs), this is usually the local runtime, not your code.

**Recommended for Phase 1b validation:**

Try running **without** `--local`:

```bash
npx wrangler dev
```

This runs the Durable Object on Cloudflare's edge (you will see a message about remote DOs). WebSocket behavior is much more stable this way. You will still get fast local iteration on your Worker code.

You will need to run `npx wrangler login` the first time.

## Run the Test Harness

From the **project root** (in another terminal):

```bash
# Option A: any static server
npx serve -p 5173 .

# Option B: wrangler pages (if you want Pages-like headers)
npx wrangler pages dev . --port 5173
```

Then open in two browser tabs:
```
http://localhost:5173/arcade/pulse-occupancy-test.html?ws=ws://localhost:8787/arcade/ws
```

The `?ws=` override is useful so the client talks to the local Worker instead of trying production.

## Two-Client Validation Steps

1. Open the URL above in Tab A.
2. Open the same URL in Tab B (or a different browser / incognito).
3. Both should show the same initial `FREE` state for Pulse Tap.
4. In Tab A, click **OCCUPY**.
   - Tab A should immediately see `BUSY` with its own player id.
   - Tab B must also see `BUSY` with the same occupant.
5. In Tab A, click **RELEASE**.
   - Both tabs must return to `FREE`.
6. Repeat from Tab B.
7. While one tab holds the cabinet, close that tab or navigate away.
   - After ~45s the alarm should release the lock.
   - The remaining tab must see the cabinet become `FREE` automatically.
8. Rapid double-occupy from two tabs: only one succeeds; the other receives `occupy_denied` with reason `busy`.

All authoritative decisions come from the Durable Object. The two clients must never disagree.

## Hibernation Notes

- When the DO has no recent activity it will hibernate.
- Connected clients stay connected (this is the point of the Hibernation API).
- Any message (including heartbeats) will wake the DO.
- The only thing persisted to storage in Phase 1b is the current `MachineState` for "pulse".

## Troubleshooting

- "Wrangler requires Node 20" → use nvm / volta / asdf.
- Connection refused → make sure `wrangler dev` is running on 8787.
- Cabinet never frees on disconnect → wait the full 45s (or check the alarm logic).
- CSP errors → the updated `_headers` must be deployed, or test via `?ws=` override.

### WebSocket connection failed (close code 1006) immediately on page load

This is the most common problem during local development of this project.

**Symptoms you are seeing right now:**
- Rich log shows `ws_error` + `ws_close` reason `1006` within 1 second of loading the page.
- No successful connection ever appears.
- Clicking OCCUPY does nothing useful.

**Root cause (very common):**
`wrangler dev --local` has fragile support for WebSocket + Durable Object hibernation. The upgrade request often gets dropped before it reaches your code.

**Fastest fix for validation:**

Stop the current process and run:

```bash
npx wrangler dev
```

(without `--local`)

This makes the `ArcadeRoom` Durable Object run on Cloudflare's infrastructure while your Worker code still runs locally. WebSocket connections become reliable.

Watch the Wrangler terminal — you should now see the new `[Worker] Received WebSocket upgrade request...` logs when you reload the browser tabs.

Once you see those logs and the browser shows "connected" in the identity banner, you can proceed with the 8-point gate.

## Next After Validation

Only after the steps above pass cleanly in two real clients:

```bash
git add -A
git commit -m "feat(arcade): add room-authoritative Pulse Tap occupancy"
```

Do not commit earlier.

## Paper Firm First Shift

Paper Firm is a separate authority path from the arcade room examples above.
The RUG server and this Worker must share the same `PAPER_FIRM_FIELD_SECRET`;
the browser never receives it. In local development the checked-in Wrangler
development value matches RUG's non-production fallback.

1. Start RUG and create/join one world with two distinct authenticated human sessions.
2. Start this Worker and open `arcade/paper-firm/index.html` in the two sessions.
3. Set the RUG URL, world code, and Worker WebSocket URL in each client.
4. Verify the opening login harness is still OPEN before any Desk work.
5. Use the field lead to find/carry/extract PAGE-7. The receipt remains pending in
   the Durable Object until Human B accepts it through RUG as OBS.
6. From the RUG checkout, run the external worker driver as a separate process:

```bash
RUG_URL=http://localhost:3000 \
WORLD_CODE=RUG001 \
WORKER_KEY=paper-firm-local-worker-secret \
INSTANCE_ID=builder-1 \
node scripts/paper-firm-worker.mjs loop
```

Kill that process and start a new one with a different `INSTANCE_ID`; the new
worker must bootstrap from `worker_snapshot`, not predecessor chat. Human B
performs source verification, packet creation/delivery, requirement change,
finding rejection, and harness actions. Human A performs the offline/rejoin
and final signature actions.
