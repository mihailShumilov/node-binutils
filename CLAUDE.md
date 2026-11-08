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
| `binutils-quality-auditor` | agent | Paranoid read-only audit: performance (benchmarked), code smells, clean code, patterns, test strength |
| `docs-sync-auditor` | agent | Read-only audit that README/typings/changelog match the code |

## Code conventions (match the existing style exactly)

- ES5 only: `var`, prototype assignment, no classes/arrow functions/`let`/`const`.
- Method and property names are `PascalCase` (`ReadUInt32`, `ByteBuffer`, `Position`).
  Private state lives in one hidden object, `this._S` (reader: `Owner`, `Data`,
  `Offset`, `View`, `ViewOffset`, `Strict`; writer: `Owner`, `Buffer`, `Used`,
  `Exposed`, `ReadStreak`, `Strict`). Private helpers are module-level functions
  that take the instance (`Ensure(this, N, 'ReadX')` returning the state or `null`,
  `Advance(this, s_State, N)`, `Append(this, Scratch, N)`), not prototype methods, so
  public methods keep working when borrowed or mixed into other objects, as they did
  in 0.3.0.
- Object-literal getters/setters are allowed (they are ES5); BigInt literals are
  not — use `BigInt(1)`.
- Function parameters are prefixed `p_` (`p_InputBuffer`, `p_Value`).
- Local variables are prefixed `s_` (`s_Val`, `s_TempBuffer`).
- Targets `node >=12`. Create buffers with `Buffer.alloc`/`Buffer.from`; do not
  reintroduce the deprecated `new Buffer(...)` constructor. `Buffer.allocUnsafeSlow`
  is allowed only where every byte is overwritten before anyone can see the buffer
  (`CopyOut`, the writer's exact-fit growth).
- Commit messages are short, lowercase, imperative (e.g. `add read/write 64 bit values`,
  `fix read int64`). No AI/Claude attribution.

## Behavior to preserve

- **Backward compatibility with 0.3.0 is a hard rule.** Customers are unknown, so
  without `{ Strict: true }` every call that worked in 0.3.0 must return identical
  values and bytes, throw identical errors (class and message), and keep the same
  enumerable shape (`Object.keys`, `JSON.stringify`, key order). `test/compat.test.js`
  checks this against `test/fixtures/binutils-0.3.0.js` with seeded random call
  sequences (`COMPAT_SCENARIOS=100000 node --test test/compat.test.js` for a deep
  run). Never edit the fixture. New validation goes behind `ReaderState(this).Strict`/`WriterState(this).Strict`; brand-new
  methods may validate always.
- **Strict mode only adds errors.** A call that succeeds in strict mode must return
  exactly what it returns without it. `ReadRemaining` never throws.
- **Reads are destructive.** Each `Read*` advances the private `_S.Offset` and the
  public `Position` (via `Advance`). `Length` stays at the original input length;
  `ByteBuffer` (an own enumerable accessor, defined first, returning a cached
  `_S.Data.subarray(_S.Offset)`) shrinks as you read. Assigning `Position` does not seek.
  `Peek*` methods never advance.
- **Out-of-range reads return a zero value and do not throw by default** — `0`,
  `0.0`, `false`, `''` or an empty Buffer, without advancing. `ReadBytes`/`PeekBytes`/
  `Skip` resolve odd counts through `ResolveCount`. For `ReadBytes` it reproduces
  0.3.0 (fractions round down; negative/NaN/non-number counts throw Node's error);
  the new `PeekBytes`/`Skip` pass `p_Lenient` and return the empty value instead.
- `ReadUInt64`/`ReadInt64` return a `BigInt` (via `readBigUInt64*`/`readBigInt64*`),
  and the **number** `0` on a short read.
- The reader constructor copies `Buffer`/`Uint8Array` input so the caller's data is
  not shared. Assigning `reader.ByteBuffer` does **not** copy and does not touch
  `Position`/`Length` (0.3.0 behavior). `ReadBytes`/`PeekBytes`/`ReadRemaining`
  return exactly-sized copies (`CopyOut`).
- The writer keeps one growable buffer (`_S.Buffer`, `_S.Used`). Fixed-width writes go
  through the module-level `Scratch` buffer and `Append(this, Scratch, N)`. Never
  reintroduce a per-write concat of the whole buffer (O(n²)).
- Writer `ByteBuffer` semantics match 0.3.0: an exact-size Buffer with its own
  ArrayBuffer; the same object until the next write; patches made to it before the
  next write carry forward; older snapshots never change; the writer never writes
  into memory the caller holds. If `Length !== _S.Used` (caller changed `Length` or
  assigned `ByteBuffer`), `Append` takes the legacy path that reproduces 0.3.0's
  `Buffer.concat([ByteBuffer, bytes], Length)`.
- Existing writers pass values to Node's `Buffer` methods unchanged by default (Node
  coerces and range-checks); strict mode adds `TypeError`/`RangeError` checks first,
  so a failed write leaves the writer unchanged.
- `WriteBytes` accepts a `Buffer`, `Uint8Array`, byte `Array`, or latin1 `string`,
  and throws the 0.3.0 `Error("Invalid Buffer object provided.")` on any other input.
- Constructors work without `new`. An `options` argument without a truthy `Strict`
  is ignored entirely, including `{ strict: true }` (0.3.0 ignored extra arguments);
  `{ Strict: true }` with any other key throws. `endianness`/`encoding` are
  validated only in strict mode. `_S` and the prototype `Strict` accessor are
  non-enumerable; assigning `Strict` stores a plain value and never changes the mode.
- **Objects without own state are adopted.** Copies made with `Object.assign`/spread,
  `Object.create` forks, frozen instances and borrowed methods all behaved in 0.3.0
  because its state was public. `ReaderState`/`WriterState` check
  `this._S.Owner === this` and otherwise rebuild private state from the public
  `ByteBuffer` (`AdoptReader`/`AdoptWriter`; a fork inherits `Strict`). Every public
  method gets the state once (`ReaderState`/`WriterState`/`Ensure`, or inside
  `Append`) and passes it on; never re-read `this._S` afterwards. Objects that cannot
  take `_S` (frozen or non-extensible copies) get detached state (`Owner: null`) that
  lives only for the call: it is rebuilt from the public `ByteBuffer` every time and
  progress is written back to it, as 0.3.0 did. A frozen instance that owns its state
  behaves like a frozen 0.3.0 object: `Advance`/`Append` skip storing progress when the
  public `Position`/`Length` could not change, and the `ByteBuffer` setters ignore
  assignment. The "unusual usage" cases in `test/compat.test.js` cover all of this.
