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

const CHUNK_DURATION_SEC = 1800;
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

  const getAudioDuration = async (blob: Blob): Promise<number> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      return audioBuffer.duration;
    } catch {
      return 0;
    } finally {
      audioCtx.close();
    }
  };

  const splitAndEncode = async (blob: Blob, chunkDuration: number): Promise<Blob[]> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const numChannels = audioBuffer.numberOfChannels;
    const totalSamples = audioBuffer.length;
    const chunkSamples = Math.floor(chunkDuration * audioBuffer.sampleRate);
    const blobs: Blob[] = [];

    for (let offset = 0; offset < totalSamples; offset += chunkSamples) {
      const length = Math.min(chunkSamples, totalSamples - offset);
      const chunkBuffer = audioCtx.createBuffer(numChannels, length, audioBuffer.sampleRate);

      for (let ch = 0; ch < numChannels; ch++) {
        const src = audioBuffer.getChannelData(ch);
        const dst = chunkBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) dst[i] = src[offset + i];
      }

      const compressed = await encodeToOpus(chunkBuffer);
      blobs.push(compressed);
    }

    audioCtx.close();
    return blobs;
  };

  const encodeToOpus = (audioBuffer: AudioBuffer): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const recorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 24000,
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        ctx.close();
        resolve(new Blob(chunks, { type: "audio/webm" }));
      };

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(dest);
      source.start();

      recorder.start();
      source.onended = () => setTimeout(() => recorder.stop(), 100);
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
      setProcessingLabel("Analisi audio…");
      const duration = await getAudioDuration(blob);
      const durMin = Math.floor(duration / 60);
      const durSec = Math.floor(duration % 60);
      setProcessingLabel(`${mimeType.split("/")[1]?.toUpperCase() || "Audio"} | ${durMin}m ${durSec}s | ${sizeMB.toFixed(1)} MB`);

      let segments: TranscriptSegment[] = [];

      if (duration > CHUNK_DURATION_SEC) {
        await new Promise(r => setTimeout(r, 500));
        setProcessingLabel("Compressione e suddivisione…");
        const chunks = await splitAndEncode(blob, CHUNK_DURATION_SEC);

        for (let i = 0; i < chunks.length; i++) {
          setProcessingLabel(`Trascrizione parte ${i + 1}/${chunks.length}…`);
          try {
            const chunkSegments = await transcribeChunk(chunks[i], "audio/webm", i * CHUNK_DURATION_SEC);
            segments = [...segments, ...chunkSegments];
          } catch (e) {
            console.error(`Errore nel chunk ${i}:`, e);
            toast.error(`Errore nella parte ${i + 1}, procedo con le altre.`);
          }
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
