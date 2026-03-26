import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey, parseGeminiJson } from "@/lib/gemini";
import { saveTranscription, type TranscriptSegment } from "@/lib/local-store";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
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

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function getFFmpeg(): Promise<FFmpeg> {
  if (!ffmpegInstance) {
    ffmpegInstance = new FFmpeg();
  }
  if (!ffmpegLoaded) {
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegLoaded = true;
  }
  return ffmpegInstance;
}

async function processAudioFFmpeg(file: File | Blob): Promise<Blob[]> {
  const ffmpeg = await getFFmpeg();

  await ffmpeg.writeFile("input.audio", await fetchFile(file));

  await ffmpeg.exec([
    "-i", "input.audio",
    "-f", "segment",
    "-segment_time", "1800",
    "-ac", "1",
    "-ar", "16000",
    "-b:a", "32k",
    "output_%03d.mp3",
  ]);

  const chunks: Blob[] = [];
  const files = await ffmpeg.listDir(".");

  for (const item of files) {
    if (item.name.startsWith("output_") && item.name.endsWith(".mp3")) {
      const data = await ffmpeg.readFile(item.name);
      chunks.push(new Blob([data], { type: "audio/mp3" }));
      await ffmpeg.deleteFile(item.name);
    }
  }

  await ffmpeg.deleteFile("input.audio");
  return chunks;
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

  const transcribeChunk = async (blob: Blob, mimeType: string, timeOffset: number): Promise<TranscriptSegment[]> => {
    const audioBase64 = await blobToBase64(blob);
    const responseText = await callGeminiWithAudio(audioBase64, mimeType, PROMPT);
    const result = parseGeminiJson(responseText);
    return (result.segments || []).map((s: any) => ({
      speaker: s.speaker || "speaker_0",
      text: s.text || "",
      start: (s.start || 0) + timeOffset,
      end: (s.end || 0) + timeOffset,
    }));
  };

  const processAudio = async (blob: Blob | File) => {
    if (!hasGeminiApiKey()) {
      toast.error("Configura la chiave API Gemini nelle impostazioni (sidebar).");
      return;
    }

    setProcessing(true);
    const mimeType = blob.type || "audio/webm";
    const sizeMB = blob.size / (1024 * 1024);

    try {
      setProcessingLabel(`${mimeType.split("/")[1]?.toUpperCase() || "Audio"} | ${sizeMB.toFixed(1)} MB`);

      let segments: TranscriptSegment[] = [];

      if (blob.size > 10 * 1024 * 1024) {
        setProcessingLabel("Caricamento FFmpeg…");
        const chunks = await processAudioFFmpeg(blob);
        setProcessingLabel(`Compressione completata (${chunks.length} parti)`);

        setProcessingLabel(`Trascrizione parallela di ${chunks.length} parti…`);

        const allChunksPromises = chunks.map((chunk, i) =>
          transcribeChunk(chunk, "audio/mp3", i * 1800)
        );

        const results = await Promise.allSettled(allChunksPromises);

        segments = results
          .filter((r): r is PromiseFulfilledResult<TranscriptSegment[]> => r.status === 'fulfilled')
          .flatMap(r => r.value);

        if (results.some(r => r.status === 'rejected')) {
          toast.warning("Alcune parti dell'audio non sono state trascritte correttamente.");
        }
      } else {
        setProcessingLabel("Trascrizione in corso…");
        segments = await transcribeChunk(blob, mimeType, 0);
      }

      const id = crypto.randomUUID();
      saveTranscription({
        id,
        created_at: new Date().toISOString(),
        conversation_date: new Date().toISOString().split("T")[0],
        transcript_json: segments.length > 0 ? segments : [{ speaker: "speaker_0", text: "", start: 0, end: 0 }],
        speaker_mapping: {},
        summary: "",
        report_html: "",
      });

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
