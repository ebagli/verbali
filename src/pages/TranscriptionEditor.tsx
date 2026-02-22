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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertTriangle, Trash2, Plus, X } from "lucide-react";
import { SpeakerMappingCard, resolveDisplayName } from "@/components/SpeakerMappingCard";
import { VerbaleManager } from "@/components/VerbaleManager";

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
  const [conversationDate, setConversationDate] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [speakerMapping, setSpeakerMapping] = useState<Record<string, string>>({});
  const [speakers, setSpeakers] = useState<{ id: string; full_name: string; title: string }[]>([]);
  const [isFlagged, setIsFlagged] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flagNotes, setFlagNotes] = useState("");
  const [problematicCaseId, setProblematicCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchTranscription();
    fetchSpeakers();
  }, [id, user]);

  const fetchSpeakers = async () => {
    const { data } = await supabase.from("speakers").select("id, full_name, title").order("full_name");
    if (data) setSpeakers(data);
  };

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
    setSpeakerMapping(((t as any).speaker_mapping as Record<string, string>) || {});
    if (cases && cases.length > 0) {
      setIsFlagged(true);
      setFlagReason(cases[0].reason);
      setFlagNotes(cases[0].notes || "");
      setProblematicCaseId(cases[0].id);
    }
    setLoading(false);
  };

  const getDisplayName = (label: string) => resolveDisplayName(label, speakerMapping, speakers);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("transcriptions")
      .update({
        conversation_date: conversationDate,
        transcript_json: segments as any,
        speaker_mapping: speakerMapping,
      } as any)
      .eq("id", id!);
    if (error) toast.error("Failed to save");
    else toast.success("Salvato con successo");
    setSaving(false);
  };

  const updateSegment = (index: number, field: keyof TranscriptSegment, value: string) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const addSegment = (afterIndex?: number) => {
    const newSeg: TranscriptSegment = { speaker: "speaker_0", text: "" };
    setSegments((prev) => {
      if (afterIndex !== undefined) {
        const copy = [...prev];
        copy.splice(afterIndex + 1, 0, newSeg);
        return copy;
      }
      return [...prev, newSeg];
    });
  };

  const removeSegment = (index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
  };

  // Collect all unique speaker labels from segments
  const uniqueSpeakers = Array.from(new Set(segments.map((s) => s.speaker))).sort();

  const toggleFlag = async () => {
    if (isFlagged && problematicCaseId) {
      await supabase.from("problematic_cases").delete().eq("id", problematicCaseId);
      setIsFlagged(false);
      setProblematicCaseId(null);
      setFlagReason("");
      setFlagNotes("");
      toast.success("Flag rimosso");
    } else {
      const { data, error } = await supabase
        .from("problematic_cases")
        .insert({
          transcription_id: id!,
          user_id: user!.id,
          reason: flagReason || "Segnalato per revisione",
        })
        .select()
        .single();
      if (error) {
        toast.error("Errore nella segnalazione");
        return;
      }
      setIsFlagged(true);
      setProblematicCaseId(data.id);
      toast.success("Segnalato come problematico");
    }
  };

  const saveFlagDetails = async () => {
    if (!problematicCaseId) return;
    const { error } = await supabase
      .from("problematic_cases")
      .update({ reason: flagReason, notes: flagNotes })
      .eq("id", problematicCaseId);
    if (error) toast.error("Errore aggiornamento segnalazione");
    else toast.success("Dettagli segnalazione salvati");
  };

  const handleDelete = async () => {
    if (!confirm("Eliminare questa trascrizione in modo permanente?")) return;
    await supabase.from("transcriptions").delete().eq("id", id!);
    toast.success("Eliminato");
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
            <ArrowLeft className="h-4 w-4" /> Indietro
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Elimina
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              <Save className="h-3.5 w-3.5" /> {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">Data Conversazione</label>
          <Input
            type="date"
            value={conversationDate}
            onChange={(e) => setConversationDate(e.target.value)}
            className="max-w-xs"
          />
        </div>

        {/* Speaker Mapping */}
        <SpeakerMappingCard
          segments={segments}
          mapping={speakerMapping}
          onMappingChange={setSpeakerMapping}
        />

        {/* Flag section */}
        <Card className={isFlagged ? "border-destructive/40 bg-destructive/5" : "border-border/60"}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${isFlagged ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">
                  {isFlagged ? "Segnalato come problematico" : "Segnala questa discussione"}
                </span>
              </div>
              <Button variant={isFlagged ? "destructive" : "outline"} size="sm" onClick={toggleFlag}>
                {isFlagged ? "Rimuovi Segnalazione" : "Segnala"}
              </Button>
            </div>
            {isFlagged && (
              <div className="space-y-2">
                <Input placeholder="Motivo della segnalazione…" value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
                <Textarea placeholder="Note aggiuntive…" value={flagNotes} onChange={(e) => setFlagNotes(e.target.value)} rows={2} />
                <Button variant="secondary" size="sm" onClick={saveFlagDetails}>
                  Salva Dettagli Segnalazione
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Trascrizione</CardTitle>
            <Button variant="outline" size="sm" onClick={() => addSegment()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Aggiungi Segmento
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Nessun segmento di trascrizione.</p>
            ) : (
              segments.map((seg, i) => (
                <div key={i} className="flex gap-3 items-start group">
                  <div className="w-40 shrink-0 space-y-1">
                    <Select
                      value={seg.speaker}
                      onValueChange={(val) => {
                        if (val === "__new__") {
                          const nextIndex = uniqueSpeakers.filter((s) => s.startsWith("speaker_")).length;
                          updateSegment(i, "speaker", `speaker_${nextIndex}`);
                        } else {
                          updateSegment(i, "speaker", val);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueSpeakers.map((spk) => (
                          <SelectItem key={spk} value={spk}>
                            {spk} {speakerMapping[spk] ? `(${getDisplayName(spk)})` : ""}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Nuovo speaker</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground block truncate">{getDisplayName(seg.speaker)}</span>
                  </div>
                  <Textarea
                    value={seg.text}
                    onChange={(e) => updateSegment(i, "text", e.target.value)}
                    className="flex-1 min-h-[40px] text-sm"
                    rows={1}
                  />
                  <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                    {seg.start != null && (
                      <Badge variant="secondary" className="text-xs">
                        {Math.floor(seg.start / 60)}:{String(Math.floor(seg.start % 60)).padStart(2, "0")}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      onClick={() => removeSegment(i)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Verbale Generator */}
        <VerbaleManager
          segments={segments}
          speakerMapping={speakerMapping}
        />
      </main>
    </div>
  );
};

export default TranscriptionEditor;
