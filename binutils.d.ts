/// <reference types="node" />

export = binutils;

declare namespace binutils {
    type Endianness = 'big' | 'little';

    interface BinaryReaderOptions {
        /**
         * When `true`, short reads, invalid counts, a missing C-string terminator and
         * truncated or overlong varints throw (a non-number count throws `TypeError`,
         * everything else `RangeError`) instead of returning a zero value, assigning a
         * non-buffer to `ByteBuffer` throws `TypeError`, and the constructor validates
         * its arguments. `ReadRemaining` never
         * throws. Strict mode only adds errors; it never changes a result.
         * Defaults to `false` (0.3 behavior).
         */
        Strict?: boolean;
    }

    interface BinaryWriterOptions {
        /**
         * When `true`, writers throw `TypeError` for non-integers/non-numbers and
         * `RangeError` for out-of-range values, unsafe 64-bit `number`s, non-byte array
         * elements and characters the encoding cannot represent; `WriteBoolean` takes
         * only booleans and `ByteBuffer` only buffers; the constructor validates its
         * arguments. Strict mode only adds errors; it never changes a
         * result. Defaults to `false` (0.3 behavior: values are coerced by Node).
         */
        Strict?: boolean;
    }

    class BinaryReader {
        /**
         * Keeps a private copy of the input and consumes it from the front as you read.
         * `Buffer` and `Uint8Array` inputs are copied. A string input is encoded with
         * `encoding`, or UTF-8 when `encoding` is omitted.
         * Throws if `input` is not a `Buffer`, `Uint8Array`, array or string, or if
         * `options` turns strict mode on and has another key. Any other `options` value
         * (including `{ strict: true }`) is ignored. With `{ Strict: true }` it also
         * throws on non-byte array elements, non-ASCII strings without `encoding`, and
         * an invalid `endianness`/`encoding`. Can also be called without `new`.
         */
        constructor(
            input: Buffer | Uint8Array | ReadonlyArray<number> | string,
            endianness?: Endianness,
            encoding?: BufferEncoding,
            options?: BinaryReaderOptions
        );

        /**
         * The remaining unread bytes: a live view of the reader's private copy. Shrinks
         * as you read. Assigning a `Buffer` replaces the unread data as is (no copy);
         * `Position` and `Length` are not changed. Strict mode throws `TypeError` when
         * anything but a `Buffer`/`Uint8Array` is assigned.
         */
        ByteBuffer: Buffer;
        /** Byte order used by all multi-byte reads. */
        Endianness: Endianness;
        /** Encoding used by `ReadString`/`ReadCString`. */
        Encoding: BufferEncoding;
        /** Whether strict mode is on (see `BinaryReaderOptions.Strict`); a fork made with `Object.create` inherits it. Assigning it never changes the mode. */
        readonly Strict: boolean;
        /** Length of the original input in bytes. Never changes as you read. */
        Length: number;
        /** Number of bytes consumed so far. Assigning it does not seek. */
        Position: number;

