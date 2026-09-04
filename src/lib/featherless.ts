import type { Expression, Message } from "./replay-data";
import { expressionFor } from "./replay-data";

export type EmotionAnalysis = {
  expression: Expression;
  sarcasm: boolean;
  intensity: number;
  directorNote: string;
};

export type SceneRecap = {
  title: string;
  logline: string;
  mood: string;
  directorAdvice: string;
};

const DEFAULT_MODEL = "meta-llama/Meta-Llama-3.1-8B-Instruct";
const API_URL = "https://api.featherless.ai/v1/chat/completions";

export function getFeatherlessApiKey(): string {
  if (typeof window === "undefined") return "";
  const envKey = (import.meta as unknown as { env?: { VITE_FEATHERLESS_API_KEY?: string } }).env?.VITE_FEATHERLESS_API_KEY;
  return localStorage.getItem("featherless_api_key") || envKey || "";
}

export function saveFeatherlessApiKey(key: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("featherless_api_key", key.trim());
  }
}

export function getFeatherlessModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem("featherless_model") || DEFAULT_MODEL;
}

export function saveFeatherlessModel(model: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("featherless_model", model.trim());
  }
}

// In-memory cache to avoid duplicate API requests during repeated plays
const emotionCache = new Map<string, EmotionAnalysis>();

/**
 * Uses Featherless.ai serverless LLM to analyze message subtext, sarcasm, and true emotion.
 * Falls back to local regex-based classification if offline or API key is absent.
 */
export async function analyzeEmotionWithFeatherless(
  message: Message,
  previousMessages: Message[] = []
): Promise<EmotionAnalysis> {
  const cacheKey = `${message.id}:${message.text}`;
  if (emotionCache.has(cacheKey)) {
    return emotionCache.get(cacheKey)!;
  }

  const apiKey = getFeatherlessApiKey();
  const baseExpression = expressionFor(message.text);

  // If no API key is provided, return instant local heuristic with an AI Director note
  if (!apiKey) {
    const fallback: EmotionAnalysis = {
      expression: baseExpression,
      sarcasm: /😏|🙃|🙄/i.test(message.text) || (/fine|great|sure/i.test(message.text) && /😩|😭/.test(message.text)),
      intensity: /!|\?|🤯|😭/.test(message.text) ? 8 : 5,
      directorNote: baseExpression === "neutral" ? "Natural cadence" : `${baseExpression.toUpperCase()} reaction`,
    };
    emotionCache.set(cacheKey, fallback);
    return fallback;
  }

  const contextWindow = previousMessages.slice(-3).map((m) => `${m.from}: "${m.text}"`).join("\n");

  const systemPrompt = `You are a theatrical Animation Director for a cartoon chat replay.
Analyze the speaker's emotional subtext, sarcasm, and reaction state.
Allowed expressions: "happy", "sad", "surprised", "love", "neutral".
Respond ONLY with valid, raw JSON (no markdown formatting, no code blocks):
{"expression": "happy"|"sad"|"surprised"|"love"|"neutral", "sarcasm": boolean, "intensity": number from 1 to 10, "directorNote": "brief stage advice under 6 words"}`;

  const userPrompt = `Conversation History:\n${contextWindow}\nCurrent Line:\n${message.from}: "${message.text}"\nDirect the scene:`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getFeatherlessModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 120,
      }),
    });

    if (!response.ok) {
      throw new Error(`Featherless API error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || "";
    // Clean potential markdown wrap like ```json ... ```
    const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    const validExpressions: Expression[] = ["happy", "sad", "surprised", "love", "neutral"];
    const exp: Expression = validExpressions.includes(parsed.expression) ? parsed.expression : baseExpression;

    const result: EmotionAnalysis = {
      expression: exp,
      sarcasm: Boolean(parsed.sarcasm),
      intensity: typeof parsed.intensity === "number" ? parsed.intensity : 6,
      directorNote: parsed.directorNote || "In character",
    };

    emotionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.warn("Featherless emotion call fallback:", error);
    const fallback: EmotionAnalysis = {
      expression: baseExpression,
      sarcasm: false,
      intensity: 5,
      directorNote: "Rule-based fallback",
    };
    emotionCache.set(cacheKey, fallback);
    return fallback;
  }
}

/**
 * Generates an episodic story recap and scene logline for the active day's chat using Featherless.ai.
 */
export async function generateSceneRecap(
  conversationTitle: string,
  dateFormatted: string,
  messages: Message[]
): Promise<SceneRecap> {
  const apiKey = getFeatherlessApiKey();

  // Instant fallback recap if offline/no key
  const fallbackRecap: SceneRecap = {
    title: `${conversationTitle} — Chapter ${dateFormatted}`,
    logline: `A lively chat memory between friends exchanging thoughts and quick updates on ${dateFormatted}.`,
    mood: "Warm, authentic slice-of-life",
    directorAdvice: "Play avatars with natural pacing and dynamic expressions.",
  };

  if (!apiKey || messages.length === 0) {
    return fallbackRecap;
  }

  const script = messages.map((m) => `${m.from}: ${m.text}`).join("\n");

  const systemPrompt = `You are an Emmy-winning animation showrunner.
Turn this real-world messaging thread into an animated TV episode summary.
Respond ONLY with valid, raw JSON (no code blocks):
{"title": "Creative 4-6 word episode title", "logline": "Exciting 2-sentence episodic summary", "mood": "2-3 word vibe description", "directorAdvice": "Brief visual tip for the animators"}`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getFeatherlessModel(),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Chat date: ${dateFormatted}\nDialogue:\n${script}` },
        ],
        temperature: 0.6,
        max_tokens: 200,
      }),
    });

    if (!response.ok) throw new Error(`Featherless recap failed: ${response.status}`);

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || "";
    const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return {
      title: parsed.title || fallbackRecap.title,
      logline: parsed.logline || fallbackRecap.logline,
      mood: parsed.mood || fallbackRecap.mood,
      directorAdvice: parsed.directorAdvice || fallbackRecap.directorAdvice,
    };
  } catch (err) {
    console.warn("Featherless recap fallback:", err);
    return fallbackRecap;
  }
}
