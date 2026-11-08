# CLAUDE.md

Guidance for working in this repository.

## What this is

`binutils64` — a small npm package providing .NET-style `BinaryReader` and
`BinaryWriter` classes for Node.js, with selectable endianness (`'big'` default
or `'little'`). All logic lives in a single file: `binutils.js`. Published to npm
as `binutils64`.

## Layout

- `binutils.js` — the entire library. Two ES5 prototype-based "classes"
  (`BinaryReader`, `BinaryWriter`) exported via `module.exports`.
- `binutils.d.ts` — hand-written TypeScript definitions for the public API.
- `README.md` — the public API reference.
- `CHANGELOG.md` — Keep-a-Changelog format; new entries go under `Unreleased`.
- `test/*.test.js` — `node:test` suite; CI runs it on Node 20/22/24.
- No `src/`, no build step, no runtime dependencies (`eslint` and `@eslint/js`
  are the only dev dependencies, used for linting only).
- `test/smoke.js` — dependency-free smoke test CI runs on Node 12–18.

## Running / testing

```bash
npm test        # node --test — runs the suite in test/
npm ci          # once, to install the linter
npm run lint    # eslint — also enforces ES5 syntax in binutils.js
```

When you add or change a public method, update the matching section in `README.md`,
the typings in `binutils.d.ts`, and add a `CHANGELOG.md` entry under `Unreleased`.

```bash
node .claude/skills/check-api-sync/check-api-sync.js   # code vs typings/README/tests/changelog
sh .claude/skills/check-api-sync/check-typings.sh      # strict tsc check of binutils.d.ts
node .claude/skills/benchmark/bench.js [lib] [scale]   # read/write throughput
```

## Project skills and agents (`.claude/`)

| Name | Kind | Use for |
|---|---|---|
| `implement-issue` | skill | End-to-end workflow for a GitHub issue: branch → code → docs → tests → review → PR |
| `add-binary-type` | skill | Templates for a new matched `ReadX`/`WriteX` pair |
| `test-binutils` | skill | How to write and run tests for this library |
| `check-api-sync` | skill | Verify `binutils.js`, `binutils.d.ts`, `README.md`, `test/` and `CHANGELOG.md` agree |
| `benchmark` | skill | Before/after performance comparison of read/write throughput |
| `release` | skill | Changelog roll-over, `npm version`, tag, GitHub release → npm publish workflow |
| `binutils-implementer` | agent | Implements an issue/feature autonomously (good for parallel worktrees) |
| `binutils-reviewer` | agent | Reviews changes for binary-correctness bugs and convention drift |
| `docs-sync-auditor` | agent | Read-only audit that README/typings/changelog match the code |

## Code conventions (match the existing style exactly)

- ES5 only: `var`, prototype assignment, no classes/arrow functions/`let`/`const`.
- Method and property names are `PascalCase` (`ReadUInt32`, `ByteBuffer`, `Position`).
  Private members start with `_` (`_Data`, `_Offset`, `_Ensure`, `_Append`).
- Object-literal getters/setters are allowed (they are ES5); BigInt literals are
  not — use `BigInt(1)`.
- Function parameters are prefixed `p_` (`p_InputBuffer`, `p_Value`).
- Local variables are prefixed `s_` (`s_Val`, `s_TempBuffer`).
- Targets `node >=12`. Create buffers with `Buffer.alloc`/`Buffer.from`; do not
  reintroduce the deprecated `new Buffer(...)` constructor.
- Commit messages are short, lowercase, imperative (e.g. `add read/write 64 bit values`,
  `fix read int64`). No AI/Claude attribution.

## Behavior to preserve

- **Reads are destructive.** Each `Read*` advances the private `_Offset` and the
  public `Position` (via `_Advance`). `Length` stays at the original input length;
  `ByteBuffer` (a getter: `_Data.subarray(_Offset)`) shrinks as you read. Assigning
  `Position` does not seek. `Peek*` methods never advance.
- **Out-of-range reads return a zero value and do not throw by default** — `0`,
  `0.0`, `false`, `''` or an empty Buffer, without advancing. Invalid counts are
  treated the same. Only an explicit `{ Strict: true }` reader throws (`RangeError`).
- `ReadUInt64`/`ReadInt64` return a `BigInt` (via `readBigUInt64*`/`readBigInt64*`),
  and the **number** `0` on a short read.
- The reader constructor copies `Buffer`/`Uint8Array` input (`Buffer.from(...)`) so
  the caller's data is not shared — preserve this. `WriteBytes` copies too.
- The writer appends chunks via `_Append`; `ByteBuffer` is a cached concat. Never
  reintroduce a per-write concat of the whole buffer (O(n²)).
- Writers validate before appending: `TypeError` for wrong types, `RangeError` out of
  range, and a failed write leaves the writer unchanged.
- `WriteUInt64`/`WriteInt64` accept an integer `Number` or a `BigInt` and emit all 8
  bytes via `writeBigUInt64*`/`writeBigInt64*`.
- `WriteBytes` accepts a `Buffer`, `Uint8Array`, byte `Array`, or latin1 `string`,
  and throws on any other input.
- Constructors validate `endianness` (`'big'`/`'little'`/falsy) and `encoding`
  (`Buffer.isEncoding`), and work without `new`.
