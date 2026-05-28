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
- `README.md` — the public API reference (keep in sync when adding/changing methods).
- No `src/`, no build step, no dependencies, no test suite.

## Running / testing

There is no test framework, lint config, or build. To verify a change, write an
ad-hoc script and run it with node, e.g.:

```bash
node -e "var b=require('./binutils.js'); var w=new b.BinaryWriter('little'); w.WriteUInt32(3); console.log(w.ByteBuffer);"
```

When you add or change a public method, update the matching section in `README.md`.

## Code conventions (match the existing style exactly)

- ES5 only: `var`, prototype assignment, no classes/arrow functions/`let`/`const`.
- Method and property names are `PascalCase` (`ReadUInt32`, `ByteBuffer`, `Position`).
- Function parameters are prefixed `p_` (`p_InputBuffer`, `p_Value`).
- Local variables are prefixed `s_` (`s_Val`, `s_TempBuffer`).
- Targets `node >=0.12`, so `new Buffer(...)` is used deliberately despite being
  deprecated in modern Node. Don't "fix" it to `Buffer.alloc`/`Buffer.from` unless
  the engines floor is also raised.
- Commit messages are short, lowercase, imperative (e.g. `add read/write 64 bit values`,
  `fix read int64`). No AI/Claude attribution.

## Behavior to preserve

- **Reads are destructive.** Each `Read*` slices the consumed bytes off
  `this.ByteBuffer` and advances `this.Position`. `Length` stays at the original
  buffer length; `ByteBuffer` shrinks as you read.
- **Out-of-range reads return `0` (or `0.0`/empty Buffer), they do not throw.**
- `ReadUInt64`/`ReadInt64` return a `BigInt` (via `readBigUInt64*`/`readBigInt64*`).
- The constructor copies the input buffer (`new Buffer(p_InputBuffer)`) so the
  caller's buffer is not mutated — preserve this.
- `WriteUInt64`/`WriteInt64` accept a `Number` or `BigInt` (coerced via
  `BigInt(p_Value)`) and emit all 8 bytes via `writeBigUInt64*`/`writeBigInt64*`.
- `WriteBytes` accepts a `Buffer`, `Array`, or `string`, and throws on any other
  input type.
