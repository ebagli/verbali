import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Trash2, Link2, Plus } from "lucide-react";
import { REPORT_TEMPLATE, type ReportCase } from "@/lib/report-template";

interface PersistentCase {
  id: string;
  patient_name: string;
  is_open: boolean;
}

interface Props {
  caseData: ReportCase;
  index: number;
  canRemove: boolean;
  persistentCases?: PersistentCase[];
  onChange: (field: keyof ReportCase, value: string | boolean) => void;
  onRemove: () => void;
  onCreateNewCase?: () => void;
}

export function VerbaleCaseCard({ caseData, index, canRemove, persistentCases = [], onChange, onRemove, onCreateNewCase }: Props) {
  const linkedCase = persistentCases.find(c => c.id === caseData.caseId);

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 space-y-3 relative">
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="absolute top-2 right-2 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}

        {/* Case linking */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={caseData.caseId || "__none__"}
            onValueChange={(v) => onChange("caseId", v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="w-[250px] h-8 text-xs">
              <div className="flex items-center gap-1.5">
                <Link2 className="h-3 w-3" />
                <SelectValue placeholder="Collega a caso..." />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Nessun collegamento —</SelectItem>
              {persistentCases.map((pc) => (
                <SelectItem key={pc.id} value={pc.id}>
                  {pc.patient_name} {pc.is_open ? "🔴" : "🟢"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linkedCase && (
            <Badge variant="outline" className="text-xs gap-1">
              <Link2 className="h-3 w-3" /> {linkedCase.patient_name}
            </Badge>
          )}
          {!caseData.caseId && onCreateNewCase && (
            <Button variant="ghost" size="sm" onClick={onCreateNewCase} className="text-xs h-7 gap-1">
              <Plus className="h-3 w-3" /> Nuovo caso
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Input
            placeholder="COGNOME NOME paziente"
            value={caseData.patientName}
            onChange={(e) => onChange("patientName", e.target.value.toUpperCase())}
            className="font-bold uppercase flex-1"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <Checkbox
              id={`open-case-${index}`}
              checked={caseData.isOpen}
              onCheckedChange={(v) => onChange("isOpen", !!v)}
            />
            <label htmlFor={`open-case-${index}`} className="text-xs text-muted-foreground cursor-pointer">
              Aperto
            </label>
          </div>
        </div>

        <AutoResizeTextarea
          placeholder="Descrizione clinico/legale del caso (es. esiti ATP, stato CTU, perizie...)"
          value={caseData.description}
          onChange={(e) => onChange("description", e.target.value)}
        />

        <div className="space-y-2">
          <Select
            value={caseData.outcomeId || "__none__"}
            onValueChange={(v) => {
              if (v === "__custom__") {
                onChange("outcomeId", "__custom__");
              } else {
                onChange("outcomeId", v === "__none__" ? "" : v);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Determinazione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Seleziona Determinazione —</SelectItem>
              {REPORT_TEMPLATE.standard_outcomes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
              <SelectItem value="__custom__">Testo libero...</SelectItem>
            </SelectContent>
          </Select>
          {caseData.outcomeId === "__custom__" && (
            <AutoResizeTextarea
              placeholder="Inserisci la determinazione personalizzata..."
              value={caseData.outcomeExtra}
              onChange={(e) => onChange("outcomeExtra", e.target.value)}
              className="min-h-[60px]"
            />
          )}
          {caseData.outcomeId === "proposta_transattiva" && (
            <Input
              placeholder="Importo € (es. 50.000)"
              value={caseData.outcomeExtra}
              onChange={(e) => onChange("outcomeExtra", e.target.value)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
