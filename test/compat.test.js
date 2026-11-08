// Backward-compatibility guard: runs the published 0.3.0 implementation
// (test/fixtures/binutils-0.3.0.js, never edit it) and the current one side by side
// on thousands of seeded random operation sequences, and requires identical
// observable behavior in default (non-strict) mode:
//   return values, thrown errors (class, message, code), produced bytes,
//   Length, Position, Endianness, Encoding, Object.keys and JSON.stringify.
//
// The only allowed differences are the documented ones:
//   - 0.3.0 could leave Position as NaN, a fraction or a string after odd counts;
//     the new code keeps it an integer equal to the bytes consumed.
//   - Inputs 0.3.0 rejected (Uint8Array) are now accepted; they are not generated.
//   - Reading after `reader.ByteBuffer = null` threw in 0.3.0; it is not generated.

var test = require('node:test');
var assert = require('node:assert/strict');
var Legacy = require('./fixtures/binutils-0.3.0.js');
var Current = require('../binutils.js');

function Random(p_Seed) {
    var s_State = p_Seed >>> 0;
    return function() {
        s_State = (s_State + 0x6D2B79F5) >>> 0;
        var t = s_State;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function Pick(p_Random, p_List) {
    return p_List[Math.floor(p_Random() * p_List.length)];
}

function Normalize(p_Value, p_OwnStore) {
    if (Buffer.isBuffer(p_Value)) {
        var s_Out = { buffer: p_Value.toString('hex') };
        if (p_OwnStore) {
            s_Out.own = p_Value.byteOffset === 0 && p_Value.buffer.byteLength === p_Value.length;
        }
        return s_Out;
    }
    if (typeof p_Value == 'bigint') {
        return { bigint: p_Value.toString() };
    }
    if (typeof p_Value == 'number' && Number.isNaN(p_Value)) {
        return 'NaN';
    }
    if (Object.is(p_Value, -0)) {
        return '-0';
    }
    return p_Value;
}

function Call(p_Fn, p_OwnStore) {
    try {
        return { value: Normalize(p_Fn(), p_OwnStore) };
    } catch (p_Error) {
        return { error: p_Error.constructor.name + '|' + p_Error.name + '|' + p_Error.code + '|' + p_Error.message };
    }
}

function Describe(p_Value) {
    if (typeof p_Value == 'bigint') {
        return p_Value + 'n';
    }
    if (Buffer.isBuffer(p_Value)) {
        return 'Buffer<' + p_Value.toString('hex') + '>';
    }
    if (typeof p_Value == 'function') {
        return 'fn';
    }
    try {
        return JSON.stringify(p_Value);
    } catch (p_Error) {
        return String(p_Value) + ' (' + p_Error.name + ')';
    }
}

// --- Value pools ---

var Counts = [0, 1, 2, 3, 4, 8, 100, -1, NaN, Infinity, -Infinity, 1.5, 2.7, '2', '9', '', undefined, null, true, false];
var ReaderInputs = [
    function() { return Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0xFF, 0x80, 0x7F, 0x00]); },
    function() { return Buffer.from([]); },
    function() { return Buffer.from([0xC3, 0xA9, 0x41, 0x00, 0x42]); },
    function() { return [1, 2, 300, -1, 1.5, 0xFF, 0x80, 'a', 7, 9, 11, 13]; },
    function() { return []; },
    function() { return 'Hello, binary world!'; },
    function() { return 'héllo €'; },
    function() { return '0aff10ee'; }
];
var Endians = [undefined, 'big', 'little', 'LE', '', null, 'Little'];
var Encodings = [undefined, 'ascii', 'utf8', 'latin1', 'hex', 'base64', 'utf16le'];
var ReaderMethods = ['ReadUInt8', 'ReadUInt16', 'ReadUInt32', 'ReadUInt64', 'ReadInt8', 'ReadInt16', 'ReadInt32',
    'ReadInt64', 'ReadFloat', 'ReadDouble'];

