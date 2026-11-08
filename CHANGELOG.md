# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

This release is backward compatible with 0.3.0. Without the new `{ Strict: true }`
option, every call that worked in 0.3.0 returns the same values, writes the same bytes
and throws the same errors, and instances keep the same enumerable properties. A
randomized test (`test/compat.test.js`) compares the two versions call by call.

### Added

- `ReadBoolean()` / `WriteBoolean(value)` (#5).
- `ReadCString()` / `WriteCString(value)` for null-terminated strings (#2).
  `WriteCString` throws if the encoded string contains a `0x00` byte, so it rejects
  `utf16le` text; use a byte-oriented encoding such as `utf8` or `latin1`.
- `Skip(count)` and `ReadRemaining()` on `BinaryReader` (#3). Skipping past the end
  does nothing.
- Non-consuming `Peek*` methods for every fixed-width type, plus `PeekBoolean()` and
  `PeekBytes(count)` (#4).
- Opt-in strict mode on both classes (#6):
  `new BinaryReader(input, endianness, encoding, { Strict: true })` and
  `new BinaryWriter(endianness, encoding, { Strict: true })`. Strict readers throw a
  `RangeError` on short reads, invalid counts, missing C-string terminators and
  truncated or overlong varints. Strict writers reject non-integers, non-numbers,
  unsafe 64-bit `number`s, out-of-range array elements and characters the encoding
  cannot represent. Both constructors then also validate `endianness` and
  `encoding`; the reader also validates array and string input. Strict mode only
  adds errors; it never changes a result. Options that do not ask for strict mode
  are ignored, as 0.3.0 ignored extra constructor arguments.
- `Uint8Array` input for the `BinaryReader` constructor and `WriteBytes` (#7). It is
  copied, like a `Buffer`.
- LEB128 varints: `ReadVarUInt32`/`WriteVarUInt32`, ZigZag-signed
  `ReadVarInt32`/`WriteVarInt32`, and 64-bit `BigInt` variants
  `ReadVarUInt64`/`WriteVarUInt64`/`ReadVarInt64`/`WriteVarInt64` (#8).
- Read-only-in-effect `Strict` property on both classes (non-enumerable; assigning it
  stores a value, as in 0.3.0, but never changes the mode).
- Both constructors can be called without `new`, and instances have a correct
  `constructor` property.
- `./package.json` in the `exports` map.

### Changed

- **`BinaryWriter` writes are amortized O(1)** instead of re-copying the whole buffer
  on every write (#9): about 20–55× faster at 20,000 small writes, and the gap grows
  with size. Reading `ByteBuffer` after every write stays about as fast as in 0.3.0.
- **`BinaryReader` reads no longer re-slice the buffer on every call** (#10). They
  read at an internal offset, which makes fixed-width reads about 1.6–3× faster
  (`ReadUInt8` more than 10×).
- `ByteBuffer` is now an accessor on both classes. It returns the same bytes, keeps
  the same identity between writes, and is still listed first by `Object.keys()` and
  `JSON.stringify()`; `console.log`/`util.inspect` print the same plain object as
  before. Copies made with `Object.assign` or spread, `Object.create` forks, frozen
  instances and methods borrowed onto other objects keep working as in 0.3.0.
- Constructing an instance costs about 0.1–0.25 µs more than in 0.3.0 (private state
  is kept out of `Object.keys`). Reads and writes are faster, so a reader that
  performs a few reads per object breaks even.

### Fixed

- `ReadBytes` and `ReadString` no longer leave `Position` as a fraction or a
  string when given a non-integer `count`; it always counts the bytes consumed.
- Reading after assigning `null` to a reader's `ByteBuffer` returns zero values
  instead of throwing a `TypeError` from inside the library.

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
