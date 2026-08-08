# Clove Research Nucleus

This is the first independently judgeable product slice after the cost
infrastructure. It accepts one factual question at `POST /research/`:

> What percentage of Canada's electricity generation came from nuclear power in the latest complete year?

The implementation is isolated in [`workers/research/`](../workers/research/).
It deliberately supports one question while the evidence contract is proven.

## Contract

```text
question
  → research specification
  → ranked public sources
  → exact reported datapoints
  → calculated strongest datapoint
  → independent-source comparison
  → contradiction record
  → supported answer
  → Mermaid evidence graph
  → portable Obsidian Markdown
```

The current source set uses Statistics Canada as the primary 2024 source and
the Canada Energy Regulator's 2021 figure as an independent challenger. The
challenger is retained as a period mismatch; it is not silently treated as a
2024 value. Public-source work takes the `public_source_only` path and does not
invoke Workers AI or Browser Run. Future scarce work must use the existing
reserved-spend helper in [`workers/research/src/scarce.ts`](../workers/research/src/scarce.ts).

## Verification

Deterministic fixture tests:

```bash
npm run check:research
npm run test:research
```

The optional live contract fetches the current official source pages:

```bash
npm --prefix workers/research run test:live
```

The endpoint's response includes the answer, source URLs, exact excerpts,
calculation inputs, challenge status, graph data, Mermaid rendering, and
standalone Markdown. The Markdown contains no runtime dependency on Clove.

## Deliberate limit

This proves the nucleus, not arbitrary open-domain research. Unsupported
questions return `422 unsupported_question` until another question has its own
source adapters and acceptance fixture.
