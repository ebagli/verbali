import { GoogleGenAI } from "@google/genai";

const MODEL = "gemini-3.1-pro-preview";
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
  if (!apiKey) throw new Error("Chiave API Gemini non configurata.");
  return new GoogleGenAI({ apiKey });
}

export async function callGemini(prompt: string): Promise<string> {
  const ai = getClient();
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { maxOutputTokens: 64000, temperature: 0. }
  });
  return response.text || "";
}

export async function callGeminiWithAudio(audioBase64: string, mimeType: string, prompt: string): Promise<any> {
  try {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: audioBase64 } }
          ]
        }
      ],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("Nessuna risposta da Gemini.");
    return JSON.parse(text);
  } catch (err: any) {
    if (err.message?.includes("429")) throw new Error("Rate limit Gemini superato.");
    if (err.message?.includes("400")) throw new Error("Errore richiesta API.");
    throw err;
  }
}

export function parseGeminiJson(data: any): any {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return { transcript: data };
    }
  }
  return data;
}
