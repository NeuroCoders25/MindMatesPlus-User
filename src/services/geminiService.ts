import Groq from 'groq-sdk';
import { Dass21Result } from '../types';
import { localWordFilter } from './wordFilter';

// ─── Client ──────────────────────────────────────────────────────────────────

let groqClient: Groq | null = null;
let cachedKey = '';

const getClient = (): Groq | null => {
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
  if (!key) return null;
  if (!groqClient || key !== cachedKey) {
    groqClient = new Groq({ apiKey: key, dangerouslyAllowBrowser: true });
    cachedKey = key;
  }
  return groqClient;
};

// ─── System prompts ───────────────────────────────────────────────────────────

const SUPPORT_SYSTEM = (result: Dass21Result) => `
You are Mindy, a warm and supportive AI mental health companion inside the MindMates+ app.
The user has just completed the DASS-21 mental health assessment. Their results are:
  - Depression score: ${result.depression.final} (${result.depression.severity})
  - Anxiety score:    ${result.anxiety.final} (${result.anxiety.severity})
  - Stress score:     ${result.stress.final} (${result.stress.severity})
  - Overall risk level: ${result.riskLevel}

Rules you MUST follow:
1. NEVER diagnose or replace professional medical advice.
2. Keep every reply to 2–4 short sentences. Be warm, calm, and clear.
3. If risk level is severe, ALWAYS include a reminder to contact a professional or crisis line.
4. Suggest simple, concrete coping actions (breathing, walking, journaling, reaching out).
5. Never dismiss or minimise what the user shares.
6. If the user seems in immediate danger, tell them to call emergency services or a crisis hotline.
`.trim();

const DOUBT_SYSTEM = (questionText: string, subscale: 'depression' | 'anxiety' | 'stress', questionNum: number) => `
You are Mindy, helping a user understand a specific DASS-21 questionnaire item so they can answer it honestly.

Current question (Q${questionNum}): "${questionText}"
Subscale: ${subscale}

The answer scale is:
  0 = Did not apply to me at all (never / almost never this week)
  1 = Applied to some degree or some of the time
  2 = Applied to a considerable degree or a good part of the time
  3 = Applied very much or most of the time

Rules you MUST follow:
1. Explain clearly what the question is asking in simple, everyday language.
2. Help the user decide which score fits by giving one practical example for each option.
3. Remind the user to think only about the PAST WEEK.
4. Keep the reply under 120 words. Be warm and non-judgmental.
5. Never suggest a specific score — only help clarify the meaning.
`.trim();

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * Send a user message to the post-assessment support chat.
 * Returns null when the API key is missing or the call fails,
 * so the caller can fall back to the rule-based response.
 */
export const sendSupportMessage = async (
  userText: string,
  dass21Result: Dass21Result,
): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SUPPORT_SYSTEM(dass21Result) },
        { role: 'user',   content: userText },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
};

// ─── Content Moderation ───────────────────────────────────────────────────────

const MODERATION_PROMPT = `
You are a strict content safety classifier for a mental health support app used by vulnerable individuals.

Analyse the user-submitted text and flag it as UNSAFE if it contains ANY of the following:

HATE SPEECH & SLURS
- Racial, ethnic, religious, or national slurs
- Homophobic or transphobic slurs
- Gender-based hate or misogynistic language
- Dehumanising language targeting any group

PROFANITY & BAD LANGUAGE
- Strong profanity (f-word, s-word, c-word, b-word, etc.)
- Sexually explicit words or graphic sexual language
- Crude insults intended to demean or shock

THREATS & HARASSMENT
- Direct threats of violence toward any person or group
- Doxxing, blackmail, or intimidation
- Bullying, targeted humiliation, or coordinated harassment

HARMFUL CONTENT
- Content that glorifies, encourages, or gives instructions for self-harm or suicide
- Content promoting or glorifying violence, terrorism, or extremism
- Graphic descriptions of abuse or torture

IMPORTANT CONTEXT: This is a mental health app. Expressions of personal distress (e.g. "I feel like hurting myself", "I want to die", "I feel hopeless") are NOT unsafe — they are cries for help and must be allowed through so users can receive support.

Respond ONLY with a valid JSON object (no markdown, no extra text):
{"safe": true} if the content is acceptable, or
{"safe": false, "reason": "<one clear sentence explaining what was found>"}
`.trim();

export interface ModerationResult {
  safe: boolean;
  reason?: string;
  /** Which layer blocked the content: 'gemini' | 'local' | undefined (when safe) */
  blockedBy?: 'gemini' | 'local';
}

/**
 * Checks whether the given text is safe to post/save.
 * Primary:  Gemini API (deep semantic analysis).
 * Fallback: localWordFilter (offline, runs only when Gemini is unavailable).
 */
export const moderateContent = async (text: string): Promise<ModerationResult> => {
  if (!text.trim()) return { safe: true };

  // ── Primary: Groq API ────────────────────────────────────────────────────
  const client = getClient();
  if (client) {
    try {
      const completion = await client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a strict content safety classifier. Respond ONLY with valid JSON.' },
          { role: 'user',   content: `${MODERATION_PROMPT}\n\nUser text:\n"""${text.trim()}"""` },
        ],
        max_tokens: 120,
        temperature: 0,
      });
      const raw = completion.choices[0]?.message?.content?.trim() ?? '';
      const json = raw.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(json) as ModerationResult;
      if (parsed.safe) {
        console.log('[Moderation:Groq] ✅ ALLOWED');
        return { safe: true };
      } else {
        console.warn('[Moderation:Groq] 🚫 BLOCKED —', parsed.reason);
        return { safe: false, reason: parsed.reason, blockedBy: 'gemini' };
      }
    } catch (err) {
      console.warn('[Moderation:Groq] ⚠️ Unavailable, falling back to local filter:', err);
    }
  } else {
    console.warn('[Moderation:Groq] ⚠️ No API key — using local filter only');
  }

  // ── Fallback: local word filter (offline) ─────────────────────────────────
  const local = localWordFilter(text);
  if (local.flagged) {
    console.warn('[Moderation:Local] 🚫 BLOCKED —', local.reason);
    return { safe: false, reason: local.reason, blockedBy: 'local' };
  }
  console.log('[Moderation:Local] ✅ ALLOWED');
  return { safe: true };
};

/**
 * Ask Gemini to clarify a DASS-21 question for the user.
 * Returns null on failure so the caller uses the static helper content.
 */
export const askQuestionDoubt = async (
  userDoubt: string,
  questionText: string,
  subscale: 'depression' | 'anxiety' | 'stress',
  questionNum: number,
): Promise<string | null> => {
  const client = getClient();
  if (!client) return null;
  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: DOUBT_SYSTEM(questionText, subscale, questionNum) },
        {
          role: 'user',
          content: userDoubt.trim()
            ? userDoubt
            : 'Please explain what this question is asking and how to pick the right score.',
        },
      ],
      max_tokens: 180,
      temperature: 0.5,
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
};
