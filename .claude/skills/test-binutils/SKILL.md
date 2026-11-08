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
- README record example: bytes `[1,0,0,0,3,1,2,3,4,5,6]` yield `1`, `3`, a 6-byte
  buffer, then `Position` and `Length` both `11` (`test/readme-examples.test.js`
  uses its own 13-byte variant). Every runnable README example in the Quick start
  and Examples sections has a mirror test there; keep them in step.
- **Strict mode** (`{ Strict: true }`): short reads/peeks, invalid counts, missing
  C-string terminators and bad varints throw `RangeError` without advancing.
- **Peek**: peek-then-read returns the same value; `Position`/`ByteBuffer` unchanged.
- **Invalid counts** (`-1`, `NaN`, `1.5`, `undefined`, `'2'`): by default they keep
  their 0.3.0 result (`ReadBytes(1.5)` reads 1 byte; `ReadBytes(-1)` throws Node's
  `RangeError`); in strict mode they throw `RangeError` without advancing.
- **0.3.0 compatibility**: `test/compat.test.js` runs seeded random call sequences
  against `test/fixtures/binutils-0.3.0.js` (never edit it). When a default-mode
  behavior is in doubt, compare with the fixture rather than guessing.

### 3. BinaryWriter behavior
- Defaults: endianness `'big'`, encoding `'ascii'`.
- `Length` increments by the correct width per write; emitted bytes match expected
  hex for both endiannesses.
- `WriteBytes` accepts `string`, `Array`, `Buffer` and `Uint8Array`, producing
  identical bytes and copying the input; throws on any other input type. Array
  elements outside 0–255 and string characters above U+00FF keep their low byte by
  default and throw `RangeError` in strict mode.
- Strict writers throw `TypeError` on wrong argument types and `RangeError` out of
  range; default writers keep 0.3.0 coercion (`WriteUInt8(1.5)` writes `1`) and
  Node's own `RangeError` out of range. A failed write leaves `Length`/`ByteBuffer`
  unchanged.
- `ByteBuffer` snapshots: same object until the next write, patches before the next
  write carry forward, older snapshots never change, exact-size own ArrayBuffer.
- `test/smoke.js` is a dependency-free check that CI runs on Node 12–18 (no
  `node:test` there). Keep it free of `node:test` and post-ES2019 syntax.
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
