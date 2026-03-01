import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles, Download, FileText, Save } from "lucide-react";
import { toast } from "sonner";
import { VerbaleHeader } from "./VerbaleHeader";
import { VerbaleAgenda } from "./VerbaleAgenda";
import { VerbaleCaseCard } from "./VerbaleCaseCard";
import { VerbaleFooter } from "./VerbaleFooter";
import { exportVerbaleDocx } from "@/lib/docx-export";
import { type ReportCase, type ReportData } from "@/lib/report-template";
import { resolveDisplayName } from "./SpeakerMappingCard";
import { getTranscription, saveTranscription, getSpeakers, type Speaker, type TranscriptSegment } from "@/lib/local-store";

interface VerbaleState {
  facilityName: string;
  meetingDate: string;
  startTime: string;
  selectedAttendees: string[];
  cases: ReportCase[];
  closingTime: string;
  nextMeetingDate: string;
  nextMeetingTime: string;
}

interface Props {
  segments: TranscriptSegment[];
  speakerMapping: Record<string, string>;
  transcriptionId: string;
  conversationDate: string;
}

export function VerbaleManager({ segments, speakerMapping, transcriptionId, conversationDate }: Props) {
  const speakers = getSpeakers();
  const [facilityName, setFacilityName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [closingTime, setClosingTime] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");
  const [nextMeetingTime, setNextMeetingTime] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const loadedRef = useRef(false);

  useEffect(() => {
    if (transcriptionId && !loadedRef.current) {
      loadedRef.current = true;
      const t = getTranscription(transcriptionId);
      if (t?.report_html) {
        try {
          const saved: VerbaleState = JSON.parse(t.report_html);
          if (saved.facilityName) setFacilityName(saved.facilityName);
          if (saved.meetingDate) setMeetingDate(saved.meetingDate);
          if (saved.startTime) setStartTime(saved.startTime);
          if (saved.selectedAttendees) setSelectedAttendees(saved.selectedAttendees);
          if (saved.cases) setCases(saved.cases);
          if (saved.closingTime) setClosingTime(saved.closingTime);
          if (saved.nextMeetingDate) setNextMeetingDate(saved.nextMeetingDate);
          if (saved.nextMeetingTime) setNextMeetingTime(saved.nextMeetingTime);
        } catch { /* ignore */ }
      }
    }
  }, [transcriptionId]);

  const getVerbaleState = useCallback((): VerbaleState => ({
    facilityName, meetingDate, startTime, selectedAttendees, cases, closingTime, nextMeetingDate, nextMeetingTime,
  }), [facilityName, meetingDate, startTime, selectedAttendees, cases, closingTime, nextMeetingDate, nextMeetingTime]);

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

  const addCase = () => {
    setCases((prev) => [...prev, { patientName: "", description: "", outcomeId: "", outcomeExtra: "", isNewClaim: false }]);
  };

  const removeCase = (i: number) => {
    setCases((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handlePopulateAll = async () => {
    if (segments.length === 0) {
      toast.error("Nessun segmento di trascrizione disponibile.");
      return;
    }

    setExtracting(true);
    if (conversationDate) setMeetingDate(conversationDate);
    const mappedSpeakerIds = Object.values(speakerMapping).filter(Boolean);
    if (mappedSpeakerIds.length > 0) setSelectedAttendees(mappedSpeakerIds);

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

      if (extracted.length === 0) {
        toast.warning("Nessun caso paziente identificato.");
      } else {
        setCases(extracted);
      }
      toast.success("Verbale popolato dalla trascrizione.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Errore nell'estrazione dei casi.");
    }
    setExtracting(false);
  };

  const buildReportData = useCallback((): ReportData => {
    const attendeeNames = selectedAttendees
      .map((id) => speakers.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => displayName(s!));

    return { facilityName, meetingDate, attendees: attendeeNames, cases, startTime, closingTime, nextMeetingDate, nextMeetingTime };
  }, [facilityName, meetingDate, selectedAttendees, cases, startTime, closingTime, nextMeetingDate, nextMeetingTime, speakers]);

  const handleExportDocx = async () => {
    const errors: Record<string, boolean> = {};
    const missingFields: string[] = [];
    if (!facilityName.trim()) { errors.facilityName = true; missingFields.push("Struttura Sanitaria"); }
    if (cases.length === 0) { errors.cases = true; missingFields.push("Pratiche (almeno una)"); }

    if (missingFields.length > 0) {
      setValidationErrors(errors);
      toast.error(`Campi obbligatori mancanti: ${missingFields.join(", ")}`);
      return;
    }

    setValidationErrors({});
    saveVerbale();
    const data = buildReportData();
    try {
      await exportVerbaleDocx(data);
      toast.success("Verbale DOCX generato e scaricato.");
    } catch (err: any) {
      console.error(err);
      toast.error("Errore nella generazione DOCX.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Genera Verbale</h2>
        </div>
        <Button variant="default" size="sm" onClick={handlePopulateAll} disabled={extracting || segments.length === 0} className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          {extracting ? "Popolamento…" : "Popola tutto con AI"}
        </Button>
      </div>

      <VerbaleHeader
        facilityName={facilityName}
        onFacilityChange={(v) => { setFacilityName(v); if (v.trim()) setValidationErrors((prev) => ({ ...prev, facilityName: false })); }}
        meetingDate={meetingDate}
        onMeetingDateChange={setMeetingDate}
        startTime={startTime}
        onStartTimeChange={setStartTime}
        selectedAttendees={selectedAttendees}
        onAttendeesChange={setSelectedAttendees}
        errors={validationErrors}
      />

      <VerbaleAgenda cases={cases} />

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase">Discussione Pratiche</h3>
          <Button variant="outline" size="sm" onClick={addCase} className="gap-1 text-xs">
            <Plus className="h-3 w-3" /> Aggiungi Pratica
          </Button>
        </div>

        {cases.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-4 text-center">
            Nessuna pratica. Usa "Popola tutto con AI" oppure aggiungi manualmente.
          </p>
        )}

        {cases.map((c, i) => (
          <VerbaleCaseCard key={i} caseData={c} index={i} canRemove={cases.length > 0} onChange={(field, value) => updateCase(i, field, value)} onRemove={() => removeCase(i)} />
        ))}
      </div>

      <VerbaleFooter
        closingTime={closingTime}
        onClosingTimeChange={setClosingTime}
        nextMeetingDate={nextMeetingDate}
        onNextMeetingDateChange={setNextMeetingDate}
        nextMeetingTime={nextMeetingTime}
        onNextMeetingTimeChange={setNextMeetingTime}
      />

      <div className="flex gap-2">
        <Button variant="secondary" onClick={saveVerbale} className="gap-1.5 flex-1" size="lg">
          <Save className="h-4 w-4" /> Salva Verbale
        </Button>
        <Button onClick={handleExportDocx} className="gap-2 flex-1" size="lg">
          <Download className="h-4 w-4" /> Genera DOCX
        </Button>
      </div>
    </div>
  );
}
