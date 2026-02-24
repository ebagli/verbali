import express from "express";
import { authMiddleware } from "../auth.js";
import FormData from "form-data";

const router = express.Router();

router.use(authMiddleware);

router.post("/transcribe", async (req, res) => {
  try {
    const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
    if (!ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY not configured" });
    }

    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const audioFile = Array.isArray(req.files.audio) ? req.files.audio[0] : req.files.audio;

    const formData = new FormData();
    formData.append("file", audioFile.data, { filename: audioFile.name });
    formData.append("model_id", "scribe_v2");
    formData.append("diarize", "true");
    formData.append("tag_audio_events", "true");
    formData.append("language_code", "it");

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errText}`);
    }

    const transcription = await response.json();
    res.json(transcription);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/extract-cases", async (req, res) => {
  try {
    const { transcript_text } = req.body;

    if (!transcript_text || typeof transcript_text !== "string") {
      return res.status(400).json({ error: "Invalid input" });
    }

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY) {
      return res.status(500).json({ error: "AI gateway not configured" });
    }

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
                    },
                  },
                },
                required: ["cases"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_cases" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI gateway error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call returned from AI");
    }

    const args = JSON.parse(toolCall.function.arguments);
    res.json(args);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
