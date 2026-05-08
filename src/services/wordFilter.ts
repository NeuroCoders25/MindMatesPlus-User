/**
 * Local word filter — offline fallback used ONLY when the Gemini API is unavailable.
 */

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

export function localWordFilter(text: string): { flagged: boolean; reason?: string } {
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
        reason: 'Your message contains inappropriate language (profanity, slurs, or threats). Please keep the community respectful and supportive.',
      };
    }
  }
  return { flagged: false };
}
