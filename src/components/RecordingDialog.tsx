import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey } from "@/lib/gemini";
import { saveTranscription, type Transcription, type TranscriptSegment } from "@/lib/local-store";
import { Loader2, Mic, Square, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

declare global { interface Window { NL_APPID?: string; } }
interface Props { open: boolean; onOpenChange: (open: boolean) => void; onComplete: () => void; }

const PROMPT = `Trascrivi l'audio in italiano. 
ATTENZIONE: Analizza le diverse voci. Assegna un identificativo univoco (speaker_0, speaker_1, speaker_2...) a OGNI diverso parlante. 
Se più persone intervengono, distingui chiaramente i loro contributi nei segmenti.
Rispondi SOLO con JSON nella forma:
{
  "segments": [
    { "speaker": "speaker_0", "text": "...", "start": 0, "end": 5 }
  ]
}`;

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;

async function getFFmpeg(log: (msg: string) => void): Promise<FFmpeg> {
  if (!ffmpegInstance) ffmpegInstance = new FFmpeg();
  if (!ffmpegLoaded) {
    log("Inizializzazione motore audio locale...");
    const baseURL = "/ffmpeg"; 
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
    });
    ffmpegLoaded = true;
    log("Motore pronto.");
  }
  return ffmpegInstance;
}

async function processAudioFFmpeg(file: File | Blob, log: (msg: string) => void): Promise<Blob[]> {
  const ffmpeg = await getFFmpeg(log);
  log("Caricamento file...");
  await ffmpeg.writeFile("input.audio", await fetchFile(file));
  log("Suddivisione in corso...");
  await ffmpeg.exec(["-i", "input.audio", "-f", "segment", "-segment_time", "1800", "-c", "copy", "output_%03d.mp3"]);
  log("Estrazione chunk...");
  const chunks: Blob[] = [];
  const files = await ffmpeg.listDir(".");
  for (const item of files.filter(f => f.name.startsWith("output_") && f.name.endsWith(".mp3")).sort((a,b)=>a.name.localeCompare(b.name))) {
    const data = await ffmpeg.readFile(item.name);
    chunks.push(new Blob([data], { type: "audio/mp3" }));
    await ffmpeg.deleteFile(item.name);
  }
  await ffmpeg.deleteFile("input.audio");
  return chunks;
}

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
    const navigate = useNavigate();
    const [processing, setProcessing] = useState(false);
    const [processingLabel, setProcessingLabel] = useState("Trascrizione in corso…");
    const [logs, setLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const log = (message: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

    const blobToBase64 = (blob: Blob): Promise<string> => 
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const transcribeChunk = async (blob: Blob, mimeType: string, timeOffset: number = 0): Promise<TranscriptSegment[]> => {
        log(`Invio chunk (${(blob.size / 1024).toFixed(1)} KB)...`);
        const audioBase64 = await blobToBase64(blob);
        const result = await callGeminiWithAudio(audioBase64, mimeType, PROMPT);
        if (result.segments && Array.isArray(result.segments)) {
            return result.segments.map((s: any) => ({
                speaker: s.speaker || "speaker_0", text: s.text || "",
                start: (s.start || 0) + timeOffset, end: (s.end || 0) + timeOffset,
            }));
        }
        const transcript = result.transcript || result.text || (typeof result === 'string' ? result : "");
        return transcript ? [{ speaker: "speaker_0", text: transcript, start: timeOffset, end: timeOffset + 30 }] : [];
    };
    
    const processAudio = async (blob: Blob | File) => {
        if (!hasGeminiApiKey()) { toast.error("Configura la chiave API Gemini."); return; }
        setProcessing(true); setLogs([]); log("Inizio...");
        try {
            let segments: TranscriptSegment[] = [];
            if (blob.size > 50 * 1024 * 1024) {
                const chunks = await processAudioFFmpeg(blob, log);
                for (let i = 0; i < chunks.length; i++) {
                   setProcessingLabel(`Trascrizione ${i + 1}/${chunks.length}…`);
                   segments.push(...await transcribeChunk(chunks[i], "audio/mp3", i * 1800));
                }
            } else {
                segments = await transcribeChunk(blob, blob.type || "audio/mp3");
            }
            const id = crypto.randomUUID();
            saveTranscription({ id, created_at: new Date().toISOString(), conversation_date: new Date().toISOString().split("T")[0], transcript_json: segments, speaker_mapping: {}, summary: "", report_html: "" });
            toast.success("Fatto!"); onComplete(); navigate(`/transcription/${id}`);
        } catch (err: any) { log(`ERRORE: ${err.message}`); }
        setProcessing(false);
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Carica Audio</DialogTitle></DialogHeader>
                <div className="flex flex-col items-center gap-6 py-8">
                    {processing ? (
                        <><Loader2 className="animate-spin h-16 w-16" /><p>{processingLabel}</p></>
                    ) : (
                        <Button onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Seleziona audio</Button>
                    )}
                    <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) processAudio(e.target.files[0]); }} />
                </div>
                {processing && <div className="h-48 overflow-y-auto text-xs font-mono">{logs.map((m, i) => <div key={i}>{m}</div>)}</div>}
            </DialogContent>
        </Dialog>
    );
}