var WriteValues = [0, 1, -1, 127, 128, 255, 256, -128, -129, 32767, 32768, 65535, 65536, 2147483647, 2147483648,
    -2147483648, 4294967295, 4294967296, 1.5, -1.5, 0.1, NaN, Infinity, -Infinity, -0, Number.MAX_SAFE_INTEGER,
    2 ** 60, '5', 'x', '', true, false, null, undefined, {}, [], 5n, -5n, 2n ** 63n - 1n, -(2n ** 63n), 2n ** 64n - 1n,
    2n ** 64n];
var ByteValues = [
    function() { return 'ABC'; }, function() { return 'hé€😀'; }, function() { return ''; },
    function() { return [1, 2, 3]; }, function() { return [256, -1, 1.5, 'a', NaN, {}]; }, function() { return []; },
    function() { return Buffer.from([9, 8, 7]); }, function() { return Buffer.alloc(0); },
    function() { return 42; }, function() { return null; }, function() { return {}; }
];
var StringValues = ['', 'abc', 'héllo', '€', 'zz', '0aff', 42, null, undefined, ['a']];
var WriterMethods = ['WriteUInt8', 'WriteUInt16', 'WriteUInt32', 'WriteUInt64', 'WriteInt8', 'WriteInt16', 'WriteInt32',
    'WriteInt64', 'WriteFloat', 'WriteDouble'];

// --- Reader ---

function ReaderState(p_Reader, p_ComparePosition) {
    var s_Json = JSON.parse(JSON.stringify(p_Reader));
    if (!p_ComparePosition) {
        delete s_Json.Position;
    }
    return {
        bytes: Normalize(p_Reader.ByteBuffer),
        Length: p_Reader.Length,
        Endianness: p_Reader.Endianness,
        Encoding: p_Reader.Encoding,
        keys: Object.keys(p_Reader).join(','),
        json: s_Json
    };
}

function RunReaderScenario(p_Seed) {
    var s_Random = Random(p_Seed);
    var s_Input = Pick(s_Random, ReaderInputs);
    var s_Endian = Pick(s_Random, Endians);
    var s_Encoding = Pick(s_Random, Encodings);
    var s_Log = ['new BinaryReader(' + Describe(s_Input()) + ', ' + Describe(s_Endian) + ', ' + Describe(s_Encoding) + ')'];

    var s_Old = Call(function() { return new Legacy.BinaryReader(s_Input(), s_Endian, s_Encoding); });
    var s_New = Call(function() { return new Current.BinaryReader(s_Input(), s_Endian, s_Encoding); });
    if (s_Old.error || s_New.error) {
        assert.deepEqual(s_New, s_Old, s_Log.join('\n'));
        return;
    }
    var s_OldReader = new Legacy.BinaryReader(s_Input(), s_Endian, s_Encoding);
    var s_NewReader = new Current.BinaryReader(s_Input(), s_Endian, s_Encoding);
    var s_OldPositionValid = true;

    for (var i = 0; i < 14; ++i) {
        var s_Kind = s_Random();
        var s_Op;
        var s_OwnStore = false;
        if (s_Kind < 0.55) {
            var s_Method = Pick(s_Random, ReaderMethods);
            s_Op = { name: s_Method + '()', run: function(r) { return r[this.method](); }, method: s_Method };
        } else if (s_Kind < 0.75) {
            var s_Count = Pick(s_Random, Counts);
            s_Op = { name: 'ReadBytes(' + Describe(s_Count) + ')', run: function(r) { return r.ReadBytes(this.count); }, count: s_Count };
            s_OwnStore = true;
        } else if (s_Kind < 0.93) {
            var s_StringCount = Pick(s_Random, Counts);
            s_Op = { name: 'ReadString(' + Describe(s_StringCount) + ')', run: function(r) { return r.ReadString(this.count); }, count: s_StringCount };
        } else if (s_Kind < 0.97) {
            var s_Append = Buffer.from([0xAB, 0xCD, 0x01]);
            s_Op = {
                name: 'ByteBuffer = concat(ByteBuffer, abcd01)',
                run: function(r) { r.ByteBuffer = Buffer.concat([r.ByteBuffer, this.append]); },
                append: s_Append
            };
        } else {
            s_Op = { name: 'Endianness = little', run: function(r) { r.Endianness = 'little'; } };
        }

        s_Log.push(s_Op.name);
        var s_OldResult = Call(s_Op.run.bind(s_Op, s_OldReader), s_OwnStore);
        var s_NewResult = Call(s_Op.run.bind(s_Op, s_NewReader), s_OwnStore);
        var s_Message = s_Log.join('\n');
        assert.deepEqual(s_NewResult, s_OldResult, s_Message);

        // Position: identical while 0.3.0 kept it valid; otherwise an integer byte count
        var s_Consumed = s_NewReader.Position;
        s_OldPositionValid = s_OldPositionValid && Number.isSafeInteger(s_OldReader.Position);
        assert.deepEqual(ReaderState(s_NewReader, s_OldPositionValid), ReaderState(s_OldReader, s_OldPositionValid), s_Message);
        if (s_OldPositionValid) {
            assert.equal(s_NewReader.Position, s_OldReader.Position, s_Message);
        } else {
            s_OldPositionValid = false;
            assert.ok(Number.isSafeInteger(s_Consumed) && s_Consumed >= 0, s_Message + '\nPosition ' + s_Consumed);
        }
    }
}

