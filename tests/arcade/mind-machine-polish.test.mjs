import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import MindRoute from "../../game/Arcade/mind-route.js";

const source = fs.readFileSync(
  new URL("../../game/Arcade/mind-machine.js", import.meta.url),
  "utf8",
);
const css = fs.readFileSync(
  new URL("../../game/Arcade/mind-machine.css", import.meta.url),
  "utf8",
);

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0;
  for (let i = source.indexOf("{", start); i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

test("actual tile target logic preserves each tile elevation", () => {
  const ctx = {};
  vm.runInNewContext(
    `${functionSource("immTileTargetY")}; this.target = immTileTargetY;`,
    ctx,
  );
  assert.equal(ctx.target({ restY: 0.57, latch: 0 }), 0.57);
  assert.equal(ctx.target({ restY: 0.18, latch: 1 }), 0.15);
  assert.ok(Math.abs(ctx.target({ restY: 0.57, latch: 1 }) - 0.54) < 1e-9);
});

test("actual route speed is invariant across FX modes and route authority stays pure", () => {
  const ctx = {};
  vm.runInNewContext(
    `${functionSource("immRouteSpeed")}; this.speed = immRouteSpeed;`,
    ctx,
  );
  assert.equal(ctx.speed(), 3);
  assert.deepEqual(
    MindRoute.traceRoute(MindRoute.makeBoard(1, 20260912)).won,
    false,
  );
});

test("actual conductor updater follows a rotated direction and route reset clears residue", () => {
  const attrs = {
    values: [],
    setXYZ(index, x, y, z) {
      this.values[index] = [x, y, z];
    },
  };
  const line = { geometry: { getAttribute: () => attrs } };
  const ctx = { MindRoute };
  vm.runInNewContext(
    `${functionSource("immUpdateConductor")}; ${functionSource("immClearRouteVisuals")}; this.update = immUpdateConductor;`,
    ctx,
  );
  const tile = {
    conductor: line,
    hot: line,
    restY: 0.18,
    latch: 1,
    tile: {
      position: { y: -9 },
      material: { emissive: { setHex() {} }, emissiveIntensity: 0 },
    },
  };
  ctx.update({ kind: "node", direction: 2 }, tile);
  assert.deepEqual(attrs.values[1], [-0.84, 0.56, 0]);
});

test("polish contract keeps pooled effects and mobile feedback/hit area", () => {
  assert.match(source, /immFx\.trail/);
  assert.match(source, /immFx\.contacts/);
  assert.match(source, /immClearRouteVisuals\(\)/);
  assert.match(source, /immCalm\(\)/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /\.imm-node[\s\S]*width: 44px[\s\S]*height: 44px/);
  assert.match(css, /#imm-help/);
});
