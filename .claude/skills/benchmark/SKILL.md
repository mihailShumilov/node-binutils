---
name: benchmark
description: Measure binutils64 read/write throughput and compare before vs. after a change. Use for performance work, or whenever a change to binutils.js could affect hot-path speed (e.g. the writer's chunked accumulation or the reader's offset-based reads).
---

# Benchmarking binutils64

The bundled harness `.claude/skills/benchmark/bench.js` times sequential writes
(exposes writer accumulation cost) and sequential reads (exposes reader slicing
cost) for 8/32/64-bit and double types, taking the best of 5 runs.

## Run it

```bash
node .claude/skills/benchmark/bench.js                 # current binutils.js
node .claude/skills/benchmark/bench.js binutils.js 5   # 5x the operation count
```

To expose quadratic behavior, run at several scales (1, 5, 25). Time per op that
grows with scale means O(n²); flat time per op means O(n).

## Before/after comparison

Save the baseline from the last commit without touching the working tree:

```bash
S=<scratchpad dir>
git show HEAD:binutils.js > "$S/binutils.base.js"
node .claude/skills/benchmark/bench.js "$S/binutils.base.js" 5 > "$S/before.txt"
node .claude/skills/benchmark/bench.js binutils.js 5           > "$S/after.txt"
diff "$S/before.txt" "$S/after.txt"
```

Use the scratchpad directory for these files, never the repo.

## Rules for perf changes

- Correctness first: `npm test` and `npm run lint` must pass unchanged. A perf
  change must not alter any documented behavior in `CLAUDE.md` ("Behavior to
  preserve"): destructive reads, `Position`/`Length` semantics, non-throwing short
  reads that do not advance, constructor copy isolation.
- `ByteBuffer` is an accessor on both classes (writer: cached concat of chunks;
  reader: `subarray` from the internal offset). Do not reintroduce per-write
  `Buffer.concat` of the whole buffer or per-read slicing of `_Data` — the
  `many small writes stay fast` test guards the writer.
- Put a before/after table (scale, ops/s) in the PR description. Do not commit
  benchmark output files.
- Report numbers honestly, including any path that got slower.
