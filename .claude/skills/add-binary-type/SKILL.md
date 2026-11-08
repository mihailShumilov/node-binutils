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

- **Reader**: the data lives in `this._Data` (a private copy); `this._Offset` is
  the read cursor. `ByteBuffer` is a getter returning `_Data.subarray(_Offset)`.
  Never slice or reassign `_Data` in a read method.
  - `this._Ensure(N, 'MethodName')` returns `true` when `N` bytes remain; otherwise
    it throws a `RangeError` in strict mode or returns `false`.
  - `this._CheckCount(p_Count, 'MethodName')` validates a caller-supplied count
    (non-negative integer) with the same strict/non-strict behavior.
  - `this._Advance(N)` moves both `_Offset` and the public `Position`.
- **Writer**: bytes are appended as chunks; `ByteBuffer` is a cached getter that
  concatenates them. Every write ends with `this._Append(s_TempBuffer)`, which also
  grows `Length`. Never touch `_Chunks`/`_Cache`/`Length` directly.
- **Validation helpers** (module level): `CheckInteger`, `CheckNumber`, `ToBigInt`,
  `CheckByteArray`. Validate **before** allocating/appending so a failed write
  leaves the writer unchanged.

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
    if (!this._Ensure(N, 'ReadTYPE')) {
        return 0;
    }

    var s_Val = (this.Endianness == 'little') ? this._Data.readTYPELE(this._Offset) : this._Data.readTYPEBE(this._Offset);
    this._Advance(N);
    return s_Val;
},
```

```javascript
PeekTYPE: function() {
    if (!this._Ensure(N, 'PeekTYPE')) {
        return 0;
    }
    return (this.Endianness == 'little') ? this._Data.readTYPELE(this._Offset) : this._Data.readTYPEBE(this._Offset);
},
```

Single-byte types have no endianness branch (see `ReadUInt8`/`PeekUInt8`). The
zero value is `0`, `0.0` (float types), `false` (boolean), `''` or
`Buffer.alloc(0)`. Short 64-bit reads return the **number** `0`.

## Writer template

```javascript
WriteTYPE: function(p_Value) {
    CheckInteger(p_Value, 'WriteTYPE');          // or CheckNumber / ToBigInt
    var s_TempBuffer = Buffer.alloc(N);
    if (this.Endianness == 'little') {
        s_TempBuffer.writeTYPELE(p_Value, 0);
    } else {
        s_TempBuffer.writeTYPEBE(p_Value, 0);
    }
    this._Append(s_TempBuffer);
},
```

Single-byte types drop the endianness branch (see `WriteUInt8`/`WriteInt8`).

## Variable-length / non-numeric types

Model them on `ReadString`/`WriteString`, `ReadCString`/`WriteCString`,
`ReadBytes`/`WriteBytes` and the varint methods: validate input and throw on the
wrong type in the writer; in the reader, call `_CheckCount`/`_Ensure` (or throw in
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
