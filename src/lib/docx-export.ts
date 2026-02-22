import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Packer, BorderStyle, SectionType,
} from "docx";
import { saveAs } from "file-saver";
import { type ReportData, getOutcomeText } from "./report-template";

function hr(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "999999" },
    },
    spacing: { after: 200, before: 200 },
  });
}

export function buildVerbaleDocument(data: ReportData): Document {
  const children: Paragraph[] = [];

  // Facility name
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: data.facilityName.toUpperCase(), bold: true, size: 28, font: "Times New Roman" })],
    })
  );

  // Title with date
  const dateFormatted = data.meetingDate
    ? new Date(data.meetingDate).toLocaleDateString("it-IT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : "";
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 300 },
      children: [
        new TextRun({ text: `Comitato Valutazione Gestione Sinistri di ${dateFormatted}`, bold: true, size: 24, font: "Times New Roman" }),
      ],
    })
  );

  // Attendees
  data.attendees.forEach((a) => {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: a, size: 22, font: "Times New Roman" })],
      })
    );
  });

  children.push(hr());

  // ODG
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { after: 100 },
      children: [new TextRun({ text: "ODG: discussione pratiche in autogestione", bold: true, size: 22, font: "Times New Roman" })],
    })
  );

  const existingCases = data.cases.filter((c) => !c.isNewClaim && c.patientName);
  const newClaims = data.cases.filter((c) => c.isNewClaim && c.patientName);

  if (existingCases.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 60 },
        children: [new TextRun({ text: "Casi in discussione:", bold: true, size: 22, font: "Times New Roman" })],
      })
    );
    existingCases.forEach((c) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: c.patientName, size: 22, font: "Times New Roman" })],
        })
      );
    });
  }

  if (newClaims.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 60 },
        children: [new TextRun({ text: "Nuove richieste di risarcimento:", bold: true, size: 22, font: "Times New Roman" })],
      })
    );
    newClaims.forEach((c) => {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: c.patientName, size: 22, font: "Times New Roman" })],
        })
      );
    });
  }

  children.push(hr());

  // Start time
  if (data.startTime) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: `Inizio lavori ore ${data.startTime}`, size: 22, font: "Times New Roman" })],
      })
    );
  }

  // Case details
  data.cases.filter((c) => c.patientName).forEach((c) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
        children: [new TextRun({ text: c.patientName.toUpperCase(), bold: true, size: 22, font: "Times New Roman" })],
      })
    );

    if (c.description) {
      children.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: c.description, size: 22, font: "Times New Roman" })],
        })
      );
    }

    const det = getOutcomeText(c.outcomeId, c.outcomeExtra);
    if (det) {
      children.push(
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: det, italics: true, size: 22, font: "Times New Roman" })],
        })
      );
    }
  });

  children.push(hr());

  // Footer
  if (data.closingTime) {
    children.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: `Fine lavori ore ${data.closingTime}`, size: 22, font: "Times New Roman" })],
      })
    );
  }

  if (data.nextMeetingDate) {
    const nextDateFormatted = new Date(data.nextMeetingDate).toLocaleDateString("it-IT", {
      day: "numeric", month: "long", year: "numeric",
    });
    const timeStr = data.nextMeetingTime ? ` ore ${data.nextMeetingTime}` : "";
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({
            text: `Prossimo incontro del CVS è fissato per il giorno ${nextDateFormatted}${timeStr}`,
            size: 22,
            font: "Times New Roman",
          }),
        ],
      })
    );
  }

  // Signature block
  children.push(
    new Paragraph({ spacing: { before: 400 } })
  );
  data.attendees.forEach((a) => {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: a, size: 22, font: "Times New Roman" })],
      })
    );
  });

  return new Document({
    sections: [{ properties: { type: SectionType.CONTINUOUS }, children }],
  });
}

export async function exportVerbaleDocx(data: ReportData) {
  const doc = buildVerbaleDocument(data);
  const blob = await Packer.toBlob(doc);
  const dateStr = data.meetingDate || new Date().toISOString().slice(0, 10);
  saveAs(blob, `Verbale_CVS_${dateStr}.docx`);
}
