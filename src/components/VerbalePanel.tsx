import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Plus, Sparkles, Download, FileText, Save, Clock, Building2, Users, ListOrdered, MessageSquare, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { VerbaleCaseCard } from "./VerbaleCaseCard";
import { exportVerbaleDocx } from "@/lib/docx-export";
import { type ReportCase, type ReportData } from "@/lib/report-template";
import { resolveDisplayName } from "./SpeakerMappingCard";
import { getTranscription, saveTranscription, getSpeakers, type Speaker, type TranscriptSegment, type VerbaleState } from "@/lib/local-store";

interface Props {
  segments: TranscriptSegment[];
  speakerMapping: Record<string, string>;
  transcriptionId: string;
  conversationDate: string;
  includeTranscript: boolean;
}

export function VerbalePanel({ segments, speakerMapping, transcriptionId, conversationDate, includeTranscript }: Props) {
  const speakers = getSpeakers();
  const [title, setTitle] = useState("Verbale Comitato Valutazione Sinistri");
  const [facilityName, setFacilityName] = useState("");
  const [location, setLocation] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [generalDiscussion, setGeneralDiscussion] = useState("");
  const [closingDecisions, setClosingDecisions] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [nextMeetingTime, setNextMeetingTime] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const loadedRef = useRef(false);

  // Unique speakers from segments as attendee chips
  const segmentSpeakers = Array.from(new Set(segments.map((s) => s.speaker))).sort();

  useEffect(() => {
    if (transcriptionId && !loadedRef.current) {
      loadedRef.current = true;
      const t = getTranscription(transcriptionId);
      if (t?.report_html) {
        try {
          const saved: VerbaleState = JSON.parse(t.report_html);
          if (saved.title) setTitle(saved.title);
          if (saved.facilityName) setFacilityName(saved.facilityName);
          if (saved.location) setLocation(saved.location);
          if (saved.meetingDate) setMeetingDate(saved.meetingDate);
          if (saved.startTime) setStartTime(saved.startTime);
          if (saved.selectedAttendees) setSelectedAttendees(saved.selectedAttendees);
          if (saved.cases) setCases(saved.cases);
          if (saved.generalDiscussion) setGeneralDiscussion(saved.generalDiscussion);
          if (saved.closingDecisions) setClosingDecisions(saved.closingDecisions);
          if (saved.nextMeetingDate) setNextMeetingDate(saved.nextMeetingDate);
          if (saved.nextMeetingTime) setNextMeetingTime(saved.nextMeetingTime);
        } catch { /* ignore */ }
      }
    }
  }, [transcriptionId]);

  const getVerbaleState = useCallback((): VerbaleState => ({
    title, facilityName, location, meetingDate, startTime, selectedAttendees, cases, generalDiscussion, closingDecisions, closingTime: "", nextMeetingDate, nextMeetingTime,
  }), [title, facilityName, location, meetingDate, startTime, selectedAttendees, cases, generalDiscussion, closingDecisions, nextMeetingDate, nextMeetingTime]);

  const saveVerbale = useCallback(() => {
    const t = getTranscription(transcriptionId);
    if (!t) return;
    saveTranscription({ ...t, report_html: JSON.stringify(getVerbaleState()) });
    toast.success("Verbale salvato.");
  }, [transcriptionId, getVerbaleState]);

  const displayName = (s: Speaker) => (s.title ? `${s.title} ${s.full_name}` : s.full_name);

  const updateCase = (i: number, field: keyof ReportCase, value: string | boolean) => {
    setCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };
  const addCase = () => setCases((prev) => [...prev, { patientName: "", description: "", outcomeId: "", outcomeExtra: "", isNewClaim: false }]);
  const removeCase = (i: number) => setCases((prev) => prev.filter((_, idx) => idx !== i));

  const handleAutoFill = async () => {
    if (segments.length === 0) {
      toast.error("Nessun segmento disponibile.");
      return;
    }
    setExtracting(true);
    if (conversationDate) setMeetingDate(conversationDate);
    // Auto-add segment speakers as attendees
    setSelectedAttendees(segmentSpeakers);

    try {
      const fullText = segments
        .map((s) => {
          const name = resolveDisplayName(s.speaker, speakerMapping, speakers);
          return `${name}: ${s.text}`;
        })
        .join("\n");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-cases`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ transcript_text: fullText }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Extraction failed" }));
        throw new Error(err.error || "Extraction failed");
      }

      const data = await response.json();
      const extracted: ReportCase[] = (data.cases || []).map((c: any) => ({
        patientName: c.patient_name || "",
        description: c.description || "",
        outcomeId: c.suggested_outcome || "",
        outcomeExtra: "",
        isNewClaim: c.is_new_claim || false,
      }));

      if (extracted.length === 0) toast.warning("Nessun caso identificato.");
      else setCases(extracted);
      toast.success("Compilato automaticamente.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore nell'estrazione.");
    }
    setExtracting(false);
  };

  const handleExportDocx = async () => {
    const errors: Record<string, boolean> = {};
    const missingFields: string[] = [];
    if (!facilityName.trim()) { errors.facilityName = true; missingFields.push("Struttura"); }
    if (cases.length === 0) { errors.cases = true; missingFields.push("Pratiche (almeno una)"); }
    if (missingFields.length > 0) {
      setValidationErrors(errors);
      toast.error(`Campi mancanti: ${missingFields.join(", ")}`);
      return;
    }
    setValidationErrors({});
    saveVerbale();

    const attendeeNames = selectedAttendees.map((spk) => {
      const mappedId = speakerMapping[spk];
      if (mappedId) {
        const s = speakers.find((sp) => sp.id === mappedId);
        if (s) return displayName(s);
      }
      return spk;
    });

    const data: ReportData = {
      facilityName, meetingDate, attendees: attendeeNames, cases, startTime,
      closingTime: "", nextMeetingDate, nextMeetingTime,
    };
    try {
      await exportVerbaleDocx(data);
      toast.success("DOCX generato.");
    } catch (err: any) {
      toast.error("Errore generazione DOCX.");
    }
  };

  const toggleAttendee = (spk: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(spk) ? prev.filter((a) => a !== spk) : [...prev, spk]
    );
  };

  const addNewAttendee = () => {
    const name = prompt("Nome partecipante:");
    if (name?.trim()) {
      const label = name.trim().toLowerCase().replace(/\s+/g, "_");
      setSelectedAttendees((prev) => [...prev, label]);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Verbale</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoFill} disabled={extracting || segments.length === 0} className="gap-1.5 text-xs">
            <Sparkles className="h-3.5 w-3.5" />
            {extracting ? "Compilazione…" : "Compila automaticamente"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportDocx} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Esporta DOCX
          </Button>
        </div>
      </div>

      {/* INTESTAZIONE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Intestazione
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Titolo</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Verbale Comitato Valutazione Sinistri" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Struttura</label>
              <Input value={facilityName} onChange={(e) => { setFacilityName(e.target.value); if (e.target.value.trim()) setValidationErrors((p) => ({...p, facilityName: false})); }} placeholder="Nome della struttura..." className={validationErrors.facilityName ? "border-destructive ring-1 ring-destructive" : ""} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Data Incontro</label>
              <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Luogo</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Inizio Lavori</label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PARTECIPANTI */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4" /> Partecipanti
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addNewAttendee} className="text-xs gap-1 h-7">
            <Plus className="h-3 w-3" /> Nuovo
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {segmentSpeakers.map((spk) => {
              const mappedId = speakerMapping[spk];
              const speaker = mappedId ? speakers.find((s) => s.id === mappedId) : null;
              const label = speaker ? displayName(speaker) : spk;
              return (
                <Button
                  key={spk}
                  variant={selectedAttendees.includes(spk) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleAttendee(spk)}
                  className="text-xs"
                >
                  {label}
                </Button>
              );
            })}
            {/* Show additional attendees not in segments */}
            {selectedAttendees.filter((a) => !segmentSpeakers.includes(a)).map((a) => (
              <Button key={a} variant="default" size="sm" onClick={() => toggleAttendee(a)} className="text-xs">
                {a}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ORDINE DEL GIORNO */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> Ordine del Giorno
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cases.filter((c) => c.patientName).length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Nessuna casistica inserita</p>
          ) : (
            <ul className="list-disc list-inside space-y-0.5">
              {cases.filter((c) => c.patientName).map((c, i) => (
                <li key={i} className="text-sm">{c.patientName}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* DISCUSSIONE GENERALE */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Discussione Generale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AutoResizeTextarea
            value={generalDiscussion}
            onChange={(e) => setGeneralDiscussion(e.target.value)}
            placeholder="Sintesi della discussione generale..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* ESAME CASISTICA */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" /> Esame Casistica
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addCase} className="text-xs gap-1 h-7">
            <Plus className="h-3 w-3" /> Aggiungi Casistica
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {cases.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-4">
              Nessuna casistica. Usa "Compila automaticamente" o aggiungi manualmente.
            </p>
          )}
          {cases.map((c, i) => (
            <VerbaleCaseCard key={i} caseData={c} index={i} canRemove onChange={(field, value) => updateCase(i, field, value)} onRemove={() => removeCase(i)} />
          ))}
        </CardContent>
      </Card>

      {/* CHIUSURA E DECISIONI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Chiusura e Decisioni
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AutoResizeTextarea
            value={closingDecisions}
            onChange={(e) => setClosingDecisions(e.target.value)}
            placeholder="Decisioni prese e azioni da intraprendere..."
            className="min-h-[100px]"
          />
        </CardContent>
      </Card>

      {/* PROSSIMO INCONTRO */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Prossimo Incontro Data</label>
          <Input type="date" value={nextMeetingDate} onChange={(e) => setNextMeetingDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Prossimo Incontro Ore</label>
          <Input type="time" value={nextMeetingTime} onChange={(e) => setNextMeetingTime(e.target.value)} />
        </div>
      </div>

      {/* Save button */}
      <Button variant="secondary" onClick={saveVerbale} className="w-full gap-1.5" size="lg">
        <Save className="h-4 w-4" /> Salva Verbale
      </Button>
    </div>
  );
}
