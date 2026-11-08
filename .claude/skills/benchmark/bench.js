'use strict';

// Micro-benchmark for binutils64 hot paths. See SKILL.md for the before/after recipe.
// Usage: node .claude/skills/benchmark/bench.js [libPath] [scale]
//   libPath  path to a binutils.js to load (default ./binutils.js)
//   scale    multiplier for operation counts (default 1)

var path = require('path');

var s_LibPath = path.resolve(process.argv[2] || 'binutils.js');
var s_Scale = Number(process.argv[3] || 1);
var binutils = require(s_LibPath);

// Results are accumulated here so the JIT cannot drop the benchmarked work.
var s_Sink = 0;

function bench(p_Name, p_Ops, p_Fn) {
    p_Fn(Math.max(1, Math.floor(p_Ops / 10))); // warm-up
    var s_Best = Infinity;
    for (var i = 0; i < 5; ++i) {
        var s_Start = process.hrtime.bigint();
        s_Sink += Number(p_Fn(p_Ops)) || 0;
        var s_Ms = Number(process.hrtime.bigint() - s_Start) / 1e6;
        if (s_Ms < s_Best) {
            s_Best = s_Ms;
        }
    }
    var s_OpsPerSec = Math.round(p_Ops / (s_Best / 1000));
    console.log(p_Name.padEnd(36) + String(p_Ops).padStart(9) + ' ops  ' +
        s_Best.toFixed(2).padStart(9) + ' ms  ' + s_OpsPerSec.toLocaleString('en-US').padStart(14) + ' ops/s');
}

function writeMany(p_Method, p_Value) {
    return function(p_Ops) {
        var w = new binutils.BinaryWriter('little');
        for (var i = 0; i < p_Ops; ++i) {
            w[p_Method](p_Value);
        }
        return w.ByteBuffer.length;
    };
}

function readMany(p_Method, p_Width) {
    return function(p_Ops) {
        var r = new binutils.BinaryReader(Buffer.alloc(p_Ops * p_Width, 7), 'little');
        var s_Sum = 0;
        for (var i = 0; i < p_Ops; ++i) {
            s_Sum += Number(r[p_Method]());
        }
        return s_Sum;
    };
}

// Write, then read ByteBuffer after every write (e.g. framing loops that check the
// length or peek at the output). Catches getters that re-concat or copy on each access.
function writeThenGet(p_Ops) {
    var w = new binutils.BinaryWriter('little');
    var s_Sum = 0;
    for (var i = 0; i < p_Ops; ++i) {
        w.WriteUInt32(i);
        s_Sum += w.ByteBuffer.length;
    }
    return s_Sum;
}

// Retained heap after many small writes: shows per-write overhead (chunk lists,
// wrapper objects) that throughput numbers hide. Run node with --expose-gc for
// stable numbers; without it the figure is a rough upper bound.
function memory(p_Name, p_Ops) {
    var s_Gc = typeof global.gc === 'function' ? global.gc : function() {};
    s_Gc();
    var s_Before = process.memoryUsage();
    var w = new binutils.BinaryWriter('little');
    for (var i = 0; i < p_Ops; ++i) {
        w.WriteUInt8(i & 0xFF);
    }
    s_Gc();
    var s_After = process.memoryUsage();
    var s_Delta = (s_After.heapUsed - s_Before.heapUsed) + (s_After.arrayBuffers - s_Before.arrayBuffers);
    s_Sink += w.Length;
    console.log(p_Name.padEnd(36) + String(p_Ops).padStart(9) + ' ops  ' +
        (s_Delta / 1048576).toFixed(1).padStart(9) + ' MB retained' +
        (typeof global.gc === 'function' ? '' : ' (no --expose-gc)'));
}

var N = Math.floor(20000 * s_Scale);

console.log('binutils64 bench — ' + s_LibPath + ' — node ' + process.version + '\n');
// Memory first, before the throughput runs leave garbage behind.
memory('WriteUInt8 retained heap', N * 10);
bench('WriteUInt8  (writer accumulation)', N, writeMany('WriteUInt8', 7));
bench('WriteUInt32', N, writeMany('WriteUInt32', 0xDEADBEEF));
bench('WriteDouble', N, writeMany('WriteDouble', Math.PI));
bench('WriteInt64', N, writeMany('WriteInt64', -5n));
bench('ReadUInt8   (reader slicing)', N * 5, readMany('ReadUInt8', 1));
bench('ReadUInt32', N * 5, readMany('ReadUInt32', 4));
bench('ReadDouble', N * 5, readMany('ReadDouble', 8));
bench('ReadInt64', N * 5, readMany('ReadInt64', 8));
bench('WriteUInt32 + ByteBuffer get', N, writeThenGet);
console.log('\n(checksum ' + s_Sink + ')');
