import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { callGeminiWithAudio } from "@/lib/gemini";
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

const PROMPT = `
Agisci come un trascrittore medico esperto. 
Trascrivi l'intera seduta medica in italiano seguendo queste regole:
1. DIARIZZAZIONE: Identifica i diversi parlanti (speaker_0, speaker_1...).
2. TERMINOLOGIA: Usa i termini medici corretti.
3. COMPATTAZIONE (IMPORTANTE): Non creare segmenti di pochi secondi. Accorpa tutto il discorso continuo di uno stesso parlante in un UNICO lungo segmento finché non viene interrotto da un altro parlante.
4. PARSIMONIA: Evita di creare segmenti con poche parole. Se un parlante dice solo "Sì" o "No", accorpalo al segmento precedente se è dello stesso parlante, altrimenti accorpalo al segmento successivo. Rimuovi i sospiri o rumori non verbali se non sono significativi.
5. TEMPORIZZAZIONE: Assegna a ogni segmento un timestamp di inizio e fine basato sull'audio, anche se i segmenti sono lunghi.
6. FORMATO: Rispondi ESCLUSIVAMENTE con un oggetto JSON valido.

Struttura JSON richiesta:
{
  "segments": [
    { "speaker": "speaker_0", "text": "testo trascritto...", "start": 0, "end": 5 }
  ]
}`;

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
    const navigate = useNavigate();
    const [processing, setProcessing] = useState(false);
    const [processingLabel, setProcessingLabel] = useState("Inizializzazione…");
    const [logs, setLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const log = (message: string) => {
        setLogs(prev => {
            const newLogs = [...prev, `[${new Date().toLocaleTimeString()}] ${message}`];
            return newLogs.slice(-50);
        });
    };

    // Converte il Blob in Base64
    const blobToBase64 = (blob: Blob): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                resolve(result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

    // Processo principale di lettura e invio singolo
    const processAudio = async (blob: Blob | File) => {
        // Limite impostato a 25 MB
        if (blob.size > 25 * 1024 * 1024) {
            toast.error("Il file è troppo grande. Limite massimo: 25MB.");
            return;
        }

        setProcessing(true);
        setLogs([]);
        log(`Inizio elaborazione. Dimensione totale: ${(blob.size / (1024 * 1024)).toFixed(2)} MB`);

        try {
            setProcessingLabel("Lettura file audio...");
            const audioBase64 = await blobToBase64(blob);

            setProcessingLabel("Trascrizione AI in corso...");
            log("Elaborazione in corso. Questa operazione può richiedere alcuni minuti...");

            const result = await callGeminiWithAudio(audioBase64, blob.type || "audio/mp3", PROMPT);

            if (!result || !result.segments || !Array.isArray(result.segments) || result.segments.length === 0) {
                throw new Error("L'intelligenza artificiale non ha restituito alcun testo utile.");
            }

            log(`Risposta ricevuta: ${result.segments.length} segmenti trascritti.`);

            const allSegments: TranscriptSegment[] = result.segments.map((s: any) => ({
                speaker: s.speaker || "speaker_0",
                text: s.text || "",
                start: Number(s.start) || 0,
                end: Number(s.end) || 0,
            }));

            setProcessingLabel("Salvataggio dati...");

            // Salvataggio nel database locale
            const id = crypto.randomUUID();
            saveTranscription({
                id,
                created_at: new Date().toISOString(),
                conversation_date: new Date().toISOString().split("T")[0],
                transcript_json: allSegments,
                speaker_mapping: {},
                summary: "",
                report_html: ""
            });

            toast.success("Trascrizione completata con successo!");
            onComplete();
            navigate(`/transcription/${id}`);

        } catch (err: any) {
            log(`ERRORE FATALE: ${err.message}`);
            toast.error("Elaborazione fallita: " + err.message);
        } finally {
            setProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // Resetta l'input
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !processing && onOpenChange(o)}>
            <DialogContent className="sm:max-w-md bg-white">
                <DialogHeader>
                    <DialogTitle>Carica Audio per Verbale</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-6 py-6">
                    {processing ? (
                        <div className="flex flex-col items-center gap-4 w-full">
                            <Loader2 className="animate-spin h-12 w-12 text-primary" />
                            <div className="text-center">
                                <p className="font-semibold text-lg text-primary">{processingLabel}</p>
                                <p className="text-sm text-muted-foreground mt-1">Non chiudere l'applicazione</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full">
                            <Button
                                variant="outline"
                                className="w-full h-32 border-2 border-dashed border-slate-300 hover:border-primary/50 hover:bg-slate-50 flex flex-col gap-3 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <Upload className="h-8 w-8 text-slate-400" />
                                <div className="text-center">
                                    <p className="text-sm font-medium text-slate-700">Clicca per selezionare un file audio</p>
                                    <p className="text-xs text-slate-500 mt-1">MP3, WAV, M4A (max 25MB)</p>
                                </div>
                            </Button>
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) processAudio(file);
                        }}
                    />
                </div>

                {processing && (
                    <div className="mt-2 h-48 overflow-y-auto text-[11px] font-mono bg-slate-950 text-green-400 p-3 rounded-md border border-slate-800 shadow-inner flex flex-col-reverse">
                        <div>
                            {logs.map((m, i) => (
                                <div key={i} className="mb-1">{m}</div>
                            ))}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}