import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreFlight } from "../_shared/cors.ts";

serve(async (req) => {
  const preflight = handleCorsPreFlight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { transcript_text } = await req.json();
    if (!transcript_text) throw new Error("No transcript_text provided");

    if (typeof transcript_text !== "string") {
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Sei un assistente legale specializzato in sinistri sanitari. Analizza la trascrizione di un Comitato Valutazione Sinistri e identifica ogni pratica/paziente discusso.

Per ogni paziente identificato, estrai:
- patient_name: COGNOME NOME in maiuscolo
- description: Riassunto conciso della situazione clinico/legale discussa (massimo 2-3 frasi, stile formale e impersonale)
- is_new_claim: true se sembra una nuova richiesta di risarcimento, false se è un caso in corso
- suggested_outcome: uno tra "istruttoria", "riserva", "prematuro", "sviluppi", "archiviazione", "proposta_transattiva" oppure "" se non chiaro

NON inventare informazioni. Estrai solo ciò che è esplicitamente discusso nella trascrizione.`,
          },
          { role: "user", content: sanitized },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_cases",
              description: "Extract patient cases from the committee transcript",
              parameters: {
                type: "object",
                properties: {
                  cases: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        patient_name: { type: "string" },
                        description: { type: "string" },
                        is_new_claim: { type: "boolean" },
                        suggested_outcome: { type: "string" },
                      },
                      required: ["patient_name", "description", "is_new_claim", "suggested_outcome"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["cases"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_cases" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call returned from AI");
    }

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("extract-cases error:", error);
    const corsHeaders = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: "Errore interno del server." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
