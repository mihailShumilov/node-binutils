# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `ReadBoolean()` / `WriteBoolean(value)` (#5).
- `ReadCString()` / `WriteCString(value)` for null-terminated strings (#2).
  `WriteCString` throws if the encoded string contains a `0x00` byte, so it rejects
  `utf16le` text; use a byte-oriented encoding such as `utf8` or `latin1`.
- `Skip(count)` and `ReadRemaining()` on `BinaryReader` (#3). Skipping past the end
  does nothing.
- Non-consuming `Peek*` methods for every fixed-width type, plus `PeekBoolean()` and
  `PeekBytes(count)` (#4).
- Opt-in strict mode: `new BinaryReader(input, endianness, encoding, { Strict: true })`
  makes short reads, invalid counts, missing C-string terminators and truncated or
  overlong varints throw a `RangeError` instead of returning a zero value (#6).
- `Uint8Array` input for the `BinaryReader` constructor and `WriteBytes` (#7). It is
  copied, like a `Buffer`.
- LEB128 varints: `ReadVarUInt32`/`WriteVarUInt32`, ZigZag-signed
  `ReadVarInt32`/`WriteVarInt32`, and 64-bit `BigInt` variants
  `ReadVarUInt64`/`WriteVarUInt64`/`ReadVarInt64`/`WriteVarInt64` (#8).
- `Strict` property on `BinaryReader`.
- Both constructors can be called without `new`, and instances have a correct
  `constructor` property.
- `./package.json` in the `exports` map.

### Changed

- **`BinaryWriter` writes are now amortized O(1)** instead of re-copying the whole
  buffer on every write (#9). Building a buffer from many small writes is roughly
  20× faster at 100k writes and the gap grows with size.
- **`BinaryReader` reads no longer re-slice the buffer on every call** (#10). They
  read at an internal offset, which makes fixed-width reads about 1.6–3× faster.
- `ByteBuffer` is now an accessor on both classes. Reading it returns the same bytes
  as before. On the reader, assigning a `Buffer` replaces the unread data (`Position`
  and `Length` are kept); on the writer, it replaces the contents and resets `Length`.
  Assigning anything other than a `Buffer` throws a `TypeError`. `ByteBuffer` no
  longer appears in `Object.keys()`/`JSON.stringify()` of an instance.
- The writer's `ByteBuffer` no longer depends on `Length`, so changing `Length` by
  hand can no longer zero-pad the output.
- Invalid `endianness` (anything other than `'big'`, `'little'` or a falsy value) now
  throws a `TypeError` instead of silently meaning big-endian. Unknown encodings
  throw a `TypeError` in both constructors, whatever the input type.
- Integer writers throw a `TypeError` for non-integer or non-number values (such as
  `1.5`, `NaN`, `'5'`, `true`) instead of silently coercing them. `WriteFloat` and
  `WriteDouble` throw on non-numbers. The 64-bit writers accept only integer numbers
  and `BigInt`s.
- Array input to the reader constructor and `WriteBytes` must contain integers from
  0 to 255; other elements throw instead of being wrapped modulo 256.
- Error messages for invalid `WriteBytes`/`WriteString` input now include the input
  type.

### Fixed

- `ReadBytes` threw on a negative, `NaN` or missing count, and `ReadBytes`/`ReadString`
  left `Position` as a fraction, `NaN` or a string for non-integer counts. Invalid
  counts now return an empty value without advancing.
- A string input to `BinaryReader` without an explicit encoding was encoded as UTF-8
  while `Encoding` reported `'ascii'`. It now uses the reader's `Encoding`.
- `WriteBytes(string)` silently truncated characters above U+00FF; it now throws a
  `RangeError` and points to `WriteString`.
- `WriteBytes(buffer)` now always copies its argument.

## [0.3.0] - 2026-07-04

### Added

- `BinaryReader.ReadString(count)` and `BinaryWriter.WriteString(value)`: read and
  write strings using the instance's `Encoding` (`'ascii'` by default). Reading
  past the end returns an empty string without advancing; writing a non-string
  throws.

## [0.2.0] - 2026-07-02

### Added

- MIT license (`LICENSE` file and `license` field in `package.json`).
- Bundled TypeScript type definitions (`binutils.d.ts`).
- `CHANGELOG.md` (this file).
- ESLint configuration that locks `binutils.js` to ES5 syntax, an `npm run lint`
  script, and a CI lint job.
- GitHub Actions publish workflow that releases to npm with provenance.
- Package metadata: `files` whitelist, `exports` map, `keywords`, `bugs`, `homepage`.
- `.editorconfig`.

### Changed

- Raised the declared Node.js floor (`engines.node`) from `>=0.12` to `>=12`,
  matching the actual requirement of the 64-bit `BigInt` methods.
- Replaced the deprecated `new Buffer(...)` constructor with
  `Buffer.alloc()`/`Buffer.from()`; the `DEP0005` deprecation warning is gone.
  No behavior change.
- `repository.url` now uses `git+https://` instead of the retired `git://` protocol.

## [0.1.4] - 2026-05-28

### Added

- Test suite using the built-in `node:test` runner: reader, writer, round-trip,
  edge-case and README-example coverage.
- GitHub Actions CI running the tests on Node.js 20, 22 and 24.

## [0.1.3] - 2024-11-01

### Fixed

- `ReadInt64` returning incorrect values.

## [0.1.2] - 2018-06-15

### Changed

- README updates.

## [0.1.1] - 2018-06-15

### Added

- First release of `binutils64`: `BinaryReader` and `BinaryWriter` with selectable
  endianness, signed/unsigned 8/16/32-bit integers, floats, doubles, raw byte runs,
  and 64-bit integers via `BigInt`.
