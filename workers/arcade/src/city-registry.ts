/**
 * CityRegistry — Neon Circuit city-block presence coordinator (Durable Object, Phase 5C).
 *
 * Per-block CityRoom DOs are isolated (one per city_id), so none can see the whole district's
 * population. CityRegistry is a single coordinator instance that stores the latest OCCUPANCY
 * HEARTBEAT per block — a population COUNT plus a registry-stamped freshness timestamp — and
 * serves a public-safe presence map. It is reached ONLY DO-to-DO (CityRoom DOs report to it
 * and read it back) — never directly by a client — and holds NO private player data: only
 * per-block counts and heartbeat timestamps. Health and the stale-population eviction policy
 * are derived downstream by the pure city-district.mjs layer.
 *
 * Dedicated to the city (separate from the arcade RoomRegistry) so the two concerns stay
 * isolated. Additive migration v4 (new_sqlite_classes: ["CityRegistry"]); it never touches
 * the arcade or city-room DOs.
 */
import { CITY_IDS, sanitizeCityId } from "../../../arcade/city/city-block.mjs";

interface CityBeat {
  population: number;
  last_seen_at: number; // registry receive-clock — the authoritative freshness timestamp
}

interface CityRegState {
  cityHeartbeats: Record<string, CityBeat>;
}

interface Env {}

export class CityRegistry implements DurableObject {
  private reg!: CityRegState;

  constructor(private readonly ctx: DurableObjectState, private readonly env: Env) {}

  private async init(): Promise<void> {
    if (this.reg) return;
    const stored = await this.ctx.storage.get<CityRegState>("cityRegistry");
    this.reg = stored && stored.cityHeartbeats ? stored : { cityHeartbeats: {} };
  }

  private json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  async fetch(request: Request): Promise<Response> {
    await this.init();
    const path = new URL(request.url).pathname;

    // A CityRoom DO reports its block's occupancy heartbeat. The registry stamps its own
    // receive-clock as the authoritative freshness timestamp and echoes the current presence
    // map so the caller can refresh its cache without a second round-trip.
    if (path === "/city-registry/heartbeat" && request.method === "POST") {
      const body: any = await request.json().catch(() => ({}));
      const cityId = sanitizeCityId(body.cityId);
      if (!CITY_IDS.includes(cityId)) return this.json({ ok: false, reason: "invalid_city" });
      this.reg.cityHeartbeats[cityId] = {
        population: Math.max(0, Number(body.population) || 0),
        last_seen_at: Date.now(),
      };
      await this.ctx.storage.put("cityRegistry", this.reg);
      return this.json({ ok: true, presence: this.reg.cityHeartbeats });
    }

    // Public-safe presence map (a CityRoom reads this to enrich its district manifest).
    if (path === "/city-registry/presence") {
      return this.json({ ok: true, presence: this.reg.cityHeartbeats });
    }

    return new Response("Not found", { status: 404 });
  }
}
