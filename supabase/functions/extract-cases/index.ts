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

    const systemPrompt = `Sei un assistente legale esperto specializzato in sinistri sanitari e responsabilità medica. Analizza attentamente la trascrizione di un Comitato Valutazione Sinistri (CVS) e identifica OGNI pratica/paziente discusso.

Per ogni paziente/caso identificato, estrai le seguenti informazioni con la massima precisione:

- patient_name: COGNOME NOME del paziente in MAIUSCOLO. Presta massima attenzione ai nomi: ascolta attentamente le lettere, correggi eventuali errori fonetici, assicurati che cognome e nome siano nell'ordine corretto. Se il nome non è chiaro, usa quello più probabile.

- description: Riassunto DETTAGLIATO della situazione clinico-legale discussa (5-8 frasi, stile formale e impersonale, tono medico-legale). Includi:
  * La tipologia di sinistro/evento avverso (es. errore diagnostico, complicanza chirurgica, infezione nosocomiale, caduta, etc.)
  * Le circostanze cliniche note (reparto, tipo di intervento, data dell'evento se menzionata)
  * Lo stato attuale della pratica (es. in istruttoria, perizia in corso, CTU nominata, ATP richiesta)
  * Le richieste risarcitorie se menzionate (importi, lettere di messa in mora, citazioni)
  * Le valutazioni espresse dai partecipanti sulla responsabilità e sulla quantificazione del danno
  * Eventuali perizie medico-legali già effettuate o da effettuare

- is_new_claim: true se è una nuova richiesta di risarcimento presentata per la prima volta in questo CVS, false se è un caso già in corso di discussione/gestione

- suggested_outcome: uno tra:
  "istruttoria" - se si decide di attendere ulteriori informazioni/documenti/perizie
  "riserva" - se si condivide di mantenere o apporre una riserva
  "prematuro" - se si ritiene prematuro prendere decisioni
  "sviluppi" - se si rimane in attesa di sviluppi (giudiziari, clinici, etc.)
  "archiviazione" - se la pratica viene archiviata per insussistenza di responsabilità
  "proposta_transattiva" - se si decide di proporre un risarcimento (indica l'importo nel campo outcome_extra)
  "" - se non è possibile determinare l'esito

- outcome_extra: informazioni aggiuntive sull'esito (es. importo per proposta transattiva, motivazione per archiviazione)

Analizza anche il contesto generale della riunione e restituisci:
- facility_name: il nome della struttura sanitaria se menzionato
- meeting_location: il luogo dell'incontro se menzionato
- start_time: l'ora di inizio lavori se menzionata (formato HH:MM)
- closing_time: l'ora di fine lavori se menzionata (formato HH:MM)
- general_discussion: un breve riassunto di eventuali discussioni generali non legate a casi specifici
- next_meeting_date: la data del prossimo incontro se menzionata (formato YYYY-MM-DD)
- next_meeting_time: l'ora del prossimo incontro se menzionata (formato HH:MM)

NON inventare informazioni. Estrai solo ciò che è esplicitamente discusso nella trascrizione.

Rispondi SOLO con un JSON valido nel formato:
{
  "cases": [{"patient_name": "...", "description": "...", "is_new_claim": true/false, "suggested_outcome": "...", "outcome_extra": "..."}],
  "facility_name": "...",
  "meeting_location": "...",
  "start_time": "...",
  "closing_time": "...",
  "general_discussion": "...",
  "next_meeting_date": "...",
  "next_meeting_time": "..."
}`;

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
