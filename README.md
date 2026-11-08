# binutils64

> A .NET-style `BinaryReader` and `BinaryWriter` for Node.js, with selectable endianness.

[![npm version](https://img.shields.io/npm/v/binutils64.svg)](https://www.npmjs.com/package/binutils64)
[![npm downloads](https://img.shields.io/npm/dm/binutils64.svg)](https://www.npmjs.com/package/binutils64)
[![Tests](https://github.com/mihailShumilov/node-binutils/actions/workflows/test.yml/badge.svg)](https://github.com/mihailShumilov/node-binutils/actions/workflows/test.yml)
[![node version](https://img.shields.io/node/v/binutils64.svg)](https://www.npmjs.com/package/binutils64)
[![license](https://img.shields.io/github/license/mihailShumilov/node-binutils.svg)](https://github.com/mihailShumilov/node-binutils/blob/master/LICENSE)
[![types](https://img.shields.io/npm/types/binutils64.svg)](https://www.npmjs.com/package/binutils64)
[![install size](https://packagephobia.com/badge?p=binutils64)](https://packagephobia.com/result?p=binutils64)

`binutils64` provides two small classes — `BinaryReader` and `BinaryWriter` — that
make it easy to parse and produce binary data sequentially, with an API modelled on
the corresponding .NET classes. Both classes let you choose the byte order
(`big`- or `little`-endian) and support 8-, 16-, 32- and 64-bit integers, floats,
doubles, booleans, LEB128 varints, raw byte runs, and encoded or null-terminated
strings.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API reference](#api-reference)
  - [BinaryReader](#binaryreader)
  - [BinaryWriter](#binarywriter)
  - [Strict mode](#strict-mode)
- [Behavior and best practices](#behavior-and-best-practices)
- [Upgrading from 0.3](#upgrading-from-03)
- [Examples](#examples)
- [Requirements and compatibility](#requirements-and-compatibility)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- Sequential `Read*` / `Write*` methods for every common fixed-width type.
- Non-consuming `Peek*` methods, `Skip` and `ReadRemaining` for protocol parsing.
- Per-instance endianness (`big` by default, or `little`).
- 64-bit integers via JavaScript `BigInt`.
- Signed and unsigned integers, IEEE-754 `float` and `double`, booleans, raw byte
  runs, strings in any `Buffer` encoding, and null-terminated strings.
- LEB128 varints (unsigned and ZigZag-signed, 32- and 64-bit).
- Opt-in strict mode that throws on truncated input and invalid values.
- Fully backward compatible with 0.3: existing code keeps its exact results.
- Linear-time writes: thousands of small writes stay fast.
- Zero runtime dependencies.
- Bundled TypeScript type definitions.

## Installation

```bash
npm install binutils64
```

Then require it:

```javascript
const binutils = require('binutils64');
// const { BinaryReader, BinaryWriter } = require('binutils64');
```

## Quick start

```javascript
const { BinaryReader, BinaryWriter } = require('binutils64');

// --- Writing ---
const writer = new BinaryWriter();      // big-endian by default
writer.WriteUInt16(65535);
writer.WriteUInt32(0);
writer.WriteInt32(-1);
writer.WriteBytes([5, 4, 3, 2, 1]);

console.log(writer.ByteBuffer);
// <Buffer ff ff 00 00 00 00 ff ff ff ff 05 04 03 02 01>
console.log(writer.Length); // 15

// --- Reading ---
const reader = new BinaryReader(writer.ByteBuffer);
console.log(reader.ReadUInt16()); // 65535
console.log(reader.ReadUInt32()); // 0
console.log(reader.ReadInt32());  // -1
console.log(reader.ReadBytes(5)); // <Buffer 05 04 03 02 01>
```

## API reference

### BinaryReader

A reader keeps a private copy of the input data and consumes it from the front as
you read.

#### `new BinaryReader(input, [endianness], [encoding], [options])`

| Parameter    | Type                          | Default | Description                                                        |
| ------------ | ----------------------------- | ------- | ------------------------------------------------------------------ |
| `input`      | `Buffer` \| `Uint8Array` \| `number[]` \| `string` | — | The data to read. A `Buffer` or `Uint8Array` is **copied** so changes to the source do not affect the reader. Array elements are bytes (`0`–`255`). |
| `endianness` | `'big'` \| `'little'`         | `'big'` | Byte order used by all multi-byte reads.                           |
| `encoding`   | `string`                      | `'ascii'` | Used by `ReadString`/`ReadCString`. A `string` input is encoded with this argument, or UTF-8 when it is omitted. |
| `options`    | `{ Strict?: boolean }`        | `{}`    | `Strict: true` turns on [strict mode](#strict-mode).               |

Throws `Error` if `input` is not a `Buffer`, `Uint8Array`, array or string, and
`TypeError` if `options` asks for strict mode but has an unknown key. Any other
`options` value is ignored, as 0.3 ignored extra arguments. Calling it without `new`
also works. In strict mode the constructor also rejects array elements that are
not bytes, non-ASCII string input without an explicit `encoding`, and an invalid
`endianness` or `encoding`.

#### Read methods

| Method            | Bytes | Returns   | Notes                                          |
| ----------------- | ----- | --------- | ---------------------------------------------- |
| `ReadUInt8()`     | 1     | `number`  | Unsigned.                                      |
| `ReadInt8()`      | 1     | `number`  | Signed.                                        |
| `ReadUInt16()`    | 2     | `number`  | Honors endianness.                             |
| `ReadInt16()`     | 2     | `number`  | Honors endianness.                             |
| `ReadUInt32()`    | 4     | `number`  | Honors endianness.                             |
| `ReadInt32()`     | 4     | `number`  | Honors endianness.                             |
| `ReadUInt64()`    | 8     | `BigInt`  | Honors endianness. Returns a `BigInt`.         |
| `ReadInt64()`     | 8     | `BigInt`  | Honors endianness. Returns a `BigInt`.         |
| `ReadFloat()`     | 4     | `number`  | IEEE-754 single precision.                     |
| `ReadDouble()`    | 8     | `number`  | IEEE-754 double precision.                     |
| `ReadBoolean()`    | 1     | `boolean` | Any non-zero byte is `true`.                   |
| `ReadBytes(count)`| `count` | `Buffer`| Copies `count` bytes into a new `Buffer`.      |
| `ReadString(count)`| `count` | `string`| Decodes `count` **bytes** (not characters) using the instance's `Encoding`. |
| `ReadCString()`   | varies | `string` | Reads up to the next `0x00` byte, consumes the terminator, decodes the bytes before it. Use with byte-oriented encodings (not `utf16le`). |
| `ReadRemaining()` | rest  | `Buffer`  | Copies all remaining bytes and consumes them.  |
| `Skip(count)`     | `count` | —       | Advances without returning data. Does nothing if fewer than `count` bytes remain. Accepts the same `count` values as `ReadBytes`. |
| `ReadVarUInt32()` | 1–5   | `number`  | Unsigned LEB128 varint.                        |
| `ReadVarInt32()`  | 1–5   | `number`  | ZigZag-encoded signed LEB128 varint.           |
| `ReadVarUInt64()` | 1–10  | `BigInt`  | Unsigned LEB128 varint.                        |
| `ReadVarInt64()`  | 1–10  | `BigInt`  | ZigZag-encoded signed LEB128 varint.           |

Varints are self-describing, so `Endianness` does not apply to them.

If fewer than the required number of bytes remain, numeric reads return `0`
(or `0.0`), `ReadBoolean` returns `false`, `ReadBytes`/`ReadString`/`ReadCString`
return an empty `Buffer`/`string`, and truncated or overlong varints return `0` —
**without** throwing or advancing the position. Short 64-bit reads return the
**number** `0`, not `0n`. To get errors instead, use [strict mode](#strict-mode).

`ReadBytes`, `PeekBytes` and `Skip` handle an unusual `count` exactly as 0.3 did: a
fraction is rounded down, and a negative or non-number `count` throws Node's own
`RangeError`/`TypeError`. `ReadString` returns an empty string for a `count` of `0`
or less. In strict mode every invalid `count` throws a `RangeError` instead.

#### Peek methods

`PeekUInt8()`, `PeekInt8()`, `PeekUInt16()`, `PeekInt16()`, `PeekUInt32()`,
`PeekInt32()`, `PeekUInt64()`, `PeekInt64()`, `PeekFloat()`, `PeekDouble()`,
`PeekBoolean()` and `PeekBytes(count)` return the same value as the matching
`Read*` method but never advance `Position` or change `ByteBuffer`. Short peeks
return the same zero value as reads (or throw in strict mode). `PeekBytes` returns a
copy.

#### Reader properties

| Property     | Type     | Description                                                         |
| ------------ | -------- | ------------------------------------------------------------------- |
| `ByteBuffer` | `Buffer` | The **remaining** unread data — a live view of the reader's private copy, not a new copy. Shrinks as you read. Assigning a `Buffer` replaces the unread data as is (it is not copied, and `Position`/`Length` are not changed). |
| `Position`   | `number` | Number of bytes consumed so far (starts at `0`). Assigning it does not seek. |
| `Length`     | `number` | The length of the original input. Does **not** change as you read.  |
| `Endianness` | `string` | `'big'` or `'little'`. Changing it affects the next read.            |
| `Encoding`   | `string` | The encoding passed to the constructor. Changing it affects the next read. |
| `Strict`     | `boolean`| Whether [strict mode](#strict-mode) is on. Set from `options.Strict`; not enumerable. Assigning it does not change the mode. |

### BinaryWriter

A writer accumulates bytes as you write. Each write is amortized O(1); reading
`ByteBuffer` after every write costs O(n) per read, as in 0.3.

#### `new BinaryWriter([endianness], [encoding], [options])`

| Parameter    | Type                  | Default   | Description                              |
| ------------ | --------------------- | --------- | ---------------------------------------- |
| `endianness` | `'big'` \| `'little'` | `'big'`   | Byte order used by all multi-byte writes.|
| `encoding`   | `string`              | `'ascii'` | Used by `WriteString`/`WriteCString` to encode strings. |
| `options`    | `{ Strict?: boolean }`| `{}`      | `Strict: true` turns on [strict mode](#strict-mode). |

Throws `TypeError` if `options` asks for strict mode but has an unknown key; any
other `options` value is ignored. In strict mode it also throws `TypeError` if `endianness` is not `'big'`/`'little'` or
`encoding` is not a known `Buffer` encoding. Calling it without `new` also works.

#### Write methods

| Method                | Bytes | Accepts             | Notes                                              |
| --------------------- | ----- | ------------------- | -------------------------------------------------- |
| `WriteUInt8(value)`   | 1     | `number`            | Unsigned.                                          |
| `WriteInt8(value)`    | 1     | `number`            | Signed.                                            |
| `WriteUInt16(value)`  | 2     | `number`            | Honors endianness.                                 |
| `WriteInt16(value)`   | 2     | `number`            | Honors endianness.                                 |
| `WriteUInt32(value)`  | 4     | `number`            | Honors endianness.                                 |
| `WriteInt32(value)`   | 4     | `number`            | Honors endianness.                                 |
| `WriteUInt64(value)`  | 8     | `number` \| `BigInt`| Honors endianness.                                 |
| `WriteInt64(value)`   | 8     | `number` \| `BigInt`| Honors endianness.                                 |
| `WriteFloat(value)`   | 4     | `number`            | IEEE-754 single precision.                         |
| `WriteDouble(value)`  | 8     | `number`            | IEEE-754 double precision.                         |
| `WriteBoolean(value)` | 1     | any                 | `0x01` if truthy, `0x00` otherwise.                |
| `WriteBytes(value)`   | varies| `Buffer` \| `Uint8Array` \| `number[]` \| `string` | Appends a copy. Strings are written one byte per character code (latin1). Throws on any other type. |
| `WriteString(value)`  | varies| `string`            | Encodes the string using the instance's `Encoding`. Throws on any other type. Lossy encodings (`hex`, `base64`, characters outside `ascii`/`latin1`) write what Node's `Buffer.from` produces. |
| `WriteCString(value)` | varies| `string`            | Like `WriteString`, plus a `0x00` terminator. Throws a `RangeError` if the encoded bytes contain `0x00` (e.g. a `\0` character, or any text in `utf16le`). |
| `WriteVarUInt32(value)` | 1–5 | `number`            | Unsigned LEB128, `0`–`0xFFFFFFFF`.                 |
| `WriteVarInt32(value)`  | 1–5 | `number`            | ZigZag-signed LEB128, `-2^31`–`2^31-1`.            |
| `WriteVarUInt64(value)` | 1–10| `number` \| `BigInt`| Unsigned LEB128, `0`–`2^64-1`.                     |
| `WriteVarInt64(value)`  | 1–10| `number` \| `BigInt`| ZigZag-signed LEB128, `-2^63`–`2^63-1`.            |

Fixed-width writers pass the value to Node's `Buffer` methods exactly as 0.3 did:
out-of-range values throw Node's `RangeError` (e.g. `WriteUInt8(256)`), while
fractions, numeric strings and `NaN` are coerced (`WriteUInt8(1.5)` writes `1`).
`WriteUInt64`/`WriteInt64` convert with `BigInt()`, so a fraction or `NaN` throws
`RangeError`, a non-numeric string throws `SyntaxError`, and `undefined` throws
`TypeError`. The
varint writers are new and always validate: `TypeError` for a non-integer,
`RangeError` out of range. Turn on [strict mode](#strict-mode) to get the same checks
on every writer. A failed write leaves the writer unchanged.

#### Writer properties

| Property     | Type     | Description                                  |
| ------------ | -------- | -------------------------------------------- |
| `ByteBuffer` | `Buffer` | All bytes written so far, as a `Buffer` with its own exactly-sized memory. The same object is returned until the next write; changes you make to it before then are kept. Assigning a `Buffer` replaces the contents but does **not** update `Length` — set `Length` yourself (the next write pads or truncates to `Length`, as in 0.3). |
| `Length`     | `number` | The number of bytes written so far.          |
| `Endianness` | `string` | `'big'` or `'little'`.                        |
| `Encoding`   | `string` | The encoding passed to the constructor.      |
| `Strict`     | `boolean`| Whether [strict mode](#strict-mode) is on. Set from `options.Strict`; not enumerable. Assigning it does not change the mode. |

### Strict mode

Both classes accept `{ Strict: true }` as their last constructor argument. Strict
mode only adds errors: any call that succeeds in strict mode returns exactly what it
returns without it. It is off by default, so code written for 0.3 is unaffected.

| Class          | Without `Strict` (0.3 behavior)                                    | With `Strict: true`                                   |
| -------------- | ------------------------------------------------------------------ | ----------------------------------------------------- |
| Reader         | Short reads, peeks, `Skip`, `ReadCString` without a terminator and truncated or overlong varints return a zero value. | They throw `RangeError` and do not advance. `ReadRemaining` never throws. |
| Reader         | Odd `count` values are handled as described under [Read methods](#read-methods). | Any `count` that is not a non-negative integer throws `RangeError`. |
| Reader constructor | Array elements are truncated to a byte; a string input without `encoding` is UTF-8; any `endianness`/`encoding` is stored (a string input with an unknown `encoding` throws Node's `TypeError`). | Non-byte elements, non-ASCII strings without `encoding`, and invalid `endianness`/`encoding` throw. |
| Writer         | Values are coerced by Node (`1.5` → `1`, `'5'` → `5`, `NaN` → `0`; the 64-bit writers use `BigInt()` and throw on fractions and `NaN`). A `number` above `2^53 - 1` passed to a 64-bit writer is written as given. | Non-integers throw `TypeError`; the 64-bit writers (`WriteUInt64`, `WriteInt64`, `WriteVarUInt64`, `WriteVarInt64`) throw `RangeError` for a `number` outside `±Number.MAX_SAFE_INTEGER` (pass a `BigInt`). `WriteFloat`/`WriteDouble` throw `TypeError` for non-numbers. |
| Writer         | `WriteBytes` keeps the low byte of each array element and character code; `WriteString` writes what `Buffer.from` produces. | Array elements outside `0`–`255`, `WriteBytes` characters above U+00FF, and `WriteString` characters the `ascii`/`latin1` encoding cannot represent throw `RangeError`. |
| Writer constructor | Any `endianness`/`encoding` is stored. | Invalid `endianness`/`encoding` throws `TypeError`. |

Errors added by strict mode name the method and the offending value, e.g.
`RangeError: ReadUInt32: need 4 bytes, 2 remaining`.

## Behavior and best practices

- **Reads are destructive.** Each `Read*` call consumes bytes from the front of
  `ByteBuffer` and advances `Position`. If you need the original bytes again, keep
  your own copy before reading. Create a fresh `BinaryReader` to start over.
- **`Length` vs. `Position`.** On a reader, `Length` is the original size and never
  changes; `Position` tracks how much you have consumed. The bytes left to read are
  `ByteBuffer.length` — and also `Length - Position`, unless you have assigned
  `ByteBuffer`, which changes neither.
- **Out-of-range reads do not throw by default.** Reading past the end returns `0` /
  `0.0` / `false` / an empty `Buffer` or string and leaves `Position` unchanged. If a
  short buffer should be an error, turn on [strict mode](#strict-mode).
- **Loops over `ReadCString`.** Without strict mode, a missing terminator returns `''`
  without advancing, so `while (reader.ByteBuffer.length) reader.ReadCString()` never
  ends on malformed input. Use strict mode, or stop when the result is empty and
  `Position` did not move.
- **Look before you read.** `Peek*` methods return the next value without consuming
  it, which is handy for tag-based dispatch.
- **64-bit values are `BigInt`s.** `ReadUInt64`/`ReadInt64` return a `BigInt` when 8
  bytes are available (and the number `0` on a short read, like the other reads).
  When writing, pass a `BigInt` for any value above `Number.MAX_SAFE_INTEGER`
  (`2^53 - 1`) to avoid silent precision loss; smaller integer `number`s are accepted
  and converted automatically. A `number` above that limit has usually been rounded
  before it reaches the writer, and is written as that rounded value (strict mode
  rejects it).
- **Set endianness once, at construction.** All multi-byte methods follow the
  instance's `Endianness`; reader and writer must agree to round-trip correctly.
  Use only `'big'` or `'little'`: any other value reads and writes big-endian (strict
  mode rejects it). `Endianness` and `Encoding` can be changed later and apply to the
  next call.
- **Constructing a reader from a string?** The string is encoded with the
  `encoding` argument, or as UTF-8 if you omit it — even though the reader's
  `Encoding` then defaults to `'ascii'` for `ReadString`. Pass the encoding
  explicitly (e.g. `new BinaryReader(text, 'big', 'utf8')`) to keep both in step.
- **`WriteBytes` vs. `WriteString`.** `WriteBytes(string)` writes raw byte values
  (one per character, latin1). Characters above U+00FF keep only their low byte
  (strict mode throws instead). Use `WriteString` for encoded text.
- **The default `'ascii'` encoding is 7-bit only.** Node.js clears the high bit of
  every byte when decoding `'ascii'`, so text containing characters above `0x7F`
  does **not** round-trip through `WriteString`/`ReadString` with the default
  encoding. Pass `'utf8'` (or `'latin1'`) to both constructors when handling
  non-ASCII text.

## Examples

### Round-tripping a 64-bit integer

```javascript
const { BinaryReader, BinaryWriter } = require('binutils64');

const writer = new BinaryWriter();             // big-endian
writer.WriteUInt64(0x1234567890ABCDEFn);       // pass a BigInt for large values
console.log(writer.ByteBuffer);                // <Buffer 12 34 56 78 90 ab cd ef>

const reader = new BinaryReader(writer.ByteBuffer);
console.log(reader.ReadUInt64());              // 1311768467294899695n
```

### Little-endian

```javascript
const { BinaryReader, BinaryWriter } = require('binutils64');

const writer = new BinaryWriter('little');
writer.WriteUInt32(0x01020304);
console.log(writer.ByteBuffer);                // <Buffer 04 03 02 01>

const reader = new BinaryReader(writer.ByteBuffer, 'little');
console.log(reader.ReadUInt32().toString(16)); // "1020304"
```

### Writing and reading strings

```javascript
const { BinaryReader, BinaryWriter } = require('binutils64');

const text = 'héllo';
const writer = new BinaryWriter('big', 'utf8');
writer.WriteUInt8(Buffer.byteLength(text, 'utf8')); // length prefix: 6
writer.WriteString(text);

const reader = new BinaryReader(writer.ByteBuffer, 'big', 'utf8');
const length = reader.ReadUInt8();                  // 6
console.log(reader.ReadString(length));             // "héllo"
```

### Strict mode

```javascript
const { BinaryReader } = require('binutils64');

const reader = new BinaryReader([0x00, 0x01], 'big', 'ascii', { Strict: true });
reader.ReadUInt16();   // 1
reader.ReadUInt32();   // throws RangeError: ReadUInt32: need 4 bytes, 0 remaining
```

```javascript
const { BinaryWriter } = require('binutils64');

const writer = new BinaryWriter('big', 'ascii', { Strict: true });
writer.WriteUInt8(1.5);  // throws TypeError: WriteUInt8: expected an integer number, got number (1.5)
```

See [Strict mode](#strict-mode) for the full list of checks.

### Tag dispatch with peek

```javascript
const { BinaryReader } = require('binutils64');

const reader = new BinaryReader([0x02, 0x01, 0x00]);
if (reader.PeekUInt8() === 0x02) {
  reader.Skip(1);                       // consume the tag
  console.log(reader.ReadUInt16());     // 256
}
```

### Varints and null-terminated strings

```javascript
const { BinaryReader, BinaryWriter } = require('binutils64');

const writer = new BinaryWriter('big', 'utf8');
writer.WriteVarUInt32(300);         // <Buffer ac 02>
writer.WriteVarInt32(-1);           // <Buffer 01>  (ZigZag)
writer.WriteCString('name');        // <Buffer 6e 61 6d 65 00>

const reader = new BinaryReader(writer.ByteBuffer, 'big', 'utf8');
console.log(reader.ReadVarUInt32()); // 300
console.log(reader.ReadVarInt32());  // -1
console.log(reader.ReadCString());   // "name"
```

### Parsing a structured record

```javascript
const { BinaryReader } = require('binutils64');

// type (u8), id (u32, big-endian), payload (6 bytes)
const reader = new BinaryReader(Buffer.from([1, 0, 0, 0, 3, 1, 2, 3, 4, 5, 6]));

const record = {
  type:    reader.ReadUInt8(),   // 1
  id:      reader.ReadUInt32(),  // 3
  payload: reader.ReadBytes(6),  // <Buffer 01 02 03 04 05 06>
};

console.log(record, 'read', reader.Position, 'of', reader.Length, 'bytes');
```

## Upgrading from 0.3

Nothing to change. Without `{ Strict: true }`, every call that worked in 0.3 returns
the same values, writes the same bytes and throws the same errors, and instances have
the same enumerable properties (`Object.keys`, `JSON.stringify`). The test suite checks
this against the 0.3.0 source on thousands of randomized call sequences.

The only differences are fixes for calls that misbehaved in 0.3:

- `Position` is always an integer. In 0.3 some invalid `count` values left it as
  `NaN`, a fraction or a string.
- A `Uint8Array` is accepted as reader input and by `WriteBytes` (0.3 threw).
- Reading after `reader.ByteBuffer = null` returns zero values instead of throwing a
  `TypeError`.
- On an instance frozen with `Object.freeze`, reads and writes still consume and
  append data internally, while the frozen `Position`/`Length` stay unchanged. In 0.3
  they silently did nothing. Freeze a reader or writer only once you are done with it.

New in 0.4: `Peek*`, `Skip`, `ReadRemaining`, `ReadBoolean`/`WriteBoolean`,
`ReadCString`/`WriteCString`, varints and strict mode. Opt in to strict mode one
reader or writer at a time once your inputs are known to be well-formed.

## Requirements and compatibility

- **Node.js 12 or newer** (declared in `package.json` `engines`). The 64-bit methods
  (`ReadUInt64`, `ReadInt64`, `WriteUInt64`, `WriteInt64`) rely on `BigInt` and the
  `Buffer` big-integer methods introduced in Node.js 12.
- **TypeScript typings are bundled** (`binutils.d.ts`) — no separate `@types/binutils64`
  package is needed. They reference Node's `Buffer` type, so TypeScript projects need
  `@types/node` installed.
- Running the test suite uses the built-in `node:test` runner, which requires
  **Node.js 18 or newer**.

## Testing

```bash
npm test     # runs `node --test`
```

The suite covers every reader/writer method, round-trips across both endiannesses,
edge cases (out-of-range reads, strict mode, input validation, buffer-copy
isolation), the documented examples, and randomized comparisons against the 0.3.0
release to guard backward compatibility. Continuous integration runs it on Node.js
20, 22 and 24, and runs a dependency-free smoke test (`node test/smoke.js`) on
Node.js 12, 14, 16 and 18.

## Contributing

Issues and pull requests are welcome. Please add or update tests for any behavioral
change, note it in `CHANGELOG.md` under *Unreleased*, and make sure `npm test` and
`npm run lint` pass before opening a pull request (run `npm ci` once to install the
linter).

## License

[MIT](LICENSE)
