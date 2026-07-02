---
name: add-binary-type
description: Add a new matched Read/Write method pair to binutils.js following the library's exact ES5 conventions, then update README.md and add a round-trip test. Use when asked to support a new numeric/binary type (e.g. a new width, a string type, a boolean) in the BinaryReader/BinaryWriter classes.
---

# Adding a binary type to binutils64

This library exposes mirrored methods on `BinaryReader` and `BinaryWriter` in the
single file `binutils.js`. Every supported type has a `ReadX` and a matching
`WriteX`. Adding a type means editing both prototypes, updating `README.md`, and
adding a round-trip test. Follow the templates below **exactly** — style
deviations and width mismatches are the main source of bugs here (this library
previously shipped a low-32-bit width bug in the 64-bit writers — don't repeat it).

## Hard rules (match existing code)

- ES5 only: `var`, prototype assignment. No `let`/`const`/classes/arrow functions.
- Method names are `PascalCase`: `ReadUInt24`, `WriteBool`, etc.
- Parameters are prefixed `p_` (`p_Value`); locals are prefixed `s_` (`s_Val`,
  `s_TempBuffer`).
- Create buffers with `Buffer.alloc(N)` (new zero-filled) and `Buffer.from(...)`
  (conversions) — the package targets `node >=12`; do not reintroduce the
  deprecated `new Buffer(...)` constructor.
- **The write width MUST equal the read width.** When the type is wider than 32
  bits, use the correct wide Buffer method (`writeBigUInt64LE`, etc.), NOT
  `writeUInt32LE` — using a 32-bit write into an 8-byte buffer was the original
  64-bit writer bug (now fixed). 64-bit values are `BigInt`; coerce with
  `BigInt(p_Value)` so both `Number` and `BigInt` arguments work.

## Reader method template

Out-of-range reads return `0` (or `0.0` / empty `Buffer`) — they do not throw.
Reads are destructive: slice the consumed bytes off `this.ByteBuffer` and advance
`this.Position` by the byte width `N`.

```javascript
ReadTYPE: function() {
    if (this.ByteBuffer.length < N) {
        return 0;
    }

    var s_Val = (this.Endianness == 'little') ? this.ByteBuffer.readTYPELE(0) : this.ByteBuffer.readTYPEBE(0);
    this.ByteBuffer = this.ByteBuffer.slice(N);
    this.Position += N;
    return s_Val;
},
```

For a single-byte type there is no endianness branch (see `ReadUInt8`/`ReadInt8`),
and use `++this.Position;`.

## Writer method template

Allocate an `N`-byte temp buffer, write with the correct-width method honoring
endianness, grow `this.Length` by `N`, and concat.

```javascript
WriteTYPE: function(p_Value) {
    var s_TempBuffer = Buffer.alloc(N);
    if (this.Endianness == 'little') {
        s_TempBuffer.writeTYPELE(p_Value, 0);
    } else {
        s_TempBuffer.writeTYPEBE(p_Value, 0);
    }
    this.Length += N;
    this.ByteBuffer = Buffer.concat([this.ByteBuffer, s_TempBuffer], this.Length);
},
```

For a single-byte type, drop the endianness branch (see `WriteUInt8`/`WriteInt8`).

## Placement

Keep the read/write methods grouped by family and ordered as in the existing file
(unsigned ascending width, then signed ascending width, then float/double, then
bytes). Add the new method next to its siblings, not at the end.

## After editing binutils.js

1. **README.md** — add a `### ReadX(...)` and `### WriteX(value)` entry in the
   matching BinaryReader / BinaryWriter sections, mirroring the existing phrasing
   ("Reads/Writes a … and advances the current position by N bytes").
2. **binutils.d.ts** — add the method signatures to the matching class, mirroring
   the existing doc comments.
3. **CHANGELOG.md** — add an entry under `Unreleased`.
4. **Test** — add a round-trip test (see the `test-binutils` skill): write a value
   in both `'big'` and `'little'`, read it back, assert equality. Include a min/max
   or negative boundary value for signed/wide types. For 64-bit values assert the
   returned type is `bigint`.
5. Run the tests: `node --test`.

## Verify before finishing

- Write width == read width (round-trip test passes for both endiannesses).
- `Position`/`Length` advance by exactly `N`.
- Out-of-range read returns the documented zero value, not a throw.
- README entries added; method placed beside its family.
