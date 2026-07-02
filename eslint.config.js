'use strict';

var js = require('@eslint/js');

var s_NodeGlobals = {
    Buffer: 'readonly',
    BigInt: 'readonly',
    console: 'readonly',
    process: 'readonly',
    module: 'writable',
    require: 'readonly'
};

module.exports = [
    { ignores: ['node_modules/'] },
    js.configs.recommended,
    {
        // The library must stay ES5 (see CLAUDE.md): parsing at ecmaVersion 5
        // makes let/const/arrow functions/classes hard errors.
        files: ['binutils.js'],
        languageOptions: {
            ecmaVersion: 5,
            sourceType: 'commonjs',
            globals: s_NodeGlobals
        }
    },
    {
        files: ['test/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: s_NodeGlobals
        }
    }
];
