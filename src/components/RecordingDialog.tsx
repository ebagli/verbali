import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey } from "@/lib/gemini";
import { saveTranscription, type TranscriptSegment } from "@/lib/local-store";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

const PROMPT = `Agisci come un trascrittore medico esperto. 
Trascrivi l'audio in italiano seguendo queste regole:
1. DIARIZZAZIONE: Identifica i diversi parlanti (speaker_0, speaker_1...).
2. TERMINOLOGIA: Usa i termini medici corretti (patologie, farmaci, anatomia).
3. FORMATO: Rispondi SOLO con JSON:
{
  "segments": [
    { "speaker": "speaker_0", "text": "...", "start": 0, "end": 5 }
  ]
}`;
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
        log(`Invio file (${(blob.size / 1024).toFixed(1)} KB)...`);
        const audioBase64 = await blobToBase64(blob);
        const result = await callGeminiWithAudio(audioBase64, mimeType, PROMPT);
        log(`Risposta ricevuta. Segmenti: ${result.segments?.length || 0}`);

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
        if (blob.size > 100 * 1024 * 1024) { toast.error("File troppo grande (max 100MB)."); return; }

        setProcessing(true); setLogs([]); log("Inizio...");
        try {
            log("Trascrizione diretta...");
            const segments = await transcribeChunk(blob, blob.type || "audio/mp3", 0);

            if (segments.length === 0) throw new Error("Nessuna trascrizione generata.");

            const id = crypto.randomUUID();
            saveTranscription({ id, created_at: new Date().toISOString(), conversation_date: new Date().toISOString().split("T")[0], transcript_json: segments, speaker_mapping: {}, summary: "", report_html: "" });
            toast.success("Fatto!");
            onComplete();
            navigate(`/transcription/${id}`);
        } catch (err: any) { log(`ERRORE: ${err.message}`); toast.error("Elaborazione fallita: " + err.message); }
        setProcessing(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Carica Audio</DialogTitle></DialogHeader>
                <div className="flex flex-col items-center gap-6 py-8">
                    {processing ? (
                        <><Loader2 className="animate-spin h-16 w-16" /><p>{processingLabel}</p></>
                    ) : (
                        <Button onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Seleziona audio (max 100MB)</Button>
                    )}
                    <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) processAudio(e.target.files[0]); }} />
                </div>
                {processing && <div className="h-48 overflow-y-auto text-xs font-mono">{logs.map((m, i) => <div key={i}>{m}</div>)}</div>}
            </DialogContent>
        </Dialog>
    );
}
