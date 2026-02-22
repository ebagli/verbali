export const REPORT_TEMPLATE = {
  header: {
    title: "Verbale Comitato Valutazione Sinistri",
    fields: ["Struttura Sanitaria", "Data Incontro", "Partecipanti"],
  },
  sections: {
    agenda: "ORDINE DEL GIORNO",
    case_detail: "DISCUSSIONE PRATICHE",
    footer: "CHIUSURA LAVORI",
  },
  standard_outcomes: [
    {
      id: "attesa_istruttoria",
      label: "Attesa Istruttoria",
      text: "Si condivide di attendere l'istruttoria interna per le determinazioni del caso.",
    },
    {
      id: "mantenimento_riserva",
      label: "Mantenimento Riserva",
      text: "Si condivide di mantenere la riserva precedentemente apposta di €",
    },
    {
      id: "proposta_transattiva",
      label: "Proposta Transattiva",
      text: "Si condivide di proporre un risarcimento di € con dilazione da concordarsi.",
    },
    {
      id: "prematuro",
      label: "Discussione Prematura",
      text: "Si ritiene prematura qualsiasi discussione allo stato attuale.",
    },
    {
      id: "archiviazione",
      label: "Archiviazione",
      text: "Non sussistendo responsabilità in capo alla struttura, la pratica rimane archiviata.",
    },
  ],
} as const;

export type OutcomeId = typeof REPORT_TEMPLATE.standard_outcomes[number]["id"];

export interface ReportCase {
  patientName: string;
  status: string;
  outcomeId: OutcomeId | "";
  outcomeExtra: string; // e.g. amount for riserva/transattiva
}

export interface ReportData {
  facilityName: string;
  meetingDate: string;
  attendees: string[];
  cases: ReportCase[];
  closingTime: string;
  nextMeetingDate: string;
}

export function getOutcomeText(outcomeId: OutcomeId | "", extra: string): string {
  const outcome = REPORT_TEMPLATE.standard_outcomes.find((o) => o.id === outcomeId);
  if (!outcome) return "";
  if (outcomeId === "mantenimento_riserva" || outcomeId === "proposta_transattiva") {
    return outcome.text + " " + extra;
  }
  return outcome.text;
}

export function generateReportMarkdown(data: ReportData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${REPORT_TEMPLATE.header.title}`);
  lines.push("");
  lines.push(`**Struttura Sanitaria:** ${data.facilityName}`);
  lines.push(`**Data Incontro:** ${data.meetingDate}`);
  lines.push("");
  lines.push("**Partecipanti:**");
  data.attendees.forEach((a) => lines.push(`- ${a}`));
  lines.push("");
  lines.push("---");
  lines.push("");

  // Agenda
  lines.push(`## ${REPORT_TEMPLATE.sections.agenda}`);
  lines.push("");
  data.cases.forEach((c, i) => lines.push(`${i + 1}. ${c.patientName}`));
  lines.push("");
  lines.push("---");
  lines.push("");

  // Case details
  lines.push(`## ${REPORT_TEMPLATE.sections.case_detail}`);
  lines.push("");
  data.cases.forEach((c) => {
    lines.push(`### ${c.patientName.toUpperCase()}`);
    lines.push("");
    lines.push(c.status);
    lines.push("");
    const determinazione = getOutcomeText(c.outcomeId, c.outcomeExtra);
    if (determinazione) {
      lines.push(`**Determinazioni:** ${determinazione}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  // Footer
  lines.push(`## ${REPORT_TEMPLATE.sections.footer}`);
  lines.push("");
  lines.push(`Fine lavori ore ${data.closingTime}.`);
  lines.push("");
  if (data.nextMeetingDate) {
    lines.push(`Prossimo incontro: ${data.nextMeetingDate}.`);
    lines.push("");
  }
  lines.push("_Firma:_ ____________________________");

  return lines.join("\n");
}