// --- Writer ---

function WriterState(p_Writer) {
    return {
        bytes: Normalize(p_Writer.ByteBuffer),
        Length: Normalize(p_Writer.Length),
        Endianness: p_Writer.Endianness,
        Encoding: p_Writer.Encoding,
        keys: Object.keys(p_Writer).join(','),
        json: JSON.stringify(p_Writer)
    };
}

function RunWriterScenario(p_Seed) {
    var s_Random = Random(p_Seed);
    var s_Endian = Pick(s_Random, Endians);
    var s_Encoding = Pick(s_Random, Encodings);
    var s_Log = ['new BinaryWriter(' + Describe(s_Endian) + ', ' + Describe(s_Encoding) + ')'];
    var s_OldWriter = new Legacy.BinaryWriter(s_Endian, s_Encoding);
    var s_NewWriter = new Current.BinaryWriter(s_Endian, s_Encoding);
    var s_OldSnapshot = null;
    var s_NewSnapshot = null;

    for (var i = 0; i < 16; ++i) {
        var s_Kind = s_Random();
        var s_Op;
        if (s_Kind < 0.5) {
            var s_Method = Pick(s_Random, WriterMethods);
            var s_Value = Pick(s_Random, WriteValues);
            s_Op = { name: s_Method + '(' + Describe(s_Value) + ')', run: function(w) { return w[this.method](this.value); }, method: s_Method, value: s_Value };
        } else if (s_Kind < 0.65) {
            var s_Bytes = Pick(s_Random, ByteValues);
            s_Op = { name: 'WriteBytes(' + Describe(s_Bytes()) + ')', run: function(w) { return w.WriteBytes(this.bytes()); }, bytes: s_Bytes };
        } else if (s_Kind < 0.75) {
            var s_Text = Pick(s_Random, StringValues);
            s_Op = { name: 'WriteString(' + Describe(s_Text) + ')', run: function(w) { return w.WriteString(this.text); }, text: s_Text };
        } else if (s_Kind < 0.81) {
            s_Op = {
                name: 'patch ByteBuffer[0] = 0x5A',
                run: function(w) {
                    var b = w.ByteBuffer;
                    if (b && b.length) {
                        b[0] = 0x5A;
                    }
                }
            };
        } else if (s_Kind < 0.86) {
            s_Op = { name: 'snapshot', run: null };
        } else if (s_Kind < 0.89) {
            s_Op = { name: 'ByteBuffer === ByteBuffer', run: function(w) { return w.ByteBuffer === w.ByteBuffer; } };
        } else if (s_Kind < 0.93) {
            var s_Length = Pick(s_Random, [0, 1, 3, 10, 'x']);
            s_Op = { name: 'Length = ' + Describe(s_Length), run: function(w) { w.Length = this.length; }, length: s_Length };
        } else if (s_Kind < 0.97) {
            var s_Assign = Pick(s_Random, [
                function() { return Buffer.alloc(0); }, function() { return Buffer.from([1, 2, 3]); }, function() { return null; }
            ]);
            s_Op = { name: 'ByteBuffer = ' + Describe(s_Assign()), run: function(w) { w.ByteBuffer = this.assign(); }, assign: s_Assign };
        } else {
            s_Op = { name: 'reset (ByteBuffer = alloc(0); Length = 0)', run: function(w) { w.ByteBuffer = Buffer.alloc(0); w.Length = 0; } };
        }

        s_Log.push(s_Op.name);
        var s_Message = s_Log.join('\n');
        if (s_Op.run === null) {
            s_OldSnapshot = s_OldWriter.ByteBuffer;
            s_NewSnapshot = s_NewWriter.ByteBuffer;
            continue;
        }
        var s_OldResult = Call(s_Op.run.bind(s_Op, s_OldWriter));
        var s_NewResult = Call(s_Op.run.bind(s_Op, s_NewWriter));
        assert.deepEqual(s_NewResult, s_OldResult, s_Message);
        assert.deepEqual(Call(function() { return WriterState(s_NewWriter); }), Call(function() { return WriterState(s_OldWriter); }), s_Message);
        if (s_OldSnapshot !== null || s_NewSnapshot !== null) {
            assert.deepEqual(Normalize(s_NewSnapshot), Normalize(s_OldSnapshot), s_Message + '\n(snapshot)');
        }
    }
}

