// Direct Gemini API client — no edge functions needed

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const API_KEY_STORAGE = "gemini_api_key";

export function getGeminiApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function hasGeminiApiKey(): boolean {
  return !!getGeminiApiKey();
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
}

export async function callGemini(prompt: string, options?: { jsonMode?: boolean; maxTokens?: number }): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Chiave API Gemini non configurata. Vai nelle impostazioni per inserirla.");

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
        maxOutputTokens: options?.maxTokens || 8192,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit Gemini superato, riprova tra poco.");
    if (response.status === 400) throw new Error("Chiave API Gemini non valida. Controlla nelle impostazioni.");
    const errText = await response.text();
    throw new Error(`Errore Gemini API: ${response.status} - ${errText}`);
  }

  const data: GeminiResponse = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Nessuna risposta da Gemini.");
  return text;
}

export async function callGeminiWithAudio(audioBase64: string, mimeType: string, prompt: string): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Chiave API Gemini non configurata. Vai nelle impostazioni per inserirla.");

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType, data: audioBase64 } },
          { text: prompt },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("Rate limit Gemini superato, riprova tra poco.");
    if (response.status === 400) throw new Error("Chiave API Gemini non valida o audio troppo grande.");
    const errText = await response.text();
    throw new Error(`Errore Gemini API: ${response.status} - ${errText}`);
  }

  const data: GeminiResponse = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Nessuna risposta da Gemini.");
  return text;
}

export function parseGeminiJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    cleaned = cleaned.replace(/'/g, '"').replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
    return JSON.parse(cleaned);
  }
}
