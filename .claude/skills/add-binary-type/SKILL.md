---
name: add-binary-type
description: Add a new matched Read/Peek/Write method set to binutils.js following the library's exact ES5 conventions and internal helpers, then update README.md, binutils.d.ts, CHANGELOG.md and add tests. Use when asked to support a new numeric/binary type (e.g. a new width, a string type) in the BinaryReader/BinaryWriter classes.
---

# Adding a binary type to binutils64

This library exposes mirrored methods on `BinaryReader` and `BinaryWriter` in the
single file `binutils.js`. Every fixed-width type has a `ReadX`, a `PeekX` and a
matching `WriteX`. Follow the templates below **exactly** — style deviations and
width mismatches are the main source of bugs here (this library once shipped a
low-32-bit width bug in the 64-bit writers — don't repeat it).

## How the internals work

- **Reader**: the data lives in `this._S.Data` (a private copy); `this._S.Offset` is
  the read cursor. `ByteBuffer` is a getter returning `_S.Data.subarray(_S.Offset)`.
  Never slice or reassign `_S.Data` in a read method.
  - `Ensure(this, N, 'MethodName')` returns `true` when `N` bytes remain; otherwise
    it throws a `RangeError` in strict mode or returns `false`.
  - `ResolveCount(this, p_Count, 'MethodName')` resolves a caller-supplied count:
    in strict mode it throws a `RangeError` for anything but a non-negative integer;
    otherwise it reproduces 0.3.0 (`ReadBytes` semantics). Use `IsByteCount` for a
    brand-new method that has no 0.3.0 behavior to keep.
  - `Advance(this, N)` moves both `_S.Offset` and the public `Position`.
  - Return copies with `CopyOut(this._S.Data, start, end)`, never a view of `_S.Data`.
- **Writer**: one growable buffer (`_S.Buffer`, `_S.Used`). Fixed-width writes encode
  into the module-level `Scratch` buffer (16 bytes) and end with
  `Append(this, Scratch, N)`; variable-length writes call
  `Append(this, s_Bytes, s_Bytes.length)`. `Append` grows `Length` and handles
  `ByteBuffer` snapshot/compat semantics. Never touch `_S.Buffer`/`_S.Used`/`_S.Exposed`/
  `Length` directly.
- **Validation helpers** (module level): `CheckInteger`, `CheckNumber`,
  `ToBigIntStrict`/`ToBigInt`, `CheckByteArray`, `CheckMaxCharCode`. Validate
  **before** appending so a failed write leaves the writer unchanged.
- **Compatibility rule**: methods that existed in 0.3.0 only validate when
  strict mode is on, so default results stay identical to 0.3.0
  (`test/compat.test.js`). A brand-new method has no 0.3.0 behavior, so it may
  validate always (as the varint writers do).

## Hard rules (match existing code)

- ES5 only: `var`, prototype assignment (object-literal `get`/`set` are fine). No
  `let`/`const`/classes/arrow functions/BigInt literals (`BigInt(1)`, not `1n`).
  `npm run lint` enforces this.
- Public names are `PascalCase`; private members start with `_`. Parameters are
  prefixed `p_`; locals `s_`.
- Create buffers with `Buffer.alloc(N)` / `Buffer.from(...)`; never `new Buffer(...)`.
- **The write width MUST equal the read width.** For 64-bit types use the
  `*Big*64*` methods and convert with `ToBigInt(p_Value, 'MethodName')`.

## Reader and peek templates

```javascript
ReadTYPE: function() {
    if (!Ensure(this, N, 'ReadTYPE')) {
        return 0;
    }

    var s_Val = (this.Endianness == 'little') ? this._S.Data.readTYPELE(this._S.Offset) : this._S.Data.readTYPEBE(this._S.Offset);
    Advance(this, N);
    return s_Val;
},
```

```javascript
PeekTYPE: function() {
    if (!Ensure(this, N, 'PeekTYPE')) {
        return 0;
    }
    return (this.Endianness == 'little') ? this._S.Data.readTYPELE(this._S.Offset) : this._S.Data.readTYPEBE(this._S.Offset);
},
```

Single-byte types have no endianness branch (see `ReadUInt8`/`PeekUInt8`). The
zero value is `0`, `0.0` (float types), `false` (boolean), `''` or
`Buffer.alloc(0)`. Short 64-bit reads return the **number** `0`.

## Writer template

```javascript
WriteTYPE: function(p_Value) {
    CheckInteger(p_Value, 'WriteTYPE');          // new method: always validate (or CheckNumber)
    if (this.Endianness == 'little') {
        Scratch.writeTYPELE(p_Value, 0);
    } else {
        Scratch.writeTYPEBE(p_Value, 0);
    }
    Append(this, Scratch, N);
},
```

When changing a method that already existed in 0.3.0, wrap the check in
`if (WriterState(this).Strict) { ... }` instead (never read `this.Strict`: it is a
public, user-assignable property). For 64-bit values convert first:
`var s_Big = WriterState(this).Strict ? ToBigIntStrict(p_Value, 'WriteTYPE') : BigInt(p_Value);`.
Single-byte types drop the endianness branch (see `WriteUInt8`/`WriteInt8`).

## Variable-length / non-numeric types

Model them on `ReadString`/`WriteString`, `ReadCString`/`WriteCString`,
`ReadBytes`/`WriteBytes` and the varint methods: validate input and throw on the
wrong type in the writer; in the reader, call `ResolveCount`/`Ensure` (or throw in
strict mode yourself) and return the empty value without advancing when the data
is short or malformed; decode with `this.Encoding` where text is involved. Varints
and byte runs have no endianness branch.

## Placement

Keep methods grouped by family as in the file: reads (unsigned ascending width,
signed ascending width, float/double, boolean, bytes/strings, remaining/skip),
then varints, then peeks; writers in the same order. Add new methods next to
their siblings, not at the end.

## After editing binutils.js

1. **README.md** — add a row to the `Read methods` table (Method | Bytes | Returns |
   Notes) and the `Write methods` table (Method | Bytes | Accepts | Notes), beside
   the family (the tables pair `UIntN`/`IntN` by width). Add the method to the
   `Peek methods` list if it has a peek.
2. **binutils.d.ts** — add the signatures and doc comments to the matching class.
3. **CHANGELOG.md** — add an entry under `Unreleased`.
4. **Tests** (see the `test-binutils` skill) — round-trip in `'big'` and `'little'`,
   boundary values, short read (default and strict), peek-then-read, writer
   `TypeError`/`RangeError` cases leaving `Length` unchanged.
5. Run `npm test`, `npm run lint`, `node .claude/skills/check-api-sync/check-api-sync.js`
   and `sh .claude/skills/check-api-sync/check-typings.sh`.

## Verify before finishing

- Write width == read width (round-trip passes for both endiannesses).
- `Position` advances by exactly `N`; `Length` unchanged on reads.
- Short read returns the documented zero value (or throws `RangeError` in strict
  mode) without advancing.
- README, typings and changelog updated; methods placed beside their family.
- `npm test` passes, including `test/compat.test.js` (0.3.0 behavior unchanged).