var SCENARIOS = Number(process.env.COMPAT_SCENARIOS) || 2500;

test('reader: default mode matches 0.3.0 on ' + SCENARIOS + ' random operation sequences', function() {
    for (var s_Seed = 1; s_Seed <= SCENARIOS; ++s_Seed) {
        RunReaderScenario(s_Seed);
    }
});

test('writer: default mode matches 0.3.0 on ' + SCENARIOS + ' random operation sequences', function() {
    for (var s_Seed = 1; s_Seed <= SCENARIOS; ++s_Seed) {
        RunWriterScenario(s_Seed);
    }
});

test('constructor errors match 0.3.0', function() {
    [42, {}, null, undefined, true, function() {}, 5n].forEach(function(p_Input) {
        var s_Old = Call(function() { return new Legacy.BinaryReader(p_Input); });
        var s_New = Call(function() { return new Current.BinaryReader(p_Input); });
        assert.deepEqual(s_New, s_Old, Describe(p_Input));
    });
});

test('every 0.3.0 method still exists with the same arity', function() {
    ['BinaryReader', 'BinaryWriter'].forEach(function(p_Class) {
        Object.keys(Legacy[p_Class].prototype).forEach(function(p_Name) {
            assert.equal(typeof Current[p_Class].prototype[p_Name], 'function', p_Class + '.' + p_Name);
            assert.equal(Current[p_Class].prototype[p_Name].length, Legacy[p_Class].prototype[p_Name].length, p_Class + '.' + p_Name);
        });
    });
    assert.deepEqual(Object.keys(Current), Object.keys(Legacy));
});

test('for...in over an instance still lists every 0.3.0 key', function() {
    var s_Old = [];
    var s_New = [];
    var k;
    for (k in new Legacy.BinaryReader([1])) {
        s_Old.push(k);
    }
    for (k in new Current.BinaryReader([1])) {
        s_New.push(k);
    }
    s_Old.forEach(function(p_Key) {
        assert.ok(s_New.indexOf(p_Key) >= 0, p_Key);
    });
    assert.equal(s_New.filter(function(p_Key) { return p_Key.charAt(0) === '_'; }).length, 0, 'no private keys');
});

// --- Unusual but plausible usage found in review: each case runs on both versions ---