        /** Reads 1 byte. Returns 0 (without advancing) if no bytes remain. */
        ReadUInt8(): number;
        /** Reads 2 bytes. Returns 0 (without advancing) if fewer than 2 bytes remain. */
        ReadUInt16(): number;
        /** Reads 4 bytes. Returns 0 (without advancing) if fewer than 4 bytes remain. */
        ReadUInt32(): number;
        /** Reads 8 bytes as an unsigned BigInt. Returns the number 0 (without advancing) if fewer than 8 bytes remain. */
        ReadUInt64(): bigint | 0;
        /** Reads 1 byte, signed. Returns 0 (without advancing) if no bytes remain. */
        ReadInt8(): number;
        /** Reads 2 bytes, signed. Returns 0 (without advancing) if fewer than 2 bytes remain. */
        ReadInt16(): number;
        /** Reads 4 bytes, signed. Returns 0 (without advancing) if fewer than 4 bytes remain. */
        ReadInt32(): number;
        /** Reads 8 bytes as a signed BigInt. Returns the number 0 (without advancing) if fewer than 8 bytes remain. */
        ReadInt64(): bigint | 0;
        /** Reads 4 bytes as an IEEE-754 single. Returns 0 (without advancing) if fewer than 4 bytes remain. */
        ReadFloat(): number;
        /** Reads 8 bytes as an IEEE-754 double. Returns 0 (without advancing) if fewer than 8 bytes remain. */
        ReadDouble(): number;
        /** Reads 1 byte; any non-zero byte is `true`. Returns `false` (without advancing) if no bytes remain. */
        ReadBoolean(): boolean;
        /**
         * Copies `count` bytes into a new Buffer. Returns an empty Buffer (without
         * advancing) if fewer than `count` bytes remain. As in 0.3, a fractional `count`
         * is rounded down and a negative, `NaN` or non-number `count` throws Node's error.
         * Strict mode throws `TypeError` for a non-number `count` and `RangeError` for an
         * invalid or too large one.
         */
        ReadBytes(count: number): Buffer;
        /** Decodes `count` bytes as a string using the instance's `Encoding`. Returns an empty string (without advancing) if fewer than `count` bytes remain or `count` is 0 or less. As in 0.3, a non-number `count` is coerced (`ReadString()` returns everything left without consuming it). Strict mode validates `count` like `ReadBytes`. */
        ReadString(count: number): string;
        /** Reads up to the next `0x00` byte, consumes the terminator, and decodes the bytes before it. Returns an empty string (without advancing) if there is no terminator. */
        ReadCString(): string;
        /** Returns a copy of all remaining bytes and consumes them. Returns an empty Buffer when nothing remains. Never throws. */
        ReadRemaining(): Buffer;
        /** Advances `count` bytes without returning them. A fractional `count` is rounded down; does nothing if fewer than `count` bytes remain or `count` is negative, `NaN` or not a number. Strict mode validates `count` like `ReadBytes`. */
        Skip(count: number): void;

        /** Reads an unsigned LEB128 varint (up to 5 bytes). Returns 0 (without advancing) if truncated or overlong. */
        ReadVarUInt32(): number;
        /** Reads a ZigZag-encoded signed LEB128 varint (up to 5 bytes). Returns 0 (without advancing) if truncated or overlong. */
        ReadVarInt32(): number;
        /** Reads an unsigned LEB128 varint (up to 10 bytes) as a BigInt. Returns the number 0 (without advancing) if truncated or overlong. */
        ReadVarUInt64(): bigint | 0;
        /** Reads a ZigZag-encoded signed LEB128 varint (up to 10 bytes) as a BigInt. Returns the number 0 (without advancing) if truncated or overlong. */
        ReadVarInt64(): bigint | 0;

        /** Like `ReadUInt8`, but does not consume. */
        PeekUInt8(): number;
        /** Like `ReadUInt16`, but does not consume. */
        PeekUInt16(): number;
        /** Like `ReadUInt32`, but does not consume. */
        PeekUInt32(): number;
        /** Like `ReadUInt64`, but does not consume. */
        PeekUInt64(): bigint | 0;
        /** Like `ReadInt8`, but does not consume. */
        PeekInt8(): number;
        /** Like `ReadInt16`, but does not consume. */
        PeekInt16(): number;
        /** Like `ReadInt32`, but does not consume. */
        PeekInt32(): number;
        /** Like `ReadInt64`, but does not consume. */
        PeekInt64(): bigint | 0;
        /** Like `ReadFloat`, but does not consume. */
        PeekFloat(): number;
        /** Like `ReadDouble`, but does not consume. */
        PeekDouble(): number;
        /** Like `ReadBoolean`, but does not consume. */
        PeekBoolean(): boolean;
        /** Like `ReadBytes`, but does not consume, and returns an empty Buffer (instead of throwing) for a negative, `NaN` or non-number `count`. Returns a copy. */
        PeekBytes(count: number): Buffer;
    }

    class BinaryWriter {
        /**
         * Accumulates bytes; every write is amortized O(1) (reading `ByteBuffer` after every write costs O(n) per read, as in 0.3).
         * Throws if `options` turns strict mode on and has another key; any other `options` value is ignored. With `{ Strict: true }`
         * it also throws on an invalid `endianness`/`encoding`. Can also be called
         * without `new`.
         */
        constructor(endianness?: Endianness, encoding?: BufferEncoding, options?: BinaryWriterOptions);

