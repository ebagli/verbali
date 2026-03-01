import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, Square, Loader2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { saveTranscription, type Transcription, type TranscriptSegment } from "@/lib/local-store";

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

  const processAudio = async (blob: Blob | File) => {
    setProcessing(true);
    try {
      const audioFile = blob instanceof File ? blob : new File([blob], "recording.webm", { type: "audio/webm" });

      const formData = new FormData();
      formData.append("audio", audioFile);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Transcription failed" }));
        throw new Error(err.error || "Transcription failed");
      }

      const result = await response.json();
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
                className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${
                  recording
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
