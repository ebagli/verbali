import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey, parseGeminiJson } from "@/lib/gemini";
import { saveTranscription, type TranscriptSegment } from "@/lib/local-store";
import { Loader2, Mic, Square, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const PROMPT = `Trascrivi l'audio fornito seguendo rigorosamente queste regole:
    1. Lingua: Italiano.
    2. Diarizzazione: Identifica i diversi parlanti (speaker_0, speaker_1, etc.).
    3. Formato: Rispondi ESCLUSIVAMENTE con un oggetto JSON valido. Non aggiungere saluti o spiegazioni.

    Struttura richiesta:
    {
      "segments": [
        { "speaker": "speaker_0", "text": "...", "start": 0.0, "end": 5.0 },
        { "speaker": "speaker_1", "text": "...", "start": 5.1, "end": 10.0 }
      ],
      "text": "Il testo completo unito..."
    }

    ATTENZIONE: Se non riesci a trascrivere, restituisci un JSON con campi vuoti, mai testo libero.`;

// 20MB è il limite ideale per non appesantire il caricamento Base64
const CHUNK_SIZE_BYTES = 20 * 1024 * 1024;

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const transcribeChunk = async (blob: Blob, mimeType: string, index: number): Promise<TranscriptSegment[]> => {
    const audioBase64 = await blobToBase64(blob);
    // Offset temporale stimato (300s = 5 min per chunk da ~20MB mediamente)
    const timeOffset = index * 300;

    const responseText = await callGeminiWithAudio(audioBase64, mimeType, PROMPT);
    const result = parseGeminiJson(responseText);

    return (result.segments || []).map((s: any) => ({
      speaker: s.speaker || "speaker_0",
      text: s.text || "",
      start: (s.start || 0) + timeOffset,
      end: (s.end || 0) + timeOffset,
    }));
  };

  const processAudio = async (file: Blob | File) => {
    if (!hasGeminiApiKey()) {
      toast.error("Configura la chiave API Gemini.");
      return;
    }

    setProcessing(true);
    try {
      setProcessingLabel("Analisi file...");

      // 1. Slicing binario: Istantaneo, non usa RAM extra
      const audioChunks: Blob[] = [];
      let start = 0;
      while (start < file.size) {
        audioChunks.push(file.slice(start, start + CHUNK_SIZE_BYTES, file.type));
        start += CHUNK_SIZE_BYTES;
      }

      setProcessingLabel(`Trascrizione di ${audioChunks.length} parti...`);

      // 2. Esecuzione parallela con gestione degli errori
      // Usiamo allSettled per non perdere tutto se un pezzo fallisce
      const promises = audioChunks.map((chunk, i) => transcribeChunk(chunk, file.type || "audio/webm", i));
      const results = await Promise.allSettled(promises);

      const allSegments = results
        .filter((r): r is PromiseFulfilledResult<TranscriptSegment[]> => r.status === 'fulfilled')
        .flatMap(r => r.value);

      if (allSegments.length === 0) {
        throw new Error("La trascrizione non ha prodotto risultati.");
      }

      // 3. Salvataggio locale
      const id = crypto.randomUUID();
      saveTranscription({
        id,
        created_at: new Date().toISOString(),
        conversation_date: new Date().toISOString().split("T")[0],
        transcript_json: allSegments.sort((a, b) => a.start - b.start),
        speaker_mapping: {},
        summary: "",
        report_html: "",
      });

      toast.success("Trascrizione completata!");
      onComplete();
      navigate(`/transcription/${id}`);
    } catch (err: any) {
      console.error("Errore processAudio:", err);
      toast.error(err.message || "Errore durante l'elaborazione.");
    } finally {
      setProcessing(false);
    }
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start(1000);
      setRecording(true);
    } catch {
      toast.error("Accesso al microfono negato");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registra o Carica Audio</DialogTitle>
          <DialogDescription>
            Supporta file di grandi dimensioni. L'audio verrà diviso e trascritto in parallelo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-8">
          {processing ? (
            <>
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">{processingLabel}</p>
            </>
          ) : (
            <>
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${recording ? "bg-destructive text-white animate-pulse" : "bg-primary text-white hover:opacity-90"
                  }`}
              >
                {recording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>

              <div className="text-center">
                <p className="text-sm font-medium">
                  {recording ? "Registrazione in corso..." : "Clicca per registrare"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  L'audio viene elaborato localmente per la massima privacy.
                </p>
              </div>

              <div className="w-full border-t pt-6 flex flex-col items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm,.aac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|ogg|flac|webm|aac)$/i.test(file.name)) {
                        toast.error("Seleziona un file audio valido (MP3, WAV, M4A, ecc.)");
                        e.target.value = "";
                        return;
                      }
                      processAudio(file);
                    }
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Seleziona file audio (MP3, WAV, M4A)
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}