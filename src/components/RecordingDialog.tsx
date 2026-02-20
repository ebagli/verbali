import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function RecordingDialog({ open, onOpenChange, onComplete }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
      toast.error("Microphone access denied");
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }, []);

  const processAudio = async (blob: Blob) => {
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Transcription failed");
      const result = await response.json();

      // Build segments from ElevenLabs response
      const segments = (result.words || []).reduce((acc: any[], word: any) => {
        const speaker = word.speaker || "Speaker 1";
        const last = acc[acc.length - 1];
        if (last && last.speaker === speaker) {
          last.text += " " + word.text;
          last.end = word.end;
        } else {
          acc.push({ speaker, text: word.text, start: word.start, end: word.end });
        }
        return acc;
      }, []);

      // If no word-level data, use full text
      const finalSegments = segments.length > 0
        ? segments
        : [{ speaker: "Speaker 1", text: result.text || "", start: 0, end: 0 }];

      // Save to database
      const { data, error } = await supabase
        .from("transcriptions")
        .insert({
          user_id: user!.id,
          transcript_json: finalSegments as any,
          conversation_date: new Date().toISOString().split("T")[0],
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Transcription saved!");
      onComplete();
      navigate(`/transcription/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || "Processing failed");
    }
    setProcessing(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Audio</DialogTitle>
          <DialogDescription>
            Record a conversation and it will be automatically transcribed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-8">
          {processing ? (
            <>
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Transcribing audio…</p>
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
                {recording ? "Recording… Click to stop" : "Click to start recording"}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
