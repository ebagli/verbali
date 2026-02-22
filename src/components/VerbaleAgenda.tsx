import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListOrdered } from "lucide-react";
import type { ReportCase } from "@/lib/report-template";

interface Props {
  cases: ReportCase[];
}

export function VerbaleAgenda({ cases }: Props) {
  const existing = cases.filter((c) => !c.isNewClaim && c.patientName);
  const newClaims = cases.filter((c) => c.isNewClaim && c.patientName);

  if (existing.length === 0 && newClaims.length === 0) {
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
        {existing.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Casi in discussione</p>
            <ul className="list-disc list-inside space-y-0.5">
              {existing.map((c, i) => (
                <li key={i} className="text-sm">{c.patientName}</li>
              ))}
            </ul>
          </div>
        )}
        {newClaims.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Nuove richieste di risarcimento</p>
            <ul className="list-disc list-inside space-y-0.5">
              {newClaims.map((c, i) => (
                <li key={i} className="text-sm">{c.patientName}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
