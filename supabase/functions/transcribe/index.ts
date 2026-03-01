import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY not configured");
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    if (!audioFile) {
      throw new Error("No audio file provided");
    }

    // File size limit: 50MB
    const maxSize = 50 * 1024 * 1024;
    if (audioFile.size > maxSize) {
      return new Response(JSON.stringify({ error: "File too large. Maximum size is 50MB." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert audio to base64
    const audioBytes = new Uint8Array(await audioFile.arrayBuffer());
    const audioBase64 = base64Encode(audioBytes);

    // Determine MIME type
    let mimeType = audioFile.type || "audio/webm";
    // Gemini accepts these audio types
    const supportedTypes = ["audio/wav", "audio/mp3", "audio/mpeg", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/webm", "audio/mp4", "audio/x-m4a"];
    if (!supportedTypes.includes(mimeType)) {
      mimeType = "audio/webm"; // fallback
    }

    const prompt = `Trascrivi questo audio in italiano con diarizzazione degli speaker. 
Identifica i diversi parlanti e assegna a ciascuno un'etichetta (speaker_0, speaker_1, ecc.).

Rispondi SOLO con un JSON valido nel formato:
{
  "segments": [
    {"speaker": "speaker_0", "text": "testo del segmento", "start": 0, "end": 5},
    {"speaker": "speaker_1", "text": "testo del segmento", "start": 5, "end": 12}
  ],
  "text": "testo completo della trascrizione"
}

Regole:
- Ogni cambio di parlante deve creare un nuovo segmento
- I tempi start/end sono in secondi (approssimativi)
- Trascrivi fedelmente senza aggiungere o modificare contenuto
- Se c'è un solo parlante, usa solo speaker_0`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      throw new Error(`Google Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("No response from Google Gemini");
    }

    const result = JSON.parse(text);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("transcribe error:", error);
    return new Response(JSON.stringify({ error: error.message || "Errore interno del server." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
