import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    const { transcript_text } = await req.json();
    if (!transcript_text || typeof transcript_text !== "string") {
      return new Response(JSON.stringify({ error: "Invalid input: transcript_text must be a string" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maxLength = 200000;
    if (transcript_text.length > maxLength) {
      return new Response(JSON.stringify({ error: `Text too long. Maximum length is ${maxLength} characters.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitized = transcript_text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

    const GOOGLE_GEMINI_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GOOGLE_GEMINI_API_KEY) throw new Error("Google Gemini API key not configured");

    const systemPrompt = `Sei un assistente legale specializzato in sinistri sanitari. Analizza la trascrizione di un Comitato Valutazione Sinistri e identifica ogni pratica/paziente discusso.

Per ogni paziente identificato, estrai:
- patient_name: COGNOME NOME in maiuscolo
- description: Riassunto conciso della situazione clinico/legale discussa (massimo 2-3 frasi, stile formale e impersonale)
- is_new_claim: true se sembra una nuova richiesta di risarcimento, false se è un caso in corso
- suggested_outcome: uno tra "istruttoria", "riserva", "prematuro", "sviluppi", "archiviazione", "proposta_transattiva" oppure "" se non chiaro

NON inventare informazioni. Estrai solo ciò che è esplicitamente discusso nella trascrizione.

Rispondi SOLO con un JSON valido nel formato: {"cases": [{"patient_name": "...", "description": "...", "is_new_claim": true/false, "suggested_outcome": "..."}]}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${systemPrompt}\n\nTrascrizione:\n${sanitized}` }] }],
          generationConfig: { responseMimeType: "application/json" },
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
    if (!text) throw new Error("No response from Google Gemini");

    const args = JSON.parse(text);
    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("extract-cases error:", error);
    return new Response(JSON.stringify({ error: "Errore interno del server." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
