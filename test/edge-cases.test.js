var test = require('node:test');
var assert = require('node:assert/strict');
var binutils = require('../binutils.js');
var BinaryReader = binutils.BinaryReader;

test('constructor accepts a Buffer', function() {
    var r = new BinaryReader(Buffer.from([1, 2, 3]));
    assert.equal(r.Length, 3);
    assert.equal(r.ReadUInt8(), 1);
});

test('constructor accepts an Array', function() {
    var r = new BinaryReader([1, 2, 3]);
    assert.equal(r.Length, 3);
    assert.equal(r.ReadUInt8(), 1);
});

test('constructor accepts a string with encoding', function() {
    var r = new BinaryReader('ABC', 'big', 'ascii');
    assert.equal(r.Length, 3);
    assert.equal(r.ReadUInt8(), 65);
});

test('constructor rejects invalid input types', function() {
    assert.throws(function() { new BinaryReader(42); }, /Invalid buffer input/);
    assert.throws(function() { new BinaryReader({}); }, /Invalid buffer input/);
    assert.throws(function() { new BinaryReader(null); }, /Invalid buffer input/);
});

test('constructor copies the input buffer (no aliasing)', function() {
    var src = Buffer.from([1, 2, 3]);
    var r = new BinaryReader(src);
    src[0] = 99; // mutate the caller's buffer after construction
    assert.equal(r.ReadUInt8(), 1, 'reader is unaffected by later mutation of the source');
});

test('out-of-range integer reads return 0 without advancing Position', function() {
    var r = new BinaryReader([0x01], 'big'); // only 1 byte available
    assert.equal(r.ReadUInt16(), 0);
    assert.equal(r.ReadUInt32(), 0);
    assert.equal(r.ReadUInt64(), 0);
    assert.equal(r.ReadInt16(), 0);
    assert.equal(r.ReadInt32(), 0);
    assert.equal(r.ReadInt64(), 0);
    assert.equal(r.Position, 0, 'failed reads do not advance Position');
    assert.equal(r.ByteBuffer.length, 1, 'failed reads do not consume bytes');
});

test('out-of-range float/double reads return 0', function() {
    var r = new BinaryReader([0x01], 'big');
    assert.equal(r.ReadFloat(), 0);
    assert.equal(r.ReadDouble(), 0);
});

test('ReadUInt8 on an empty buffer returns 0', function() {
    var r = new BinaryReader([], 'big');
    assert.equal(r.Length, 0);
    assert.equal(r.ReadUInt8(), 0);
    assert.equal(r.ReadInt8(), 0);
});

test('ReadBytes returns an empty Buffer when count exceeds remaining', function() {
    var r = new BinaryReader([1, 2, 3], 'big');
    var out = r.ReadBytes(5);
    assert.ok(Buffer.isBuffer(out));
    assert.equal(out.length, 0);
    assert.equal(r.Position, 0, 'over-long ReadBytes does not advance');
    assert.equal(r.ByteBuffer.length, 3);
});

test('ReadBytes reading exactly the remaining length succeeds', function() {
    var r = new BinaryReader([1, 2, 3], 'big');
    assert.deepEqual(Array.from(r.ReadBytes(3)), [1, 2, 3]);
    assert.equal(r.Position, 3);
    assert.equal(r.ByteBuffer.length, 0);
});
