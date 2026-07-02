---
name: test-binutils
description: Author and run tests for the binutils64 library using node:test and node:assert. Use when asked to add test coverage, write tests for a Read/Write method, verify a change, or set up the test suite for this project.
---

# Testing binutils64

Tests live in `test/` and use the built-in `node:test` runner +
`node:assert/strict` — zero dependencies. (The library's runtime floor is
`node >=12`; `node:test` only affects the dev/test environment, which needs
Node >= 18.)

## Layout & running

- Put tests in `test/`, named `*.test.js`.
- Run the whole suite: `node --test`.
- Add to `package.json` if missing:
  ```json
  "scripts": { "test": "node --test" }
  ```

## Test file skeleton

```javascript
var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');

test('UInt32 round-trips both endiannesses', function() {
    ['big', 'little'].forEach(function(endian) {
        var w = new binutils.BinaryWriter(endian);
        w.WriteUInt32(0xDEADBEEF);
        var r = new binutils.BinaryReader(w.ByteBuffer, endian);
        assert.equal(r.ReadUInt32(), 0xDEADBEEF);
    });
});
```

Keep test code ES5-compatible in spirit (`var`, `function`) to match repo style,
though the test runner itself requires modern Node.

## Coverage priorities (highest value first)

### 1. Round-trips — write then read back
For every type, both `'big'` and `'little'`: write a value, feed `writer.ByteBuffer`
into a reader, assert the read value equals the written one.
- `UInt8/16/32`, `Int8/16/32`, `Float`, `Double`, `Bytes`.
- `UInt64/Int64`: assert against the correct BigInt value. The writers accept a
  `Number` or a `BigInt` and emit all 8 bytes; the reader returns a `BigInt`, so
  compare against a `BigInt` literal (`123n`), not a `Number` (`123n !== 123` under
  strict equality).
- Signed boundaries: `Int32` min `-2147483648` and max `2147483647`, negatives for
  `Int8/16`.
- `Float`: compare with tolerance (`assert.ok(Math.abs(got - want) < 1e-6)`) due to
  precision loss. `Double` is exact for representable values.

### 2. BinaryReader behavior
- **Endianness**: identical bytes read as `'big'` vs `'little'` produce the expected
  swapped values; default (no arg) is `'big'`.
- **Invariants**: after reads, `Position` advanced by the right byte count, `Length`
  unchanged at the original size, `ByteBuffer` shrank by the consumed bytes.
- **Out-of-range** reads return `0` / `0.0` / empty `Buffer` (never throw) — read
  past the end for each method.
- **Constructor inputs**: `Buffer`, `Array`, and `string` (+ encoding) all build;
  an invalid input (e.g. a number) throws.
- **Constructor copies input**: mutate the caller's original buffer after
  constructing and confirm reader output is unaffected.
- `ReadUInt64`/`ReadInt64` return a `bigint` (`assert.equal(typeof v, 'bigint')`).
- README reader example: bytes `[1,0,2,0,0,0,3,1,2,3,4,5,6]` yield `1`, `2`, `3`,
  a 6-byte buffer, then `Position` and `Length` both `13`.

### 3. BinaryWriter behavior
- Defaults: endianness `'big'`, encoding `'ascii'`.
- `Length` increments by the correct width per write; emitted bytes match expected
  hex for both endiannesses.
- `WriteBytes` accepts `string`, `Array`, and `Buffer`, producing identical bytes,
  and throws on any other input type.
- README writer example yields `<Buffer ff ff 00 00 00 00 ff ff ff ff 05 04 03 02 01>`,
  `Length` 15.

### 4. Maintaining bug-documentation tests
There are no open known bugs at the moment. When you discover one, pin its current
behavior with a clearly-commented test so regressions are noticed. When a bug is
fixed, delete its pinned test and convert any matching TODO round-trip into a normal
assertion — this is how the former 64-bit writer bug (low-32-bit truncation) and the
`WriteBytes` guard bug (`!p_Value instanceof Buffer` mis-parsing, which let invalid
input through) were retired.

## Verify before finishing
- `node --test` passes (except intentionally-`todo` bug tests).
- New types added via the `add-binary-type` skill have a matching round-trip test.
