import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered } from "lucide-react";
import type { ReportCase } from "@/lib/report-template";

interface Props {
  cases: ReportCase[];
}

export function VerbaleAgenda({ cases }: Props) {
  const openCases = cases.filter((c) => c.isOpen && c.patientName);
  const closedCases = cases.filter((c) => !c.isOpen && c.patientName);

  if (openCases.length === 0 && closedCases.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListOrdered className="h-4 w-4" /> Ordine del Giorno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            Usa "Popola Pratiche via AI" per estrarre automaticamente i casi dalla trascrizione.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ListOrdered className="h-4 w-4" /> Ordine del Giorno
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {openCases.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Casi aperti</p>
            <ul className="list-disc list-inside space-y-0.5">
              {openCases.map((c, i) => (
                <li key={i} className="text-sm">{c.patientName}</li>
              ))}
            </ul>
          </div>
        )}
        {closedCases.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Casi chiusi</p>
            <ul className="list-disc list-inside space-y-0.5">
              {closedCases.map((c, i) => (
                <li key={i} className="text-sm">{c.patientName}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
