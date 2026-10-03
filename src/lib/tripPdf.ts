import type { jsPDF as JsPDF } from "jspdf";
import { buildTripReport, type ReportInput, type ReportKind, type TripReport } from "@/utils/tripReport";

// Draws a TripReport as an A4 PDF. jsPDF is loaded on demand (only when a PDF
// is requested), so it never weighs on the app's startup.

const M = 16;                 // page margin, mm
const WHEN_W = 44;            // left column (date / time)
const INK: [number, number, number] = [28, 28, 26];
const MUTED: [number, number, number] = [110, 110, 104];
const RULE: [number, number, number] = [220, 218, 210];

export function renderTripPdf(report: TripReport, Doc: typeof JsPDF): JsPDF {
  const doc = new Doc({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const width = pageW - 2 * M;
  let y = M;

  const ensure = (h: number) => {
    if (y + h <= pageH - M - 6) return;
    doc.addPage();
    y = M;
  };
  const style = (size: number, bold = false, color = INK) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lineH = (size: number) => size * 0.42;
  const paragraph = (text: string, size: number, bold = false, color = INK, x = M, w = width) => {
    style(size, bold, color);
    const lines = doc.splitTextToSize(text, w) as string[];
    ensure(lines.length * lineH(size));
    doc.text(lines, x, y, { baseline: "top" });
    y += lines.length * lineH(size);
  };
  const heading = (text: string, subtitle?: string) => {
    ensure(14);
    y += 4;
    paragraph(text, 13, true);
    if (subtitle) paragraph(subtitle, 10, false, MUTED);
    y += 1.5;
    doc.setDrawColor(...RULE);
    doc.line(M, y, pageW - M, y);
    y += 3;
  };

  paragraph(report.title.toUpperCase(), 9, true, MUTED);
  y += 1;
  paragraph(report.heading, 20, true);
  y += 1;
  paragraph(report.dates, 11);
  if (report.destination) paragraph(report.destination, 11, false, MUTED);

  if (report.travelers.length) {
    heading(`Viajeros (${report.travelers.length})`);
    report.travelers.forEach((t, i) => paragraph(`${i + 1}. ${t}`, 10.5));
  }

  for (const section of report.sections) {
    heading(section.title, section.subtitle);
    if (section.rows.length === 0) paragraph("Sin actividades.", 10, false, MUTED);
    for (const row of section.rows) {
      style(10.5, true);
      const text = doc.splitTextToSize(row.text, width - WHEN_W) as string[];
      style(9);
      const detail = row.detail ? (doc.splitTextToSize(row.detail, width - WHEN_W) as string[]) : [];
      const h = text.length * lineH(10.5) + detail.length * lineH(9) + 2.5;
      ensure(h);
      style(9, false, MUTED);
      doc.text(doc.splitTextToSize(row.when, WHEN_W - 3) as string[], M, y + 0.4, { baseline: "top" });
      style(10.5, true);
      doc.text(text, M + WHEN_W, y, { baseline: "top" });
      if (detail.length) {
        style(9, false, MUTED);
        doc.text(detail, M + WHEN_W, y + text.length * lineH(10.5), { baseline: "top" });
      }
      y += h;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    style(8, false, MUTED);
    doc.text(report.footer, M, pageH - M + 4);
    doc.text(`Página ${p} de ${pages}`, pageW - M, pageH - M + 4, { align: "right" });
  }
  return doc;
}

// Builds the PDF and hands it over: the share sheet on phones (save to Files,
// send by WhatsApp), a regular download elsewhere.
export async function downloadTripPdf(kind: ReportKind, input: ReportInput) {
  const { jsPDF } = await import("jspdf");
  const report = buildTripReport(kind, input);
  const doc = renderTripPdf(report, jsPDF);
  const file = new File([doc.output("blob")], report.fileName, { type: "application/pdf" });
  if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: report.title });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
  }
  doc.save(report.fileName);
}
