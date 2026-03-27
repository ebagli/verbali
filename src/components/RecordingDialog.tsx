import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey, parseGeminiJson } from "@/lib/gemini";
import { saveTranscription, type TranscriptSegment } from "@/lib/local-store";
import { Loader2, Mic, Square, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const PROMPT = `Trascrivi l'audio fornito seguendo rigorosamente queste regole:
    1. Lingua: Italiano.
    2. Diarizzazione: Identifica i diversi parlanti (speaker_0, speaker_1, etc.).
    3. Formato: Rispondi ESCLUSIVAMENTE con un oggetto JSON valido. 
    Struttura richiesta:
    {
      "segments": [
        { "speaker": "speaker_0", "text": "...", "start": 0.0, "end": 5.0 }
      ],
      "text": "..."
    }
    ATTENZIONE: Se l'audio è silenzioso o incomprensibile, restituisci segments vuoti. Non inventare testo.`;

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const ffmpegRef = useRef<FFmpeg | null>(null);

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
    const timeOffset = index * 300; // 300 secondi = 5 minuti

    const responseText = await callGeminiWithAudio(audioBase64, mimeType, PROMPT);
    const result = parseGeminiJson(responseText);

    return (result.segments || []).map((s: any) => ({
      speaker: s.speaker || "speaker_0",
      text: s.text || "",
      start: (Number(s.start) || 0) + timeOffset,
      end: (Number(s.end) || 0) + timeOffset,
    }));
  };

  const loadFFmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;
    
    const ffmpeg = new FFmpeg();
    setProcessingLabel("Caricamento motore audio...");
    
    // Caricamento sicuro tramite Blob URL per bypassare restrizioni CORS/COEP
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const processAudio = async (file: Blob | File) => {
    if (!hasGeminiApiKey()) {
      toast.error("Configura la chiave API Gemini.");
      return;
    }

    // Verifica SharedArrayBuffer (Se è undefined, FFmpeg non partirà mai)
    if (typeof SharedArrayBuffer === 'undefined') {
      toast.error("Errore di sicurezza browser: SharedArrayBuffer non disponibile.");
      console.error("COOP/COEP headers non configurati correttamente nel main.js");
      return;
    }

    setProcessing(true);
    
    try {
      const ffmpeg = await loadFFmpeg();

      setProcessingLabel("Preparazione file...");
      await ffmpeg.writeFile('input_audio', await fetchFile(file));

      // Dividiamo in pezzi da 5 minuti (300s) invece di 10
      await ffmpeg.exec([
        '-i', 'input_audio',
        '-f', 'segment',
        '-segment_time', '300', 
        '-c', 'copy',
        'out%03d.mp3'
      ]);

      const allFiles = await ffmpeg.listDir('.');
      const chunkFiles = allFiles
        .filter(f => f.name.startsWith('out'))
        .sort((a, b) => a.name.localeCompare(b.name));

      const allSegments: TranscriptSegment[] = [];

      for (let i = 0; i < chunkFiles.length; i++) {
        setProcessingLabel(`Trascrizione parte ${i + 1} di ${chunkFiles.length}...`);
        const data = await ffmpeg.readFile(chunkFiles[i].name);
        const chunkBlob = new Blob([data], { type: 'audio/mp3' });
        
        try {
          const segments = await transcribeChunk(chunkBlob, "audio/mp3", i);
          allSegments.push(...segments);
        } catch (e) {
          console.warn(`Errore nel chunk ${i}, salto...`, e);
        }
      }

      if (allSegments.length === 0) throw new Error("Nessun testo rilevato.");

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

      toast.success("Completato!");
      onComplete();
      navigate(`/transcription/${id}`);
    } catch (err: any) {
      console.error("Errore elaborazione:", err);
      toast.error("Errore durante l'elaborazione dell'audio.");
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
      toast.error("Microfono non disponibile");
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
            L'audio verrà diviso e trascritto con l'AI.
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
                className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${
                  recording ? "bg-destructive text-white animate-pulse" : "bg-primary text-white hover:opacity-90"
                }`}
              >
                {recording ? <Square className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>

              <div className="text-center">
                <p className="text-sm font-medium">
                  {recording ? "Registrazione in corso..." : "Clicca per registrare"}
                </p>
              </div>

              <div className="w-full border-t pt-6 flex flex-col items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processAudio(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" className="w-full gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Seleziona file audio
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}