function Outcome(p_Fn) {
    try {
        var s_Val = p_Fn();
        if (Buffer.isBuffer(s_Val)) {
            return { buffer: s_Val.toString('hex') };
        }
        return { value: typeof s_Val == 'bigint' ? String(s_Val) + 'n' : s_Val };
    } catch (e) {
        return { error: e.constructor.name, message: e.message };
    }
}

var UnusualCases = {
    'frozen writer ByteBuffer': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt32(1); w.WriteUInt32(2); Object.freeze(w);
        return w.ByteBuffer;
    },
    'frozen fresh writer ByteBuffer': function(m) {
        var w = new m.BinaryWriter(); Object.freeze(w);
        return w.ByteBuffer;
    },
    'frozen reader ByteBuffer after reads': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); r.ReadUInt8(); Object.freeze(r);
        return Buffer.concat([r.ByteBuffer, Buffer.from([r.ReadUInt8()])]);
    },
    'reader cloned with Object.assign reads on independently': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); r.ReadUInt8();
        var c = Object.assign(Object.create(Object.getPrototypeOf(r)), r);
        return [c.ReadUInt8(), c.ReadUInt8(), r.ReadUInt8(), c.Position, r.Position].join(',');
    },
    'reader cloned with spread + setPrototypeOf': function(m) {
        var r = new m.BinaryReader([1, 2, 3, 4], 'little');
        var c = Object.setPrototypeOf(Object.assign({}, r), Object.getPrototypeOf(r));
        return [c.ReadUInt16(), c.ReadString(1), c.ReadBytes(1).length, r.ReadUInt8(), c.Position].join(',');
    },
    'reader method borrowed onto a plain object': function(m) {
        var o = { ByteBuffer: Buffer.from([7, 8]), Endianness: 'big', Position: 0 };
        var s_Read = m.BinaryReader.prototype.ReadUInt8;
        return [s_Read.call(o), s_Read.call(o), s_Read.call(o), o.Position].join(',');
    },
    'reader fork with Object.create': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); var c = Object.create(r);
        var s_Before = c.ByteBuffer.length;
        return [s_Before, c.ReadUInt8(), r.ReadUInt8(), c.ReadUInt8(), c.ByteBuffer.length, r.ByteBuffer.length].join(',');
    },
    'reader fork sees its parent advance until it reads': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); var c = Object.create(r);
        r.ReadUInt8();
        var s_Seen = c.ByteBuffer;
        r.ReadUInt8();
        return Buffer.concat([s_Seen, c.ByteBuffer]);
    },
    'writer cloned with Object.assign keeps writing': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1);
        var c = Object.assign(Object.create(Object.getPrototypeOf(w)), w);
        c.WriteUInt8(2); w.WriteUInt8(3);
        return Buffer.concat([c.ByteBuffer, Buffer.from([c.Length]), w.ByteBuffer]);
    },
    'writer fork with Object.create': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1); var c = Object.create(w);
        c.WriteUInt8(2); w.WriteUInt8(3);
        return Buffer.concat([c.ByteBuffer, w.ByteBuffer]);
    },
    'writer fork sees parent bytes until it writes': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1); var c = Object.create(w);
        w.WriteUInt8(2);
        return c.ByteBuffer;
    },
    'writer method borrowed onto a plain object': function(m) {
        var o = { ByteBuffer: Buffer.alloc(0), Endianness: 'little', Length: 0 };
        m.BinaryWriter.prototype.WriteUInt16.call(o, 0x0102);
        m.BinaryWriter.prototype.WriteUInt8.call(o, 3);
        return Buffer.concat([o.ByteBuffer, Buffer.from([o.Length])]);
    },
    'writer method borrowed onto an empty object': function(m) {
        var o = {};
        m.BinaryWriter.prototype.WriteUInt8.call(o, 3);
        return o.ByteBuffer;
    },
    'ES5 mixin onto another prototype (state set by hand)': function(m) {
        var Packet = function(p_Buf) { this.ByteBuffer = p_Buf; this.Endianness = 'little'; this.Position = 0; this.Length = p_Buf.length; };
        Object.assign(Packet.prototype, m.BinaryReader.prototype);
        var p = new Packet(Buffer.from([1, 0, 2, 3]));
        return [p.ReadUInt16(), p.ReadUInt8(), p.ReadBytes(1).length, p.Position, p.ReadUInt8()].join(',');
    },
    'ES5 mixin onto another prototype (constructor borrowed)': function(m) {
        var Out = function() { m.BinaryWriter.call(this, 'little'); };
        Object.assign(Out.prototype, m.BinaryWriter.prototype);
        var o = new Out();
        o.WriteUInt16(258); o.WriteBytes([9]);
        return Buffer.concat([o.ByteBuffer, Buffer.from([o.Length])]);
    },
    'frozen reader clone re-reads like 0.3.0': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); r.ReadUInt8();
        var c = Object.freeze(Object.assign(Object.create(Object.getPrototypeOf(r)), r));
        return [c.ReadUInt8(), c.ReadUInt8(), r.ReadUInt8(), c.Position, c.ReadBytes(1).length].join(',');
    },
    'non-extensible reader clone keeps reading': function(m) {
        var r = new m.BinaryReader([1, 2, 3, 4], 'little');
        var c = Object.preventExtensions(Object.assign(Object.create(Object.getPrototypeOf(r)), r));
        return [c.ReadUInt8(), c.ReadUInt16(), c.ReadString(1), c.Position, c.ByteBuffer.length, c.ReadUInt8()].join(',');
    },
    'frozen writer clone ignores writes': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1);
        var c = Object.freeze(Object.assign(Object.create(Object.getPrototypeOf(w)), w));
        c.WriteUInt8(2);
        return Buffer.concat([c.ByteBuffer, Buffer.from([c.Length])]);
    },
    'non-extensible writer clone keeps writing': function(m) {
        var w = new m.BinaryWriter('little'); w.WriteUInt8(1);
        var c = Object.preventExtensions(Object.assign(Object.create(Object.getPrototypeOf(w)), w));
        c.WriteUInt16(0x0302); c.WriteBytes([4]); c.WriteString('A');
        return Buffer.concat([c.ByteBuffer, Buffer.from([c.Length]), w.ByteBuffer]);
    },
    'user-set Strict does not change behavior': function(m) {
        var r = new m.BinaryReader([1]); r.Strict = true;
        var w = new m.BinaryWriter(); w.Strict = true; w.WriteUInt8(1.5);
        return [r.ReadUInt32(), w.ByteBuffer.toString('hex'), Object.keys(r).join('|'), JSON.stringify(w)].join(',');
    },
    'string Position advances like 0.3.0': function(m) {
        var r = new m.BinaryReader([1, 2, 3, 4, 5, 6]); r.Position = '3';
        r.ReadUInt8(); r.ReadInt8(); r.ReadUInt16();
        return JSON.stringify(r.Position);
    },
    'extra constructor arguments are ignored': function(m) {
        var r = new m.BinaryReader([1, 2], 'big', 'ascii', 'x');
        var w = new m.BinaryWriter('big', 'ascii', true);
        var v = new m.BinaryWriter('big', 'ascii', { a: 1 });
        var x = new m.BinaryWriter('big', 'ascii', { strict: true });
        var y = new m.BinaryReader([1], 'big', 'ascii', { STRICT: true });
        w.WriteUInt8(1.5); v.WriteUInt8('2'); x.WriteUInt8(2.5);
        return [r.ReadUInt32(), w.ByteBuffer.toString('hex'), v.ByteBuffer.toString('hex'), x.ByteBuffer.toString('hex'), y.ReadUInt16()].join(',');
    },
    'frozen reader re-reads the same bytes': function(m) {
        var r = new m.BinaryReader([1, 2, 3, 4, 5, 6], 'little'); r.ReadUInt8(); Object.freeze(r);
        return [r.ReadUInt8(), r.ReadUInt16(), r.ReadInt8(), r.ReadString(2), r.ReadBytes(2).toString('hex'),
            r.Position, r.ByteBuffer.length, r.Length].join(',');
    },
    'frozen reader ignores ByteBuffer assignment': function(m) {
        var r = new m.BinaryReader([1, 2]); Object.freeze(r);
        r.ByteBuffer = Buffer.from([9]);
        return [r.ReadUInt8(), r.ByteBuffer.length].join(',');
    },
    'frozen writer ignores writes': function(m) {
        var w = new m.BinaryWriter('little'); w.WriteUInt8(1); w.WriteString('ab'); Object.freeze(w);
        w.WriteUInt16(0x0302); w.WriteString('cd'); w.WriteBytes([4, 5]); w.WriteBytes([]); w.WriteString('');
        return Buffer.concat([w.ByteBuffer, Buffer.from([w.Length])]);
    },
    'frozen writer keeps the same ByteBuffer object': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1); var s_Before = w.ByteBuffer; Object.freeze(w);
        s_Before[0] = 7; w.WriteUInt8(2); w.WriteBytes([]);
        return [w.ByteBuffer === s_Before, w.ByteBuffer.toString('hex'), w.Length].join(',');
    },
    'frozen writer after Length was changed by hand': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1); w.Length = 3; Object.freeze(w);
        w.WriteUInt8(2);
        return Buffer.concat([w.ByteBuffer, Buffer.from([w.Length])]);
    },
    'frozen writer still throws for bad values': function(m) {
        var w = new m.BinaryWriter(); Object.freeze(w);
        w.WriteUInt8(256);
    },
    'frozen reader fork re-reads its parent bytes': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); var c = Object.freeze(Object.create(r));
        return [c.ReadUInt8(), c.ReadUInt8(), r.ReadUInt8(), c.ReadUInt8(), c.Position, r.Position].join(',');
    },
    'frozen writer fork ignores writes': function(m) {
        var w = new m.BinaryWriter(); w.WriteUInt8(1); var c = Object.freeze(Object.create(w));
        c.WriteUInt8(2); w.WriteUInt8(3);
        return Buffer.concat([c.ByteBuffer, Buffer.from([c.Length]), w.ByteBuffer]);
    },
    'reader method borrowed onto a frozen plain object': function(m) {
        var o = Object.freeze({ ByteBuffer: Buffer.from([7, 8, 9]), Endianness: 'big', Position: 0 });
        var s_Proto = m.BinaryReader.prototype;
        return [s_Proto.ReadUInt8.call(o), s_Proto.ReadUInt16.call(o), s_Proto.ReadBytes.call(o, 1).toString('hex'), o.Position].join(',');
    },
    'writer method borrowed onto a frozen plain object': function(m) {
        var o = Object.freeze({ ByteBuffer: Buffer.from([1]), Endianness: 'big', Length: 1 });
        m.BinaryWriter.prototype.WriteUInt16.call(o, 0x0203);
        return Buffer.concat([o.ByteBuffer, Buffer.from([o.Length])]);
    },
    'reading Strict on a fork does not disturb reading': function(m) {
        var r = new m.BinaryReader([1, 2, 3]); var c = Object.create(r);
        var w = new m.BinaryWriter(); w.WriteUInt8(1); var d = Object.create(w);
        void c.Strict; void d.Strict;
        d.WriteUInt8(2);
        return [c.ReadUInt8(), c.ReadUInt16(), r.ReadUInt8(), d.ByteBuffer.toString('hex'), w.ByteBuffer.toString('hex')].join(',');
    },
    'util.inspect output': function(m) {
        var util = require('util');
        var r = new m.BinaryReader([1, 2]); r.ReadUInt8();
        var w = new m.BinaryWriter('little'); w.WriteUInt16(5);
        return util.inspect(r) + ' ' + util.inspect(w);
    }
};

Object.keys(UnusualCases).forEach(function(p_Name) {
    test('unusual usage matches 0.3.0: ' + p_Name, function() {
        assert.deepEqual(Outcome(function() { return UnusualCases[p_Name](Current); }),
            Outcome(function() { return UnusualCases[p_Name](Legacy); }));
    });
});