        /**
         * All bytes written so far, in a Buffer with its own exactly-sized memory. The
         * same object is returned until the next write, and changes made to it before
         * then are kept. Assigning a `Buffer` replaces the contents as is but does not
         * update `Length`; the next write pads or truncates to `Length`, as in 0.3.
         * Strict mode throws `TypeError` when anything but a `Buffer`/`Uint8Array` is assigned.
         */
        ByteBuffer: Buffer;
        /** Byte order used by all multi-byte writes. */
        Endianness: Endianness;
        /** Encoding used by `WriteString` and `WriteCString`. */
        Encoding: BufferEncoding;
        /** Whether strict mode is on (see `BinaryWriterOptions.Strict`); a fork made with `Object.create` inherits it. Assigning it never changes the mode. */
        readonly Strict: boolean;
        /** The number of bytes written so far. */
        Length: number;

        /** Throws `RangeError` outside 0..255. Strict mode also throws `TypeError` on a non-integer. */
        WriteUInt8(value: number): void;
        /** Throws `RangeError` outside 0..65535. Strict mode also throws `TypeError` on a non-integer. */
        WriteUInt16(value: number): void;
        /** Throws `RangeError` outside 0..2^32-1. Strict mode also throws `TypeError` on a non-integer. */
        WriteUInt32(value: number): void;
        /** Accepts an integer number or BigInt; throws `RangeError` outside 0..2^64-1. Strict mode also rejects a number outside the safe-integer range. */
        WriteUInt64(value: number | bigint): void;
        /** Throws `RangeError` outside -128..127. Strict mode also throws `TypeError` on a non-integer. */
        WriteInt8(value: number): void;
        /** Throws `RangeError` outside -32768..32767. Strict mode also throws `TypeError` on a non-integer. */
        WriteInt16(value: number): void;
        /** Throws `RangeError` outside -2^31..2^31-1. Strict mode also throws `TypeError` on a non-integer. */
        WriteInt32(value: number): void;
        /** Accepts an integer number or BigInt; throws `RangeError` outside -2^63..2^63-1. Strict mode also rejects a number outside the safe-integer range. */
        WriteInt64(value: number | bigint): void;
        /** Writes an IEEE-754 single. Strict mode throws `TypeError` on a non-number. */
        WriteFloat(value: number): void;
        /** Writes an IEEE-754 double. Strict mode throws `TypeError` on a non-number. */
        WriteDouble(value: number): void;
        /** Writes `0x01` for a truthy value, `0x00` otherwise. Strict mode throws `TypeError` for a non-boolean. */
        WriteBoolean(value: unknown): void;
        /**
         * Appends a copy of the bytes. Strings are written one byte per character code
         * (latin1). Throws on any other input type. Strict mode also throws `RangeError`
         * for characters above U+00FF and array elements outside 0..255.
         */
        WriteBytes(value: Buffer | Uint8Array | ReadonlyArray<number> | string): void;
        /** Encodes the string using the instance's `Encoding`. Throws on any other input type. Strict mode also throws `RangeError` for characters `ascii`/`latin1` (`binary`) cannot represent. */
        WriteString(value: string): void;
        /** Encodes the string using the instance's `Encoding` and appends a `0x00` terminator in a single write. Throws `TypeError` on non-strings, and `RangeError` if the encoded bytes contain `0x00` (e.g. a `\0` character, or `utf16le` text). Strict mode checks characters like `WriteString`. */
        WriteCString(value: string): void;

        /** Writes an unsigned LEB128 varint. Throws `TypeError` on a non-integer and `RangeError` outside 0..2^32-1. */
        WriteVarUInt32(value: number): void;
        /** Writes a ZigZag-encoded signed LEB128 varint. Throws `TypeError` on a non-integer and `RangeError` outside -2^31..2^31-1. */
        WriteVarInt32(value: number): void;
        /** Writes an unsigned LEB128 varint. Throws `TypeError` on a non-integer and `RangeError` outside 0..2^64-1. Strict mode also rejects a number outside the safe-integer range. */
        WriteVarUInt64(value: number | bigint): void;
        /** Writes a ZigZag-encoded signed LEB128 varint. Throws `TypeError` on a non-integer and `RangeError` outside -2^63..2^63-1. Strict mode also rejects a number outside the safe-integer range. */
        WriteVarInt64(value: number | bigint): void;
    }
}
