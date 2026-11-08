---
name: release
description: Cut a new binutils64 release — pick the semver bump, move CHANGELOG Unreleased entries under the new version, bump package.json, tag, push, and create the GitHub release that triggers the npm publish workflow. Use when asked to release, publish, bump the version, or ship to npm.
---

# Releasing binutils64

Publishing to npm is automated: `.github/workflows/publish.yml` runs on a
**published GitHub release**, runs `npm test`, and publishes with provenance via
npm Trusted Publishing (no token). You never run `npm publish` locally.

Every step that pushes, tags or creates a release is outward-facing: confirm with
the user before step 5 unless they already said to go ahead.

## 1. Pre-flight

```bash
git checkout master && git pull --ff-only
git status --short          # must be clean
npm ci
npm test
npm run lint
node .claude/skills/check-api-sync/check-api-sync.js
sh .claude/skills/check-api-sync/check-typings.sh
npm pack --dry-run          # only binutils.js, binutils.d.ts, CHANGELOG.md, README.md, LICENSE, package.json
gh run list --branch master --limit 3   # last CI run on master is green
```

Stop and report if any of these fail.

## 2. Choose the version

Read `## [Unreleased]` in `CHANGELOG.md`; it must not be empty.

- Pre-1.0 (current): new features or behavior changes (e.g. `ByteBuffer` becoming
  an accessor) → **minor** (`0.3.0` → `0.4.0`); fixes/docs only → **patch**.
- Anything that breaks a rule in "Behavior to preserve" in `CLAUDE.md` must be
  called out under a `### Changed` note explaining the migration.

## 3. Update the changelog

Rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD` (today's date) and add a
fresh empty `## [Unreleased]` above it. Keep Keep-a-Changelog subsections. If the
heading is missing entirely, there is nothing to release — stop and report.

## 4. Bump and commit

```bash
git add CHANGELOG.md
git commit -m "update changelog for X.Y.Z"
npm version X.Y.Z -m "bump version to %s"
```

`npm version` refuses to run with staged changes, so commit the changelog first.
It then updates `package.json` and `package-lock.json`, commits with the
repo's message style (`bump version to 0.4.0`) and creates the `vX.Y.Z` tag. No AI
attribution in the commit.

## 5. Push and release (confirm first)

```bash
git push origin master --follow-tags
gh release create vX.Y.Z --title "vX.Y.Z" --notes "<the CHANGELOG section for X.Y.Z>"
```

## 6. Verify

The publish workflow fails fast if the release tag does not match the
`package.json` version, and it runs lint and tests before publishing.

```bash
gh run list --workflow publish.yml --limit 1
gh run watch <run-id>
npm view binutils64 version
```

Report the published version, or the failing step with its log if the publish
workflow failed. Do not retry a failed publish by bumping again without the user.
