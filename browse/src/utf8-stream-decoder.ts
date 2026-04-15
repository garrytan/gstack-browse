/**
 * UTF-8 stream decoder for child-process stdout/stderr.
 *
 * Per-chunk `Buffer.toString('utf8')` corrupts multi-byte characters
 * (Korean, Japanese, Chinese, emoji, etc.) when a code-point straddles a
 * chunk boundary — the partial bytes decode to U+FFFD and the next chunk
 * starts mid-sequence. StringDecoder buffers partial code units across
 * chunks so decoded strings round-trip the original bytes.
 *
 * Pure ASCII streams are unaffected: every byte is a complete code point.
 */

import { StringDecoder } from 'string_decoder';

export function createUtf8StreamDecoder(): {
  write(chunk: Buffer): string;
  end(): string;
} {
  const decoder = new StringDecoder('utf8');
  return {
    write: (chunk) => decoder.write(chunk),
    end: () => decoder.end(),
  };
}
