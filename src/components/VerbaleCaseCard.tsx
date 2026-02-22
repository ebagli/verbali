import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2 } from "lucide-react";
import { REPORT_TEMPLATE, type ReportCase } from "@/lib/report-template";

interface Props {
  caseData: ReportCase;
  index: number;
  canRemove: boolean;
  onChange: (field: keyof ReportCase, value: string | boolean) => void;
  onRemove: () => void;
}

export function VerbaleCaseCard({ caseData, index, canRemove, onChange, onRemove }: Props) {
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

        <div className="flex items-center gap-3">
          <Input
            placeholder="COGNOME NOME paziente"
            value={caseData.patientName}
            onChange={(e) => onChange("patientName", e.target.value.toUpperCase())}
            className="font-bold uppercase flex-1"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <Checkbox
              id={`new-claim-${index}`}
              checked={caseData.isNewClaim}
              onCheckedChange={(v) => onChange("isNewClaim", !!v)}
            />
            <label htmlFor={`new-claim-${index}`} className="text-xs text-muted-foreground cursor-pointer">
              Nuova richiesta
            </label>
          </div>
        </div>

        <Textarea
          placeholder="Descrizione clinico/legale del caso (es. esiti ATP, stato CTU, perizie...)"
          value={caseData.description}
          onChange={(e) => onChange("description", e.target.value)}
          rows={3}
        />

        <div className="flex gap-2">
          <Select
            value={caseData.outcomeId || "__none__"}
            onValueChange={(v) => onChange("outcomeId", v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Determinazione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Seleziona Determinazione —</SelectItem>
              {REPORT_TEMPLATE.standard_outcomes.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {caseData.outcomeId === "proposta_transattiva" && (
            <Input
              placeholder="Importo € (es. 50.000)"
              value={caseData.outcomeExtra}
              onChange={(e) => onChange("outcomeExtra", e.target.value)}
              className="w-40"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
