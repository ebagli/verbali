import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-2.5-flash";
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

function getClient(): GoogleGenAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Chiave API Gemini non configurata. Vai nelle impostazioni per inserirla.");
  return new GoogleGenAI({ apiKey });
}

export async function callGemini(prompt: string, options?: { jsonMode?: boolean; maxTokens?: number }): Promise<string> {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        ...(options?.jsonMode ? { responseMimeType: "application/json" } : {}),
        maxOutputTokens: options?.maxTokens || 16384,
        temperature: 0.2,
      },
    });
    const text = response.text;
    if (!text) throw new Error("Nessuna risposta da Gemini.");
    return text;
  } catch (err: any) {
    if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Rate limit Gemini superato, riprova tra poco.");
    }
    if (err.message?.includes("400") || err.message?.includes("INVALID_ARGUMENT")) {
      throw new Error("Chiave API Gemini non valida. Controlla nelle impostazioni.");
    }
    throw err;
  }
}

export async function callGeminiWithAudio(audioBase64: string, mimeType: string, prompt: string): Promise<string> {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: audioBase64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 16384,
        temperature: 0.2,
      },
    });
    const text = response.text;
    if (!text) throw new Error("Nessuna risposta da Gemini.");
    return text;
  } catch (err: any) {
    if (err.message?.includes("429") || err.message?.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("Rate limit Gemini superato, riprova tra poco.");
    }
    if (err.message?.includes("400") || err.message?.includes("INVALID_ARGUMENT")) {
      throw new Error("Chiave API Gemini non valida o audio troppo grande.");
    }
    throw err;
  }
}

export function parseGeminiJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const fixJson = (json: string): string => {
    let result = json;
    const openBraces = (result.match(/{/g) || []).length;
    const closeBraces = (result.match(/}/g) || []).length;
    const openBrackets = (result.match(/\[/g) || []).length;
    const closeBrackets = (result.match(/]/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      if (!result.trim().endsWith("]")) result += "]";
    }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      if (!result.trim().endsWith("}")) result += "}";
    }

    result = result.replace(/,\s*([}\]])/g, "$1");
    return result;
  };

  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      const fixed = fixJson(cleaned);
      return JSON.parse(fixed);
    } catch {
      cleaned = cleaned.replace(/'/g, '"').replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
      try {
        return JSON.parse(cleaned);
      } catch {
        return JSON.parse(fixJson(cleaned));
      }
    }
  }
}
