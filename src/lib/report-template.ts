export const REPORT_TEMPLATE = {
  header: {
    title: "Comitato Valutazione Gestione Sinistri",
  },
  sections: {
    agenda: "ODG: discussione pratiche in autogestione",
    case_detail: "Casi in discussione",
    new_claims: "Nuove richieste di risarcimento",
    footer: "CHIUSURA LAVORI",
  },
  standard_outcomes: [
    {
      id: "istruttoria",
      label: "Attesa Istruttoria",
      text: "Si condivide di attendere l'istruttoria interna per le determinazioni del caso.",
    },
    {
      id: "riserva",
      label: "Mantenimento Riserva",
      text: "Si condivide di mantenere la riserva precedentemente apposta.",
    },
    {
      id: "prematuro",
      label: "Discussione Prematura",
      text: "Si ritiene prematuro procedere con l'azzeramento della riserva.",
    },
    {
      id: "sviluppi",
      label: "Attesa Sviluppi",
      text: "Si rimane in attesa di sviluppi.",
    },
    {
      id: "archiviazione",
      label: "Archiviazione",
      text: "La pratica è stata archiviata stante l'insussistenza di responsabilità.",
    },
    {
      id: "proposta_transattiva",
      label: "Proposta Transattiva",
      text: "Si condivide di proporre un risarcimento di €",
    },
  ],
} as const;

export type OutcomeId = typeof REPORT_TEMPLATE.standard_outcomes[number]["id"];

export interface ReportCase {
  patientName: string;
  description: string;
  outcomeId: OutcomeId | "";
  outcomeExtra: string; // e.g. amount for proposta_transattiva
  isOpen: boolean;
  caseId?: string; // persistent case ID linking across verbali
}

export interface ReportData {
  facilityName: string;
  meetingDate: string;
  attendees: string[];
  cases: ReportCase[];
  startTime: string;
  closingTime: string;
  nextMeetingDate: string;
  nextMeetingTime: string;
}

export function getOutcomeText(outcomeId: OutcomeId | "" | "__custom__", extra: string): string {
  if (outcomeId === "__custom__") return extra;
  const outcome = REPORT_TEMPLATE.standard_outcomes.find((o) => o.id === outcomeId);
  if (!outcome) return "";
  if (outcomeId === "proposta_transattiva" && extra) {
    return outcome.text + " " + extra + " con dilazione da concordarsi.";
  }
  return outcome.text;
}
