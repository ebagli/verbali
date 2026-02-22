import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript_text } = await req.json();
    if (!transcript_text) throw new Error("No transcript_text provided");

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
          { role: "user", content: transcript_text },
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
