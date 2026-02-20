import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, Sparkles, AlertTriangle, Check, Trash2 } from "lucide-react";

interface TranscriptSegment {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
}

const TranscriptionEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [conversationDate, setConversationDate] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summary, setSummary] = useState("");
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagNotes, setFlagNotes] = useState("");
  const [problematicCaseId, setProblematicCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchTranscription();
  }, [id, user]);

  const fetchTranscription = async () => {
    setLoading(true);
    const [{ data: t, error }, { data: cases }] = await Promise.all([
      supabase.from("transcriptions").select("*").eq("id", id!).single(),
      supabase.from("problematic_cases").select("*").eq("transcription_id", id!),
    ]);
    if (error || !t) {
      toast.error("Transcription not found");
      navigate("/");
      return;
    }
    setConversationDate(t.conversation_date);
    setSegments((t.transcript_json as unknown as TranscriptSegment[]) || []);
    setSummary(t.summary || "");
    if (cases && cases.length > 0) {
      setIsFlagged(true);
      setFlagReason(cases[0].reason);
      setFlagNotes(cases[0].notes || "");
      setProblematicCaseId(cases[0].id);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("transcriptions")
      .update({
        conversation_date: conversationDate,
        transcript_json: segments as any,
        summary,
      })
      .eq("id", id!);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Saved successfully");
    }
    setSaving(false);
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const fullText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
      const { data, error } = await supabase.functions.invoke("summarize", {
        body: { text: fullText },
      });
      if (error) throw error;
      setSummary(data.summary);
      toast.success("Summary generated");
    } catch {
      toast.error("Summarization failed");
    }
    setSummarizing(false);
  };

  const updateSegment = (index: number, field: keyof TranscriptSegment, value: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const toggleFlag = async () => {
    if (isFlagged && problematicCaseId) {
      await supabase.from("problematic_cases").delete().eq("id", problematicCaseId);
      setIsFlagged(false);
      setProblematicCaseId(null);
      setFlagReason("");
      setFlagNotes("");
      toast.success("Flag removed");
    } else {
      const { data, error } = await supabase
        .from("problematic_cases")
        .insert({
          transcription_id: id!,
          user_id: user!.id,
          reason: flagReason || "Flagged for review",
        })
        .select()
        .single();
      if (error) {
        toast.error("Failed to flag");
        return;
      }
      setIsFlagged(true);
      setProblematicCaseId(data.id);
      toast.success("Flagged as problematic");
    }
  };

  const saveFlagDetails = async () => {
    if (!problematicCaseId) return;
    const { error } = await supabase
      .from("problematic_cases")
      .update({ reason: flagReason, notes: flagNotes })
      .eq("id", problematicCaseId);
    if (error) toast.error("Failed to update flag");
    else toast.success("Flag details saved");
  };

  const handleDelete = async () => {
    if (!confirm("Delete this transcription permanently?")) return;
    await supabase.from("transcriptions").delete().eq("id", id!);
    toast.success("Deleted");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6 max-w-4xl">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Conversation Date</label>
          <Input
            type="date"
            value={conversationDate}
            onChange={(e) => setConversationDate(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Flag section */}
        <Card className={isFlagged ? "border-destructive/40 bg-destructive/5" : "border-border/60"}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${isFlagged ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">
                  {isFlagged ? "Flagged as problematic" : "Flag this discussion"}
                </span>
              </div>
              <Button variant={isFlagged ? "destructive" : "outline"} size="sm" onClick={toggleFlag}>
                {isFlagged ? "Remove Flag" : "Flag"}
              </Button>
            </div>
            {isFlagged && (
              <div className="space-y-2">
                <Input
                  placeholder="Reason for flagging…"
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                />
                <Textarea
                  placeholder="Additional notes…"
                  value={flagNotes}
                  onChange={(e) => setFlagNotes(e.target.value)}
                  rows={2}
                />
                <Button variant="secondary" size="sm" onClick={saveFlagDetails}>
                  Save Flag Details
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Transcript</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No transcript segments.</p>
            ) : (
              segments.map((seg, i) => (
                <div key={i} className="flex gap-3 items-start group">
                  <Input
                    value={seg.speaker}
                    onChange={(e) => updateSegment(i, "speaker", e.target.value)}
                    className="w-32 shrink-0 text-sm font-medium"
                    placeholder="Speaker"
                  />
                  <Textarea
                    value={seg.text}
                    onChange={(e) => updateSegment(i, "text", e.target.value)}
                    className="flex-1 min-h-[40px] text-sm"
                    rows={1}
                  />
                  {seg.start != null && (
                    <Badge variant="secondary" className="text-xs shrink-0 mt-2">
                      {Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, "0")}
                    </Badge>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Summary</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSummarize}
              disabled={summarizing || segments.length === 0}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {summarizing ? "Generating…" : "Generate Summary"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Summary will appear here…"
              rows={5}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TranscriptionEditor;
