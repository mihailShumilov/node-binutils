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

- Correctness first: `npm test` and `npm run lint` must pass unchanged, including
  `test/compat.test.js` (0.3.0 results, errors, `ByteBuffer` identity and snapshot
  semantics). A perf change must not alter any rule in `CLAUDE.md` ("Behavior to
  preserve"). Run a deep compat sweep after touching the writer:
  `COMPAT_SCENARIOS=100000 node --test test/compat.test.js`.
- `ByteBuffer` is an accessor on both classes (writer: one growable buffer, exposed
  as an exact-size copy, or as is when exactly full; reader: a cached `subarray` from
  the internal offset). Do not reintroduce per-write `Buffer.concat` of the whole
  buffer or per-read slicing of `_S.Data`. The `WriteUInt32 + ByteBuffer get` row
  guards the read-after-every-write pattern, which must stay at least as fast as
  0.3.0; the retained-heap row catches per-write overhead.
- To compare with 0.3.0, benchmark `test/fixtures/binutils-0.3.0.js` (its writer is
  O(n²), so keep the scale at 1 or below).
- Put a before/after table (scale, ops/s) in the PR description. Do not commit
  benchmark output files.
- Report numbers honestly, including any path that got slower.
