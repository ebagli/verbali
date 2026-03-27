import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { exportVerbaleDocx } from "@/lib/docx-export";
import { callGemini, hasGeminiApiKey, parseGeminiJson } from "@/lib/gemini";
import { addSpeaker, createPersistentCase, getPersistentCases, getSpeakers, getTranscription, saveTranscription, updatePersistentCase, type Speaker, type TranscriptSegment, type VerbaleState } from "@/lib/local-store";
import { type ReportCase, type ReportData } from "@/lib/report-template";
import { Building2, CheckCircle, Clock, Download, FileText, MessageSquare, Plus, Sparkles, Users } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { resolveDisplayName } from "./SpeakerMappingCard";
import { VerbaleCaseCard } from "./VerbaleCaseCard";

interface Props {
  segments: TranscriptSegment[];
  speakerMapping: Record<string, string>;
  transcriptionId: string;
  conversationDate: string;
}

export const VerbalePanel = forwardRef<{ getVerbaleState: () => VerbaleState }, Props>(function VerbalePanel({ segments, speakerMapping, transcriptionId, conversationDate }, ref) {
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
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const loadedRef = useRef(false);
  const [persistentCases, setPersistentCases] = useState<{ id: string; patient_name: string; is_open: boolean }[]>([]);

  useEffect(() => {
    setPersistentCases(getPersistentCases());
  }, []);

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

  const getVerbaleState = useCallback((): VerbaleState => {
    const updatedCases = cases.map((c) => {
      if (!c.caseId && c.patientName.trim()) {
        const newId = createPersistentCase(c.patientName.trim(), c.isOpen);
        return { ...c, caseId: newId };
      }
      return c;
    });
    return { title, facilityName, location, meetingDate, startTime, selectedAttendees, cases: updatedCases, generalDiscussion, closingDecisions, closingTime: "", nextMeetingDate, nextMeetingTime };
  }, [title, facilityName, location, meetingDate, startTime, selectedAttendees, cases, generalDiscussion, closingDecisions, nextMeetingDate, nextMeetingTime]);

  useImperativeHandle(ref, () => ({ getVerbaleState }), [getVerbaleState]);

  const saveVerbale = useCallback(() => {
    const t = getTranscription(transcriptionId);
    if (!t) return;

    const updatedCases = [...cases];
    for (let i = 0; i < updatedCases.length; i++) {
      const c = updatedCases[i];
      if (!c.caseId && c.patientName.trim()) {
        const newId = createPersistentCase(c.patientName.trim(), c.isOpen);
        updatedCases[i] = { ...c, caseId: newId };
      } else if (c.caseId) {
        updatePersistentCase(c.caseId, { is_open: c.isOpen });
      }
    }
    setCases(updatedCases);

    const state = { ...getVerbaleState(), cases: updatedCases };
    saveTranscription({ ...t, report_html: JSON.stringify(state) });
    setPersistentCases(getPersistentCases());
    toast.success("Verbale salvato.");
  }, [transcriptionId, getVerbaleState, cases]);

  const displayName = (s: Speaker) => (s.title ? `${s.title} ${s.full_name}` : s.full_name);

  const updateCase = (i: number, field: keyof ReportCase, value: string | boolean) => {
    setCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };
  const addCase = () => setCases((prev) => [...prev, { patientName: "", description: "", outcomeId: "", outcomeExtra: "", isOpen: true, caseId: "" }]);
  const removeCase = (i: number) => setCases((prev) => prev.filter((_, idx) => idx !== i));

  const matchCasesToPersistent = (extracted: ReportCase[], existing: { id: string; patient_name: string; is_open: boolean }[]): ReportCase[] => {
    return extracted.map((c) => {
      const nameNorm = c.patientName.trim().toUpperCase();
      const match = existing.find((pc) => pc.patient_name.trim().toUpperCase() === nameNorm);
      return { ...c, caseId: match?.id || "" };
    });
  };

  const handleCreateNewCase = (index: number) => {
    const c = cases[index];
    if (!c.patientName.trim()) { toast.error("Inserire il nome del paziente"); return; }
    const newId = createPersistentCase(c.patientName.trim(), c.isOpen);
    setCases((prev) => prev.map((cc, i) => i === index ? { ...cc, caseId: newId } : cc));
    setPersistentCases((prev) => [...prev, { id: newId, patient_name: c.patientName.trim(), is_open: c.isOpen }]);
    toast.success("Caso creato e collegato");
  };

  const handleAutoFill = async () => {
    if (segments.length === 0) {
      toast.error("Nessun segmento disponibile.");
      return;
    }
    if (!hasGeminiApiKey()) {
      toast.error("Configura la chiave API Gemini nelle impostazioni (sidebar).");
      return;
    }
    setExtracting(true);
    if (conversationDate) setMeetingDate(conversationDate);
    setSelectedAttendees(segmentSpeakers);

    try {
      const fullText = segments
        .map((s) => {
          const name = resolveDisplayName(s.speaker, speakerMapping, speakers);
          return `${name}: ${s.text}`;
        })
        .join("\n");

      const systemPrompt = `Sei un assistente legale esperto in malpractice sanitaria e gestione sinistri(CVS). 

        IL TUO COMPITO ASSOLUTO:
        Leggi attentamente il copione della seduta medica.Devi estrarre TUTTI i pazienti / pratiche nominate.Ci sono circa 15 - 16 casi in questo testo.NON tralasciarne nessuno, anche se menzionati per pochi secondi o solo per questioni amministrative / spese legali.

        REGOLE DI ESTRAZIONE JSON:
        1. patient_name: "COGNOME NOME"(es.FERRETTI SERGIO, POETA PIERO).Se ignoto: "IGNOTO".
        2. description: Breve riassunto di ciò che si dice del caso.Se c'è la dinamica clinica scrivila (dinamica, profili colpa), se invece si parla solo di spese legali, transazioni o ATP, scrivi solo quello. Non devi forzatamente scrivere 5 frasi se i dati non ci sono.
        3. is_open: true(default ), false solo se esplicitamente detto che è chiuso / archiviato(es.Bivona).
        4. suggested_outcome: Scegli SOLO tra["istruttoria", "riserva", "prematuro", "sviluppi", "archiviazione", "proposta_transattiva"].Se non sai cosa mettere, usa "sviluppi".
        5. outcome_extra: Inserisci qui il valore della riserva economica se menzionato(es. "Riserva 500.000 euro", "Riserva zero").

        REQUISITI TECNICI:
        - Rispondi SOLO con JSON valido.Niente markdown.
        - L'array "cases" DEVE contenere tutti i pazienti trovati.;

        STRUTTURA JSON RICHIESTA:
      {
        "cases": [
          {
            "patient_name": "STRING",
            "description": "STRING",
            "is_open": BOOLEAN,
            "suggested_outcome": "STRING",
            "outcome_extra": "STRING"
          }
        ],
          "facility_name": "STRING",
            "meeting_location": "STRING",
              "start_time": "HH:MM",
                "closing_time": "HH:MM",
                  "general_discussion": "STRING",
                    "next_meeting_date": "YYYY-MM-DD",
                      "next_meeting_time": "HH:MM"
      } `;

      const finalPrompt = `${systemPrompt} \n\n<TRASCRIZIONE>\n${fullText} \n</TRASCRIZIONE > `;
      const responseText = await callGemini(finalPrompt);
      const data = parseGeminiJson(responseText);

      const extracted: ReportCase[] = (data.cases || []).map((c: any) => ({
        patientName: c.patient_name || "",
        description: c.description || "",
        outcomeId: c.suggested_outcome || "",
        outcomeExtra: c.outcome_extra || "",
        isOpen: c.is_open !== false,
        caseId: "",
      }));

      const matched = matchCasesToPersistent(extracted, persistentCases);

      if (matched.length === 0) toast.warning("Nessun caso identificato.");
      else {
        setCases(matched);
        const matchedCount = matched.filter(c => c.caseId).length;
        if (matchedCount > 0) toast.info(`${matchedCount} casi collegati automaticamente a casi esistenti.`);
      }

      if (data.facility_name && !facilityName) setFacilityName(data.facility_name);
      if (data.meeting_location && !location) setLocation(data.meeting_location);
      if (data.start_time && !startTime) setStartTime(data.start_time);
      if (data.general_discussion && !generalDiscussion) setGeneralDiscussion(data.general_discussion);
      if (data.next_meeting_date && !nextMeetingDate) setNextMeetingDate(data.next_meeting_date);
      if (data.next_meeting_time && !nextMeetingTime) setNextMeetingTime(data.next_meeting_time);

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
      toast.error(`Campi mancanti: ${missingFields.join(", ")} `);
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

  const toggleAttendeeGroup = (speakerLabels: string[]) => {
    setSelectedAttendees((prev) => {
      const anySelected = speakerLabels.some((spk) => prev.includes(spk));
      if (anySelected) {
        return prev.filter((a) => !speakerLabels.includes(a));
      } else {
        return [...prev, ...speakerLabels.filter((spk) => !prev.includes(spk))];
      }
    });
  };

  const isSelected = (speakerLabels: string[]) => speakerLabels.some((spk) => selectedAttendees.includes(spk));

  const uniqueAttendeeEntries = (() => {
    const seen = new Map<string, { label: string; speakerLabels: string[] }>();
    for (const spk of segmentSpeakers) {
      const mappedId = speakerMapping[spk];
      const key = mappedId || spk;
      const speaker = mappedId ? speakers.find((s) => s.id === mappedId) : null;
      const label = speaker ? displayName(speaker) : spk;
      if (!seen.has(key)) {
        seen.set(key, { label, speakerLabels: [spk] });
      } else {
        seen.get(key)!.speakerLabels.push(spk);
      }
    }
    return Array.from(seen.values());
  })();

  const addNewAttendee = () => {
    setNewName("");
    setNewTitle("");
    setAddDialogOpen(true);
  };

  const handleConfirmAddAttendee = () => {
    if (!newName.trim()) {
      toast.error("Inserire il nome del partecipante");
      return;
    }
    const label = newName.trim().toLowerCase().replace(/\s+/g, "_");
    addSpeaker({ id: crypto.randomUUID(), full_name: newName.trim(), title: newTitle.trim() });
    setSelectedAttendees((prev) => [...prev, label]);
    setAddDialogOpen(false);
    toast.success("Partecipante aggiunto alla rubrica");
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
              <Input value={facilityName} onChange={(e) => { setFacilityName(e.target.value); if (e.target.value.trim()) setValidationErrors((p) => ({ ...p, facilityName: false })); }} placeholder="Nome della struttura..." className={validationErrors.facilityName ? "border-destructive ring-1 ring-destructive" : ""} />
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
            {uniqueAttendeeEntries.map((entry) => (
              <Button key={entry.speakerLabels.join(",")} variant={isSelected(entry.speakerLabels) ? "default" : "outline"} size="sm" onClick={() => toggleAttendeeGroup(entry.speakerLabels)} className="text-xs">
                {entry.label}
              </Button>
            ))}
            {selectedAttendees.filter((a) => !segmentSpeakers.includes(a)).map((a) => (
              <Button key={a} variant="default" size="sm" onClick={() => toggleAttendee(a)} className="text-xs">{a}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <MessageSquare className="h-4 w-4" /> Discussione Generale
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cases.length > 0 && (
            <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Riepilogo Seduta</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span><span className="font-semibold text-foreground">{cases.length}</span> pratiche discusse</span>
                {cases.filter(c => c.isOpen).length > 0 && (
                  <span><span className="font-semibold text-foreground">{cases.filter(c => c.isOpen).length}</span> casi aperti</span>
                )}
                {cases.filter(c => c.outcomeId === "riserva").length > 0 && (
                  <span><span className="font-semibold text-foreground">{cases.filter(c => c.outcomeId === "riserva").length}</span> riserve</span>
                )}
                {cases.filter(c => c.outcomeId === "archiviazione").length > 0 && (
                  <span><span className="font-semibold text-foreground">{cases.filter(c => c.outcomeId === "archiviazione").length}</span> archiviazioni</span>
                )}
                {cases.filter(c => c.outcomeId === "proposta_transattiva").length > 0 && (
                  <span><span className="font-semibold text-foreground">{cases.filter(c => c.outcomeId === "proposta_transattiva").length}</span> proposte transattive</span>
                )}
                {cases.filter(c => c.outcomeId === "istruttoria").length > 0 && (
                  <span><span className="font-semibold text-foreground">{cases.filter(c => c.outcomeId === "istruttoria").length}</span> in istruttoria</span>
                )}
                <span><span className="font-semibold text-foreground">{selectedAttendees.length}</span> partecipanti</span>
              </div>
            </div>
          )}
          <AutoResizeTextarea value={generalDiscussion} onChange={(e) => setGeneralDiscussion(e.target.value)} placeholder="Breve descrizione dell'oggetto della seduta e sintesi della discussione generale..." className="min-h-[100px]" />
        </CardContent>
      </Card>

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
            <VerbaleCaseCard key={i} caseData={c} index={i} canRemove persistentCases={persistentCases} onChange={(field, value) => updateCase(i, field, value)} onRemove={() => removeCase(i)} onCreateNewCase={() => handleCreateNewCase(i)} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-4 w-4" /> Chiusura e Decisioni
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AutoResizeTextarea value={closingDecisions} onChange={(e) => setClosingDecisions(e.target.value)} placeholder="Decisioni prese e azioni da intraprendere..." className="min-h-[100px]" />
        </CardContent>
      </Card>

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

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Partecipante</DialogTitle>
            <DialogDescription>Inserisci i dati del nuovo partecipante. Verrà aggiunto alla rubrica.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Titolo (es. Dott.)</label>
              <Input placeholder="Dott." value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome Cognome</label>
              <Input placeholder="Mario Rossi" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleConfirmAddAttendee()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleConfirmAddAttendee}>Aggiungi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
