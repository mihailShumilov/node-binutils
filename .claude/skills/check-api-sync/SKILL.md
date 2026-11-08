---
name: check-api-sync
description: Verify that the public API of binutils.js is consistently reflected in binutils.d.ts, README.md, the test suite and CHANGELOG.md. Use after adding, renaming or removing a Read/Write/Peek method, before opening a PR, and before a release.
---

# Checking API sync for binutils64

Every public method lives in four places: `binutils.js` (implementation),
`binutils.d.ts` (typings), `README.md` (API reference) and `test/` (coverage). A
user-visible change also needs a `CHANGELOG.md` entry under `Unreleased`. This
skill catches drift between them.

## 1. Run the mechanical check

From the repo root:

```bash
node .claude/skills/check-api-sync/check-api-sync.js
```

It loads `binutils.js`, enumerates the public (`PascalCase`) methods on both
prototypes (instance properties such as `ByteBuffer`, `Length` and the prototype
`Strict` accessor — `readonly` in the typings — are checked by hand against the
property tables), and reports:

- members missing from `binutils.d.ts`, `README.md`, or any `test/*.test.js`;
- methods declared in `binutils.d.ts` that the code does not implement;
- whether the `CHANGELOG.md` `Unreleased` section has entries (informational only).

Exit code `1` means a member is missing from, or extra in, the typings/README/tests.
Fix every reported line.

## 2. Check what the script cannot

The script matches names only. Also verify by reading:

- **Signatures**: parameter count and types in `binutils.d.ts` match the code
  (e.g. `ReadBytes(count: number): Buffer`; 64-bit reads return `bigint | 0`;
  64-bit writes accept `number | bigint`).
- **Documented behavior** matches the code: out-of-range reads return the zero
  value without advancing; which inputs throw; byte widths stated in README match
  the `Buffer.alloc(N)` / slice width.
- **README tables** include the new entry beside its family (the tables pair
  `UIntN`/`IntN` by width, then float/double, boolean, bytes/strings, varints;
  peeks are listed under `Peek methods`). `binutils.js` lists all unsigned, then
  all signed.
- **CHANGELOG** entry is in the right subsection (`Added` / `Changed` / `Fixed`)
  and only under `Unreleased` until a release is cut.
- `binutils.d.ts` still type-checks:
  `sh .claude/skills/check-api-sync/check-typings.sh`.

## 3. Report

List what was out of sync and what you changed. If everything was already in
sync, say so plainly.
