import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const MODEL = "gemini-3.1-flash-lite-preview";
const API_KEY_STORAGE = "gemini_api_key";

// Zod Schema for robust response validation
const TranscriptionSchema = z.object({
  segments: z.array(z.object({
    speaker: z.string().describe("Identificativo del parlante (es. speaker_0)"),
    text: z.string().describe("Testo pronunciato"),
    start: z.number().describe("Tempo di inizio in secondi"),
    end: z.number().describe("Tempo di fine in secondi")
  })).optional(),
  text: z.string().describe("Testo completo della trascrizione").optional()
});

export function getGeminiApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

export function setGeminiApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key.trim());
}

export function hasGeminiApiKey(): boolean {
  return !!getGeminiApiKey();
}

function getClient(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("Chiave API Gemini non configurata.");
  return new GoogleGenerativeAI(apiKey);
}

const generationConfig = {
  maxOutputTokens: 32768,
  temperature: 0.2,
};

export async function callGemini(prompt: string): Promise<string> {
    const ai = getClient();
    const model = ai.getGenerativeModel({ model: MODEL, generationConfig });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
}

export async function callGeminiWithAudio(audioBase64: string, mimeType: string, prompt: string): Promise<any> {
  try {
    const ai = getClient();
    const model = ai.getGenerativeModel({ 
        model: MODEL, 
        generationConfig: { ...generationConfig, responseMimeType: "application/json" } 
    });
    
    const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: audioBase64 } }
    ]);

    const response = await result.response;
    const text = response.text();
    if (!text) throw new Error("Nessuna risposta da Gemini.");
    return JSON.parse(text); 
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
