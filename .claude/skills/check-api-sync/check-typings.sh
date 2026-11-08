#!/bin/sh
# Type-checks binutils.d.ts under --strict with Node types, without adding
# TypeScript to the project's devDependencies.
# Usage: sh .claude/skills/check-api-sync/check-typings.sh   (from repo root)
set -e
TOOLS="${TMPDIR:-/tmp}/binutils64-tsc"
if [ ! -x "$TOOLS/node_modules/.bin/tsc" ]; then
    npm i --silent --no-save --prefix "$TOOLS" typescript @types/node
fi
"$TOOLS/node_modules/.bin/tsc" --noEmit --strict \
    --typeRoots "$TOOLS/node_modules/@types" --types node binutils.d.ts
echo "binutils.d.ts type-checks."
