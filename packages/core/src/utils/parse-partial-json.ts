/**
 * Best-effort partial JSON parser for streaming LLM output.
 *
 * Strategy: strip any markdown fence + leading prose, scan the remaining text
 * to compute the open-string / brace / bracket state, then construct a closing
 * suffix and attempt `JSON.parse`. If that fails (typically because the buffer
 * ended mid-key or after a trailing colon), back off by truncating the last
 * unfinished token and retry up to a few times.
 *
 * Returns:
 *   - `{ parsed, isComplete: true }` — the original buffer parsed as-is.
 *   - `{ parsed, isComplete: false }` — fixups were needed; `parsed` is a
 *     plausible interpretation of the buffer's prefix.
 *   - `null` — could not coerce the buffer into valid JSON.
 */

export type PartialParseResult = { parsed: unknown; isComplete: boolean } | null;

const stripFenceAndPrefix = (text: string): string => {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) return fence[1].trim();
  // Drop any prose before the first `{`.
  const start = trimmed.indexOf("{");
  return start === -1 ? trimmed : trimmed.slice(start);
};

type Scan = {
  inString: boolean;
  stack: ("{" | "[")[];
  lastSignificantIdx: number;
  lastSignificantChar: string;
};

const scan = (s: string): Scan => {
  let inString = false;
  let escape = false;
  const stack: ("{" | "[")[] = [];
  let lastSignificantIdx = -1;
  let lastSignificantChar = "";

  for (let i = 0; i < s.length; i++) {
    const c = s[i] as string;
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      lastSignificantIdx = i;
      lastSignificantChar = c;
      continue;
    }
    if (inString) continue;
    if (c === " " || c === "\n" || c === "\t" || c === "\r") continue;
    lastSignificantIdx = i;
    lastSignificantChar = c;
    if (c === "{" || c === "[") stack.push(c as "{" | "[");
    else if (c === "}" || c === "]") stack.pop();
  }

  return { inString, stack, lastSignificantIdx, lastSignificantChar };
};

const buildClosed = (buf: string): string | null => {
  const s = scan(buf);
  let body = buf;
  if (s.inString) body += '"';

  // Strip trailing whitespace outside strings.
  body = body.replace(/\s+$/, "");

  // Trailing comma — drop it.
  if (body.endsWith(",")) {
    body = body.slice(0, -1).replace(/\s+$/, "");
  }

  // Trailing colon means an incomplete value — caller should back-off instead.
  if (body.endsWith(":")) return null;

  const closers = s.stack
    .slice()
    .reverse()
    .map((b) => (b === "{" ? "}" : "]"))
    .join("");
  return body + closers;
};

/** Truncate `buf` at the last `,`, `{`, or `[` outside any string. */
const backOff = (buf: string): string | null => {
  let inString = false;
  let escape = false;
  let lastComma = -1;
  let lastOpen = -1;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i] as string;
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === ",") lastComma = i;
    else if (c === "{" || c === "[") lastOpen = i;
  }
  // Prefer cutting at the last comma — preserves more structure.
  if (lastComma >= 0 && lastComma > lastOpen) {
    return buf.slice(0, lastComma);
  }
  // Otherwise cut right after the last opener so we keep an empty container.
  if (lastOpen >= 0) {
    return buf.slice(0, lastOpen + 1);
  }
  return null;
};

const stripControlChars = (s: string): string =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: matches extract-json behavior
  s.replace(/[\x00-\x09\x0B-\x0C\x0E-\x1F]/g, "");

export const parsePartialJson = (raw: string): PartialParseResult => {
  const stripped = stripFenceAndPrefix(raw);
  if (!stripped || !stripped.startsWith("{")) return null;

  // Fast path: already valid.
  try {
    return { parsed: JSON.parse(stripControlChars(stripped)), isComplete: true };
  } catch {
    // fall through
  }

  let candidate: string | null = stripped;
  // 4 attempts is plenty for the typical "key: <missing value>" tail.
  for (let attempt = 0; attempt < 4 && candidate; attempt++) {
    const closed = buildClosed(candidate);
    if (closed) {
      try {
        return { parsed: JSON.parse(stripControlChars(closed)), isComplete: false };
      } catch {
        // fall through to back-off
      }
    }
    candidate = backOff(candidate);
  }

  return null;
};
