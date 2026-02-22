import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPORT_TEMPLATE, generateReportMarkdown, type ReportCase, type ReportData, type OutcomeId } from "@/lib/report-template";
import { FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Speaker {
  id: string;
  full_name: string;
  title: string;
}

interface Props {
  transcriptionId: string;
  segments: { speaker: string; text: string }[];
  speakerMapping: Record<string, string>;
  onReportGenerated: (report: string) => void;
}

export function ReportGenerator({ transcriptionId, segments, speakerMapping, onReportGenerated }: Props) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [facilityName, setFacilityName] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([]);
  const [cases, setCases] = useState<ReportCase[]>([
    { patientName: "", status: "", outcomeId: "", outcomeExtra: "" },
  ]);
  const [closingTime, setClosingTime] = useState("");
  const [nextMeetingDate, setNextMeetingDate] = useState("");

  useEffect(() => {
    supabase
      .from("speakers")
      .select("id, full_name, title")
      .order("full_name")
      .then(({ data }) => {
        if (data) setSpeakers(data);
      });
  }, []);

  const displayName = (s: Speaker) =>
    s.title ? `${s.title} ${s.full_name}` : s.full_name;

  const toggleAttendee = (id: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const updateCase = (i: number, field: keyof ReportCase, value: string) => {
    setCases((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };

  const addCase = () => {
    setCases((prev) => [...prev, { patientName: "", status: "", outcomeId: "", outcomeExtra: "" }]);
  };

  const removeCase = (i: number) => {
    setCases((prev) => prev.filter((_, idx) => idx !== i));
  };

  const generate = () => {
    const attendeeNames = selectedAttendees
      .map((id) => speakers.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => displayName(s!));

    const data: ReportData = {
      facilityName,
      meetingDate,
      attendees: attendeeNames,
      cases,
      closingTime,
      nextMeetingDate,
    };

    const report = generateReportMarkdown(data);
    onReportGenerated(report);
    toast.success("Verbale generato");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-4 w-4" /> Genera Verbale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Header fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Struttura Sanitaria</label>
            <Input value={facilityName} onChange={(e) => setFacilityName(e.target.value)} placeholder="Nome struttura" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data Incontro</label>
            <Input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} />
          </div>
        </div>

        {/* Attendees */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Partecipanti</label>
          <div className="flex flex-wrap gap-2">
            {speakers.map((s) => (
              <Button
                key={s.id}
                variant={selectedAttendees.includes(s.id) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleAttendee(s.id)}
                className="text-xs"
              >
                {displayName(s)}
              </Button>
            ))}
            {speakers.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Aggiungi partecipanti dalla Rubrica.</p>
            )}
          </div>
        </div>

        {/* Cases */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Pratiche</label>
            <Button variant="outline" size="sm" onClick={addCase} className="gap-1 text-xs">
              <Plus className="h-3 w-3" /> Aggiungi Pratica
            </Button>
          </div>
          {cases.map((c, i) => (
            <div key={i} className="border rounded-md p-3 space-y-2 relative">
              {cases.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCase(i)}
                  className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Input
                placeholder="COGNOME NOME paziente"
                value={c.patientName}
                onChange={(e) => updateCase(i, "patientName", e.target.value)}
                className="font-medium"
              />
              <Textarea
                placeholder="Stato clinico/legale (es. esiti ATP, stato CTU...)"
                value={c.status}
                onChange={(e) => updateCase(i, "status", e.target.value)}
                rows={2}
              />
              <div className="flex gap-2">
                <Select
                  value={c.outcomeId || "__none__"}
                  onValueChange={(v) => updateCase(i, "outcomeId", v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Determinazione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Seleziona —</SelectItem>
                    {REPORT_TEMPLATE.standard_outcomes.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(c.outcomeId === "mantenimento_riserva" || c.outcomeId === "proposta_transattiva") && (
                  <Input
                    placeholder="Importo €"
                    value={c.outcomeExtra}
                    onChange={(e) => updateCase(i, "outcomeExtra", e.target.value)}
                    className="w-36"
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Fine lavori ore</label>
            <Input type="time" value={closingTime} onChange={(e) => setClosingTime(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Prossimo incontro</label>
            <Input type="date" value={nextMeetingDate} onChange={(e) => setNextMeetingDate(e.target.value)} />
          </div>
        </div>

        <Button onClick={generate} className="w-full gap-2">
          <FileText className="h-4 w-4" /> Genera Verbale
        </Button>
      </CardContent>
    </Card>
  );
}
