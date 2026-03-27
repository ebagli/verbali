import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio, hasGeminiApiKey } from "@/lib/gemini";
import { saveTranscription, type TranscriptSegment } from "@/lib/local-store";
import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: () => void;
}

const PROMPT = `Trascrivi l'audio in italiano. Rispondi SOLO con JSON {"segments": [{"speaker": "...", "text": "...", "start": 0, "end": 5}]}`;

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
    const navigate = useNavigate();
    const [processing, setProcessing] = useState(false);
    const [processingLabel, setProcessingLabel] = useState("Trascrizione in corso…");
    const [logs, setLogs] = useState<string[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const log = (message: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);

    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    const processFiles = async () => {
        if (!hasGeminiApiKey()) { toast.error("Configura API Key."); return; }

        setProcessing(true); setLogs([]); log("Inizio...");
        try {
            let allSegments: TranscriptSegment[] = [];
            const files = [...selectedFiles].sort((a, b) => a.name.localeCompare(b.name));

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setProcessingLabel(`Trascrizione ${i + 1}/${files.length}: ${file.name}`);
                log(`Invio ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);

                const audioBase64 = await blobToBase64(file);
                const timeOffset = i * 1800; // offset approssimato 30min

                const result = await callGeminiWithAudio(audioBase64, file.type || "audio/mp3", PROMPT);

                if (result.segments && Array.isArray(result.segments)) {
                    allSegments.push(...result.segments.map((s: any) => ({
                        speaker: s.speaker || "speaker_0", text: s.text || "",
                        start: (Number(s.start) || 0) + timeOffset, end: (Number(s.end) || 0) + timeOffset,
                    })));
                } else {
                    const transcript = result.transcript || result.text || (typeof result === 'string' ? result : "");
                    if (transcript) allSegments.push({ speaker: "speaker_0", text: transcript, start: timeOffset, end: timeOffset + 1800 });
                }
            }

            if (allSegments.length === 0) throw new Error("Nessuna trascrizione generata.");

            const id = crypto.randomUUID();
            saveTranscription({ id, created_at: new Date().toISOString(), conversation_date: new Date().toISOString().split("T")[0], transcript_json: allSegments, speaker_mapping: {}, summary: "", report_html: "" });
            toast.success("Fatto!");
            onComplete();
            navigate(`/transcription/${id}`);
        } catch (err: any) { log(`ERRORE: ${err.message}`); toast.error("Elaborazione fallita."); }
        setProcessing(false);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Carica file riunione</DialogTitle></DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Aggiungi file audio</Button>
                    <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => {
                        if (e.target.files) setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                    }} />

                    <div className="max-h-40 overflow-y-auto border rounded-md p-2 text-sm">
                        {selectedFiles.map((f, i) => (
                            <div key={i} className="flex justify-between items-center py-1">
                                <span>{f.name}</span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>

                    {selectedFiles.length > 0 && <Button onClick={processFiles} disabled={processing} className="w-full">Trascrivi tutto</Button>}
                </div>
                {processing && <div className="h-48 overflow-y-auto text-xs font-mono">{logs.map((m, i) => <div key={i}>{m}</div>)}</div>}
            </DialogContent>
        </Dialog>
    );
}
