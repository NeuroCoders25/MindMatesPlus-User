import { GoogleGenerativeAI } from '@google/generative-ai';
import { Dass21Result } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';

// ─── Client ──────────────────────────────────────────────────────────────────

let genAI: GoogleGenerativeAI | null = null;

const getClient = (): GoogleGenerativeAI => {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(API_KEY);
  }
  return genAI;
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
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') return null;
  try {
    const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
    const chat = model.startChat({
      systemInstruction: SUPPORT_SYSTEM(dass21Result),
      generationConfig: { maxOutputTokens: 200, temperature: 0.7 },
    });
    const res = await chat.sendMessage(userText);
    return res.response.text().trim();
  } catch {
    return null;
  }
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
  if (!API_KEY || API_KEY === 'your_gemini_api_key_here') return null;
  try {
    const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });
    const chat = model.startChat({
      systemInstruction: DOUBT_SYSTEM(questionText, subscale, questionNum),
      generationConfig: { maxOutputTokens: 180, temperature: 0.5 },
    });
    const prompt = userDoubt.trim()
      ? userDoubt
      : 'Please explain what this question is asking and how to pick the right score.';
    const res = await chat.sendMessage(prompt);
    return res.response.text().trim();
  } catch {
    return null;
  }
};
