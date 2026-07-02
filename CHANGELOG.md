# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
