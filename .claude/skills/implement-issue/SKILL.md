---
name: implement-issue
description: End-to-end workflow for implementing a GitHub issue or feature request in binutils64 — branch, implement in ES5 style, update typings/README/CHANGELOG, test, lint, review, commit and open a PR. Use when asked to implement, fix or work on an issue (e.g. "implement #5", "add peek methods", "do the strict mode issue").
---

# Implementing an issue in binutils64

## 1. Understand the request

- Read the issue: `gh issue view <N>` (acceptance criteria are usually listed).
- Read `CHANGELOG.md` and `git log --oneline -10` to see whether part of it already
  shipped (e.g. #2 asked for `ReadString`/`WriteString`/`ReadCString`; the first
  two shipped in 0.3.0, so only `ReadCString` remains).
- Re-read "Behavior to preserve" in `CLAUDE.md`. Any change that would break one of
  those rules needs an explicit opt-in or a breaking-change discussion with the user
  before you write code.

## 2. Branch

```bash
git checkout master && git pull --ff-only
git checkout -b <short-kebab-name>   # e.g. add-boolean, reader-peek-methods
```

## 3. Implement

- New numeric/binary type → follow the `add-binary-type` skill exactly.
- Non-type features (helpers like `Skip`, `Peek*`, options like strict mode) →
  same conventions: ES5 only (`var`, prototype methods, no arrow functions /
  `let` / `const` / classes), `PascalCase` names, `p_` params, `s_` locals,
  `Buffer.alloc`/`Buffer.from` only.
- Keep each method beside its family; do not append everything at the end.
- Prefer one shared private helper over duplicating logic across many methods
  only when it keeps the existing style readable; the codebase is deliberately
  explicit per method.

### Design decisions already taken (0.4.0)

Issues #2–#10 were implemented together. New work must stay consistent with:

- `ByteBuffer` is an accessor on both classes; assigning a `Buffer` replaces the
  data (reader keeps `Position`/`Length`; writer resets `Length`).
- The reader reads at a private `_Offset`; `Position` is informational only.
- Strict mode is opt-in (`{ Strict: true }`, 4th reader argument) and covers every
  read, peek, `Skip`, `ReadCString` and varint read, plus invalid counts.
- `Skip` past the end does nothing (or throws in strict mode).
- Varints: `Var(U)Int32` return numbers, `Var(U)Int64` return BigInts; truncated or
  overlong input returns `0` without advancing.
- Short 64-bit reads return the number `0` (changing that would be breaking).

## 4. Docs, typings, changelog

- `README.md`: API reference entry in the right section, table of contents if a
  new heading was added, and an example if the feature is non-obvious.
- `binutils.d.ts`: signature and doc comment matching the existing style.
- `CHANGELOG.md`: entry under `## [Unreleased]` (create the heading above the
  latest release if missing) in `Added` / `Changed` / `Fixed`.

## 5. Test and verify

- Add tests per the `test-binutils` skill (both endiannesses, boundaries, short
  reads, invariants on `Position`/`Length`/`ByteBuffer`).
- Run all of:
  ```bash
  npm test
  npm run lint
  node .claude/skills/check-api-sync/check-api-sync.js
  sh .claude/skills/check-api-sync/check-typings.sh
  ```
- Delegate a review to the `binutils-reviewer` agent and fix any correctness
  findings it reports.

## 6. Commit and PR (only when the user asked for it)

- Commit message: short, lowercase, imperative, e.g. `add read/write boolean`.
  No AI attribution or co-author trailers.
- PR: `gh pr create --title "<same style>" --body "..."` with a summary, the
  test/lint results, and `Closes #<N>`. No AI attribution in title or body.
- Do not bump the version here — releases go through the `release` skill.
