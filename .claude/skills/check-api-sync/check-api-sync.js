'use strict';

// Verifies that every public BinaryReader/BinaryWriter method in binutils.js is
// declared in binutils.d.ts, documented in README.md and exercised in test/.
// Also flags names that the docs/typings mention but the code no longer has.
// Usage: node .claude/skills/check-api-sync/check-api-sync.js  (from repo root)

var fs = require('fs');
var path = require('path');

var s_Root = process.cwd();
var s_Lib = require(path.join(s_Root, 'binutils.js'));
var s_Dts = fs.readFileSync(path.join(s_Root, 'binutils.d.ts'), 'utf8');
var s_Readme = fs.readFileSync(path.join(s_Root, 'README.md'), 'utf8');
var s_TestDir = path.join(s_Root, 'test');
var s_Tests = fs.readdirSync(s_TestDir)
    .filter(function(p_Name) { return /\.test\.js$/.test(p_Name); })
    .map(function(p_Name) { return fs.readFileSync(path.join(s_TestDir, p_Name), 'utf8'); })
    .join('\n');

function publicMembers(p_Class) {
    return Object.getOwnPropertyNames(p_Class.prototype).filter(function(p_Name) {
        return p_Name !== 'constructor' && /^[A-Z]/.test(p_Name);
    });
}

function mentions(p_Text, p_Name) {
    return new RegExp('\\b' + p_Name + '\\b').test(p_Text);
}

var s_Problems = [];
var s_Known = {};

['BinaryReader', 'BinaryWriter'].forEach(function(p_ClassName) {
    publicMembers(s_Lib[p_ClassName]).forEach(function(p_Name) {
        s_Known[p_Name] = true;
        if (!mentions(s_Dts, p_Name)) {
            s_Problems.push(p_ClassName + '.' + p_Name + ': missing from binutils.d.ts');
        }
        if (!mentions(s_Readme, p_Name)) {
            s_Problems.push(p_ClassName + '.' + p_Name + ': missing from README.md');
        }
        if (!mentions(s_Tests, p_Name)) {
            s_Problems.push(p_ClassName + '.' + p_Name + ': not referenced by any test in test/');
        }
    });
});

// Method-like names declared in the typings that the code does not implement.
var s_DtsMethod = /^\s+((?:Read|Write|Peek)[A-Za-z0-9]*|[A-Z][A-Za-z0-9]*)\s*\(/gm;
var s_Match;
while ((s_Match = s_DtsMethod.exec(s_Dts)) !== null) {
    if (!s_Known[s_Match[1]]) {
        s_Problems.push(s_Match[1] + ': declared in binutils.d.ts but not implemented in binutils.js');
    }
}

// Report whether the Unreleased section has entries (informational; does not affect the exit code).
var s_Changelog = fs.readFileSync(path.join(s_Root, 'CHANGELOG.md'), 'utf8');
var s_Unreleased = /## \[?Unreleased\]?([\s\S]*?)(\n## |$)/i.exec(s_Changelog);
var s_HasUnreleased = !!(s_Unreleased && /\S/.test(s_Unreleased[1]));

console.log('Public members checked: ' + Object.keys(s_Known).sort().join(', '));
console.log('CHANGELOG Unreleased section: ' + (s_HasUnreleased ? 'has entries' : 'empty or missing'));

if (s_Problems.length) {
    console.log('\nOut of sync:');
    s_Problems.forEach(function(p_Line) { console.log('  - ' + p_Line); });
    process.exitCode = 1;
} else {
    console.log('\nAPI surface is in sync across binutils.js, binutils.d.ts, README.md and test/.');
}
