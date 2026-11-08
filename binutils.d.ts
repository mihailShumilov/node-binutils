/// <reference types="node" />

export = binutils;

declare namespace binutils {
    type Endianness = 'big' | 'little';

    interface BinaryReaderOptions {
        /**
         * When `true`, reads that do not have enough bytes (or get an invalid count)
         * throw a `RangeError` instead of returning a zero value. Defaults to `false`.
         */
        Strict?: boolean;
    }

    class BinaryReader {
        /**
         * Wraps a copy of the input data and consumes it from the front as you read.
         * `Buffer` and `Uint8Array` inputs are copied, so the source is never mutated.
         * Array elements must be integers from 0 to 255. A string input is encoded with
         * `encoding` (default `'ascii'`).
         * Throws if `input` is not a `Buffer`, `Uint8Array`, byte array or string, or if
         * `endianness`/`encoding` is invalid. Can also be called without `new`.
         */
        constructor(
            input: Buffer | Uint8Array | ReadonlyArray<number> | string,
            endianness?: Endianness,
            encoding?: BufferEncoding,
            options?: BinaryReaderOptions
        );

        /**
         * The remaining unread bytes (a view, not a copy). Shrinks as you read.
         * Assigning a `Buffer` replaces the unread data; `Position` and `Length` are not changed.
         */
        ByteBuffer: Buffer;
        /** Byte order used by all multi-byte reads. */
        Endianness: Endianness;
        /** Encoding used to turn a string input into bytes and to decode `ReadString`/`ReadCString`. */
        Encoding: BufferEncoding;
        /** Whether short reads throw (see `BinaryReaderOptions.Strict`). */
        Strict: boolean;
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
        /** Copies `count` bytes into a new Buffer. Returns an empty Buffer (without advancing) if fewer than `count` bytes remain or `count` is not a non-negative integer. */
        ReadBytes(count: number): Buffer;
        /** Decodes `count` bytes as a string using the instance's `Encoding`. Returns an empty string (without advancing) if fewer than `count` bytes remain or `count` is not a non-negative integer. */
        ReadString(count: number): string;
        /** Reads up to the next `0x00` byte, consumes the terminator, and decodes the bytes before it. Returns an empty string (without advancing) if there is no terminator. */
        ReadCString(): string;
        /** Returns a copy of all remaining bytes and consumes them. Returns an empty Buffer when nothing remains. */
        ReadRemaining(): Buffer;
        /** Advances `count` bytes without returning them. Does nothing if fewer than `count` bytes remain or `count` is invalid. */
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
        /** Like `ReadBytes`, but does not consume. Returns a copy. */
        PeekBytes(count: number): Buffer;
    }

    class BinaryWriter {
        /**
         * Accumulates bytes; every write is amortized O(1).
         * Throws if `endianness`/`encoding` is invalid. Can also be called without `new`.
         */
        constructor(endianness?: Endianness, encoding?: BufferEncoding);

        /**
         * All bytes written so far. Assigning a `Buffer` replaces the contents and
         * sets `Length` to its length.
         */
        ByteBuffer: Buffer;
        /** Byte order used by all multi-byte writes. */
        Endianness: Endianness;
        /** Encoding used by `WriteString` and `WriteCString`. */
        Encoding: BufferEncoding;
        /** The number of bytes written so far. */
        Length: number;

        /** Throws `TypeError` on a non-integer and `RangeError` outside 0..255. */
        WriteUInt8(value: number): void;
        /** Throws `TypeError` on a non-integer and `RangeError` outside 0..65535. */
        WriteUInt16(value: number): void;
        /** Throws `TypeError` on a non-integer and `RangeError` outside 0..2^32-1. */
        WriteUInt32(value: number): void;
        /** Accepts an integer number or BigInt; throws `RangeError` outside 0..2^64-1. */
        WriteUInt64(value: number | bigint): void;
        /** Throws `TypeError` on a non-integer and `RangeError` outside -128..127. */
        WriteInt8(value: number): void;
        /** Throws `TypeError` on a non-integer and `RangeError` outside -32768..32767. */
        WriteInt16(value: number): void;
        /** Throws `TypeError` on a non-integer and `RangeError` outside -2^31..2^31-1. */
        WriteInt32(value: number): void;
        /** Accepts an integer number or BigInt; throws `RangeError` outside -2^63..2^63-1. */
        WriteInt64(value: number | bigint): void;
        /** Throws `TypeError` on a non-number. */
        WriteFloat(value: number): void;
        /** Throws `TypeError` on a non-number. */
        WriteDouble(value: number): void;
        /** Writes `0x01` for a truthy value, `0x00` otherwise. */
        WriteBoolean(value: unknown): void;
        /**
         * Appends a copy of the bytes. Strings are written one byte per character code
         * (latin1) and throw `RangeError` on characters above U+00FF. Array elements must
         * be integers from 0 to 255. Throws on any other input type.
         */
        WriteBytes(value: Buffer | Uint8Array | ReadonlyArray<number> | string): void;
        /** Encodes the string using the instance's `Encoding`. Throws on any other input type. */
        WriteString(value: string): void;
        /** Encodes the string using the instance's `Encoding` and appends a `0x00` terminator. Throws on non-strings, and `RangeError` if the encoded bytes contain `0x00` (e.g. a `\0` character, or `utf16le` text). */
        WriteCString(value: string): void;

        /** Writes an unsigned LEB128 varint. Throws `RangeError` outside 0..2^32-1. */
        WriteVarUInt32(value: number): void;
        /** Writes a ZigZag-encoded signed LEB128 varint. Throws `RangeError` outside -2^31..2^31-1. */
        WriteVarInt32(value: number): void;
        /** Writes an unsigned LEB128 varint. Throws `RangeError` outside 0..2^64-1. */
        WriteVarUInt64(value: number | bigint): void;
        /** Writes a ZigZag-encoded signed LEB128 varint. Throws `RangeError` outside -2^63..2^63-1. */
        WriteVarInt64(value: number | bigint): void;
    }
}
