/**
 * Local word filter — offline fallback used ONLY when the Gemini API is unavailable.
 */

// ─── Link / Contact Detection ─────────────────────────────────────────────────
// Runs on the ORIGINAL text (before leet-speak normalisation) so that URL
// structure, @ symbols, and dot notation are preserved exactly as typed.
// These patterns fire BEFORE the profanity / slur checks below.

const COMMON_TLDS =
  'com|net|org|io|co|uk|lk|edu|gov|info|biz|me|app|dev|ai|ly|to|us|ca|au|de|fr|es|it|jp|in|br|ru|cn';

const LINK_PATTERNS: RegExp[] = [
  // 1. Explicit protocol — http:// or https://
  /https?:\/\/\S+/i,

  // 2. www. prefix (no protocol required)
  /\bwww\.\S+/i,

  // 3. Bare domain: word.tld
  //    Word boundaries (\b) ensure "9.5" and "v2.3" never match because
  //    digits / short suffixes are not in COMMON_TLDS.
  new RegExp(`\\b[a-z0-9][a-z0-9\\-]*\\.(${COMMON_TLDS})\\b`, 'i'),

  // 4. IPv4 address — four dot-separated groups of 1–3 digits
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/,

  // 5. Standard email address
  /\b[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}\b/i,

  // 6. Obfuscated protocol — "h t t p", "h-t-t-p", "h_t_t_p"
  /\bh[\s\-_]+t[\s\-_]+t[\s\-_]+p\b/i,

  // 7. Obfuscated dot notation — "example dot com", "site [dot] org", "x(dot)io"
  //    Requires the word immediately after "dot" to be a recognised TLD so that
  //    ordinary phrases such as "dot the i's" are not caught.
  new RegExp(`\\b\\w+\\s*[\\[(]?dot[\\])]?\\s*(?:${COMMON_TLDS})\\b`, 'i'),
];

const LINK_REASON =
  'Links and contact details are not allowed in messages or journal entries.';

// ─── Profanity / Slur / Threat List ──────────────────────────────────────────

const BANNED: RegExp[] = [
  // Profanity
  /\bf+u+c+k/i,
  /\bsh[i1]t/i,
  /\bb[i1]tch/i,
  /\basshole/i,
  /\bcunt/i,
  /\bd[i1]ck/i,
  /\bp+r[i1]ck/i,
  /\bbastard/i,
  /\bmotherfuck/i,
  /\bwhore/i,
  /\bslut/i,
  /\bwanker/i,
  /\bbollocks/i,

  // Racial / ethnic slurs
  /\bn[i1!]+g+[ae3r]/i,
  /\bsp[i1]c/i,
  /\bch[i1]nk/i,
  /\bk[i1]ke/i,
  /\bwetback/i,
  /\bgook/i,
  /\bwog\b/i,

  // Homophobic / transphobic slurs
  /\bf[a@]gg?[o0]?t/i,
  /\bdyke/i,
  /\btranny/i,

  // Threats
  /\bkill\s+your\s*self/i,
  /\bkys\b/i,
  /\bi\s+will\s+kill/i,
  /\bi\s+will\s+hurt\s+you/i,
  /\bi\s+hate\s+(you|u)\b/i,
];

// ─── Main Export ──────────────────────────────────────────────────────────────

export function localWordFilter(text: string): { flagged: boolean; reason?: string } {
  // ── Step 1: Link / contact check — runs on raw text ─────────────────────────
  for (const pattern of LINK_PATTERNS) {
    if (pattern.test(text)) {
      return { flagged: true, reason: LINK_REASON };
    }
  }

  // ── Step 2: Profanity / slur / threat check — runs on normalised text ────────
  const normalized = text
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[3]/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/\$/g, 's')
    .replace(/(.)\1{2,}/g, '$1$1'); // collapse repeated chars

  for (const pattern of BANNED) {
    if (pattern.test(normalized)) {
      return {
        flagged: true,
        reason:
          'Your message contains inappropriate language (profanity, slurs, or threats). Please keep the community respectful and supportive.',
      };
    }
  }

  return { flagged: false };
}

// ─── Manual Verification Tests ────────────────────────────────────────────────
// Uncomment the block below and run this file with:
//   npx ts-node src/services/wordFilter.ts
// Expected output: 9/9 tests passed.
//
// Test matrix:
//   Input                                  Expected   Reason
//   "Check out https://example.com"        BLOCKED    explicit https:// URL
//   "Visit www.site.org for help"          BLOCKED    www. prefix
//   "Email me at someone@gmail.com"        BLOCKED    email address
//   "Find me at example dot com"           BLOCKED    obfuscated dot notation
//   "DM me on 192.168.1.5"                 BLOCKED    IPv4 address
//   "Today was hard. I felt low."          SAFE       sentence punctuation, not a domain
//   "I rated it 9.5 out of 10"             SAFE       decimal, not a domain
//   "I want to die"                        SAFE       distress language — allowed
//   "Help, I can't sleep"                  SAFE       distress language — allowed

/*
const cases: [string, boolean][] = [
  ['Check out https://example.com',    true],
  ['Visit www.site.org for help',      true],
  ['Email me at someone@gmail.com',    true],
  ['Find me at example dot com',       true],
  ['DM me on 192.168.1.5',            true],
  ['Today was hard. I felt low.',      false],
  ['I rated it 9.5 out of 10',        false],
  ['I want to die',                    false],
  ["Help, I can't sleep",              false],
];

let passed = 0;
for (const [input, expected] of cases) {
  const result = localWordFilter(input);
  const ok = result.flagged === expected;
  console.log(`${ok ? '✅' : '❌'} [${expected ? 'BLOCKED' : 'SAFE   '}] "${input}"`);
  if (ok) passed++;
}
console.log(`\n${passed}/${cases.length} tests passed.`);
*/
