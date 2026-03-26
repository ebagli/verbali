import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey, parseGeminiJson } from "@/lib/gemini";
import { saveTranscription, type Transcription, type TranscriptSegment } from "@/lib/local-store";
import { Loader2, Mic, Square, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Trascrizione in corso…");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
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

  const processAudio = async (blob: Blob | File) => {
    if (!hasGeminiApiKey()) {
      toast.error("Configura la chiave API Gemini nelle impostazioni (sidebar).");
      return;
    }

    setProcessing(true);
    try {
      const mimeType = blob.type || "audio/webm";
      const audioBase64 = await blobToBase64(blob);

      const prompt = `Trascrivi l'audio fornito seguendo rigorosamente queste regole:
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

      const responseText = await callGeminiWithAudio(audioBase64, mimeType, prompt);
      const result = parseGeminiJson(responseText);
      const segments: TranscriptSegment[] = result.segments || [];

      const id = crypto.randomUUID();
      const transcription: Transcription = {
        id,
        created_at: new Date().toISOString(),
        conversation_date: new Date().toISOString().split("T")[0],
        transcript_json: segments.length > 0 ? segments : [{ speaker: "Speaker 1", text: result.text || "", start: 0, end: 0 }],
        speaker_mapping: {},
        summary: "",
        report_html: "",
      };

      saveTranscription(transcription);
      toast.success("Trascrizione completata!");
      onComplete();
      navigate(`/transcription/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Elaborazione fallita");
    }
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registra Audio</DialogTitle>
          <DialogDescription>
            Registra una conversazione o carica un file audio da trascrivere.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-8">
          {processing ? (
            <>
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">{processingLabel}</p>
            </>
          ) : (
            <>
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${recording
                  ? "bg-destructive text-destructive-foreground animate-pulse-recording"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
              >
                {recording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
              <p className="text-sm text-muted-foreground">
                {recording ? "Registrazione in corso… Clicca per fermare" : "Clicca per iniziare a registrare"}
              </p>

              <div className="w-full border-t pt-4 flex flex-col items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProcessingLabel(`Trascrizione di "${file.name}"…`);
                      processAudio(file);
                    }
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Carica file audio
                </Button>
                <p className="text-xs text-muted-foreground">MP3, WAV, M4A, WebM…</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
