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
doubles, and raw byte runs.

## Table of contents

- [Features](#features)
- [Installation](#installation)
- [Quick start](#quick-start)
- [API reference](#api-reference)
  - [BinaryReader](#binaryreader)
  - [BinaryWriter](#binarywriter)
- [Behavior and best practices](#behavior-and-best-practices)
- [Examples](#examples)
- [Requirements and compatibility](#requirements-and-compatibility)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

## Features

- Sequential `Read*` / `Write*` methods for every common fixed-width type.
- Per-instance endianness (`big` by default, or `little`).
- 64-bit integers via JavaScript `BigInt`.
- Signed and unsigned integers, IEEE-754 `float` and `double`, and raw byte runs.
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

A reader wraps an immutable copy of the input data and consumes it from the front as
you read.

#### `new BinaryReader(input, [endianness], [encoding])`

| Parameter    | Type                          | Default | Description                                                        |
| ------------ | ----------------------------- | ------- | ------------------------------------------------------------------ |
| `input`      | `Buffer` \| `number[]` \| `string` | —  | The data to read. A `Buffer` is **copied** so the source is never mutated. |
| `endianness` | `'big'` \| `'little'`         | `'big'` | Byte order used by all multi-byte reads.                           |
| `encoding`   | `string`                      | `'ascii'` | Used only when `input` is a `string`, to turn it into bytes.     |

Throws `Error` if `input` is not a `Buffer`, array, or string.

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
| `ReadBytes(count)`| `count` | `Buffer`| Copies `count` bytes into a new `Buffer`.      |

If fewer than the required number of bytes remain, integer/float reads return `0`
(or `0.0`), and `ReadBytes` returns an empty `Buffer` — **without** throwing or
advancing the position. See [Behavior and best practices](#behavior-and-best-practices).

#### Reader properties

| Property     | Type     | Description                                                         |
| ------------ | -------- | ------------------------------------------------------------------- |
| `ByteBuffer` | `Buffer` | The **remaining** unread data. Shrinks as you read.                 |
| `Position`   | `number` | Number of bytes consumed so far (starts at `0`).                    |
| `Length`     | `number` | The length of the original input. Does **not** change as you read.  |
| `Endianness` | `string` | `'big'` or `'little'`.                                               |
| `Encoding`   | `string` | The encoding passed to the constructor.                             |

### BinaryWriter

A writer accumulates bytes in an internal buffer that grows with every write.

#### `new BinaryWriter([endianness], [encoding])`

| Parameter    | Type                  | Default   | Description                              |
| ------------ | --------------------- | --------- | ---------------------------------------- |
| `endianness` | `'big'` \| `'little'` | `'big'`   | Byte order used by all multi-byte writes.|
| `encoding`   | `string`              | `'ascii'` | Stored on the instance; reserved.        |

#### Write methods

| Method                | Bytes | Accepts             | Notes                                              |
| --------------------- | ----- | ------------------- | -------------------------------------------------- |
| `WriteUInt8(value)`   | 1     | `number`            | Unsigned.                                          |
| `WriteInt8(value)`    | 1     | `number`            | Signed.                                            |
| `WriteUInt16(value)`  | 2     | `number`            | Honors endianness.                                 |
| `WriteInt16(value)`   | 2     | `number`            | Honors endianness.                                 |
| `WriteUInt32(value)`  | 4     | `number`            | Honors endianness.                                 |
| `WriteInt32(value)`   | 4     | `number`            | Honors endianness.                                 |
| `WriteUInt64(value)`  | 8     | `number` \| `BigInt`| Coerced with `BigInt(value)`; honors endianness.   |
| `WriteInt64(value)`   | 8     | `number` \| `BigInt`| Coerced with `BigInt(value)`; honors endianness.   |
| `WriteFloat(value)`   | 4     | `number`            | IEEE-754 single precision.                         |
| `WriteDouble(value)`  | 8     | `number`            | IEEE-754 double precision.                         |
| `WriteBytes(value)`   | varies| `Buffer` \| `number[]` \| `string` | Strings are written as one byte per character code. Throws on any other type. |

Writing a value outside the target type's range throws a `RangeError` (the standard
Node.js `Buffer` write behavior) — e.g. `WriteUInt8(256)`.

#### Writer properties

| Property     | Type     | Description                                  |
| ------------ | -------- | -------------------------------------------- |
| `ByteBuffer` | `Buffer` | All bytes written so far.                    |
| `Length`     | `number` | The current length of `ByteBuffer`.          |
| `Endianness` | `string` | `'big'` or `'little'`.                        |
| `Encoding`   | `string` | The encoding passed to the constructor.      |

## Behavior and best practices

- **Reads are destructive.** Each `Read*` call consumes bytes from the front of
  `ByteBuffer` and advances `Position`. If you need the original bytes again, keep
  your own copy before reading. Create a fresh `BinaryReader` to start over.
- **`Length` vs. `Position`.** On a reader, `Length` is the original size and never
  changes; `Position` tracks how much you have consumed. The bytes left to read are
  `Length - Position` (also `ByteBuffer.length`).
- **Out-of-range reads do not throw.** Reading past the end returns `0` / `0.0` /
  an empty `Buffer` and leaves `Position` unchanged. Check the remaining length
  yourself if a short buffer should be treated as an error:

  ```javascript
  if (reader.ByteBuffer.length < 4) {
    throw new Error('truncated record');
  }
  const value = reader.ReadUInt32();
  ```

- **64-bit values are `BigInt`s.** `ReadUInt64`/`ReadInt64` always return a `BigInt`.
  When writing, pass a `BigInt` for any value above `Number.MAX_SAFE_INTEGER`
  (`2^53 - 1`) to avoid silent precision loss; smaller `number`s are accepted and
  coerced automatically.
- **Set endianness once, at construction.** All multi-byte methods follow the
  instance's `Endianness`; reader and writer must agree to round-trip correctly.
- **Constructing a reader from a string?** Pass the encoding explicitly
  (e.g. `new BinaryReader(text, 'big', 'utf8')`) so the bytes are interpreted the
  way you expect.

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

## Requirements and compatibility

- **Node.js 12 or newer** (declared in `package.json` `engines`). The 64-bit methods
  (`ReadUInt64`, `ReadInt64`, `WriteUInt64`, `WriteInt64`) rely on `BigInt` and the
  `Buffer` big-integer methods introduced in Node.js 12.
- **TypeScript typings are bundled** (`binutils.d.ts`) — no separate `@types`
  package is needed.
- Running the test suite uses the built-in `node:test` runner, which requires
  **Node.js 18 or newer**.

## Testing

```bash
npm test     # runs `node --test`
```

The suite covers every reader/writer method, round-trips across both endiannesses,
edge cases (out-of-range reads, constructor input types, buffer-copy isolation), and
the documented examples. Continuous integration runs it on Node.js 20, 22 and 24.

## Contributing

Issues and pull requests are welcome. Please add or update tests for any behavioral
change, note it in `CHANGELOG.md` under *Unreleased*, and make sure `npm test` and
`npm run lint` pass before opening a pull request (run `npm ci` once to install the
linter).

## License

[MIT](LICENSE)
