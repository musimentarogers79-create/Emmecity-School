import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export type SchoolPdfOrientation = 'portrait' | 'landscape';

export interface SchoolPdfBrand {
  name: string;
  motto?: string;
  postalAddress: string;
  phone: string;
  location: string;
  crestPath: string;
}

export interface SchoolPdfField {
  label: string;
  value: unknown;
}

export interface SchoolPdfTable {
  title?: string;
  columns: string[];
  rows: unknown[][];
}

export interface SchoolPdfOptions {
  brand: SchoolPdfBrand;
  title: string;
  subtitle?: string;
  orientation?: SchoolPdfOrientation;
  fields?: SchoolPdfField[];
  tables?: SchoolPdfTable[];
  notes?: string[];
  signatures?: string[];
  footerNote?: string;
}

const colors = {
  ink: [36, 53, 47] as [number, number, number],
  muted: [91, 111, 103] as [number, number, number],
  navy: [23, 61, 49] as [number, number, number],
  green: [29, 112, 86] as [number, number, number],
  gold: [196, 168, 63] as [number, number, number],
  rule: [185, 200, 193] as [number, number, number],
  wash: [237, 243, 239] as [number, number, number],
};

function loadImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load document branding image: ${path}`));
    image.src = path;
  });
}

function pdfText(value: unknown): string {
  return String(value ?? '—').replace(/\s+/g, ' ').trim() || '—';
}

function drawMasthead(
  doc: jsPDF,
  brand: SchoolPdfBrand,
  title: string,
  subtitle: string | undefined,
  crest: HTMLImageElement,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const copyLeft = 40;
  const copyWidth = pageWidth - copyLeft - 12;
  const copyCenter = copyLeft + copyWidth / 2;
  doc.addImage(crest, 'JPEG', 13, 10, 21, 21);
  doc.setTextColor(...colors.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(brand.name, copyCenter, 14, { align: 'center', maxWidth: copyWidth });
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(...colors.green);
  doc.text(brand.motto || '', copyCenter, 19, { align: 'center', maxWidth: copyWidth });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...colors.muted);
  const details = [brand.postalAddress, brand.location, `Tel: ${brand.phone}`].filter(Boolean);
  doc.text(details.join('  |  '), copyCenter, 25, { align: 'center', maxWidth: copyWidth });
  doc.setDrawColor(...colors.green);
  doc.setLineWidth(0.8);
  doc.line(12, 32, pageWidth - 12, 32);
  doc.setDrawColor(...colors.gold);
  doc.setLineWidth(0.25);
  doc.line(12, 33, pageWidth - 12, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...colors.navy);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), pageWidth - 28);
  doc.text(titleLines, pageWidth / 2, 41, { align: 'center' });
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.muted);
    doc.text(doc.splitTextToSize(subtitle, pageWidth - 28), pageWidth / 2, 46, { align: 'center' });
  }
}

function drawFooter(
  doc: jsPDF,
  brand: SchoolPdfBrand,
  pageNumber: number,
  pageCount: number,
  footerNote: string | undefined,
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...colors.rule);
  doc.setLineWidth(0.25);
  doc.line(12, pageHeight - 14, pageWidth - 12, pageHeight - 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...colors.muted);
  const note = footerNote || 'Official school record';
  doc.text(note, 12, pageHeight - 9);
  doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 12, pageHeight - 9, { align: 'right' });
  doc.setFontSize(5.8);
  doc.text(`School management by Corenexa Systems · ${brand.name}`, 12, pageHeight - 4.2, { maxWidth: pageWidth - 74 });
}

function addSectionHeading(doc: jsPDF, title: string, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...colors.wash);
  doc.rect(12, y, pageWidth - 24, 7, 'F');
  doc.setDrawColor(...colors.gold);
  doc.setLineWidth(1.2);
  doc.line(12, y, 12, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...colors.navy);
  doc.text(title, 15, y + 4.8);
}

export async function createSchoolPdf(options: SchoolPdfOptions): Promise<Blob> {
  const orientation = options.orientation || 'portrait';
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({
    title: options.title,
    subject: options.subtitle || 'Official school document',
    author: options.brand.name,
    creator: options.brand.name,
  });

  const crest = await loadImage(options.brand.crestPath);
  const drawHeader = () => drawMasthead(doc, options.brand, options.title, options.subtitle, crest);
  drawHeader();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - 24;
  let cursor = options.subtitle ? 52 : 48;

  const fields = (options.fields || []).filter((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== '');
  if (fields.length) {
    addSectionHeading(doc, 'DOCUMENT DETAILS', cursor);
    const pairedRows: string[][] = [];
    for (let index = 0; index < fields.length; index += 2) {
      const first = fields[index];
      const second = fields[index + 1];
      pairedRows.push([
        first.label,
        pdfText(first.value),
        second?.label || '',
        second ? pdfText(second.value) : '',
      ]);
    }
    autoTable(doc, {
      body: pairedRows,
      startY: cursor + 7,
      margin: { top: 54, bottom: 18, left: 12, right: 12 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, textColor: colors.ink, cellPadding: 2.2, lineColor: colors.rule, lineWidth: 0.2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 31, fontStyle: 'bold', textColor: colors.navy, fillColor: colors.wash },
        1: { cellWidth: (contentWidth - 62) / 2 },
        2: { cellWidth: 31, fontStyle: 'bold', textColor: colors.navy, fillColor: colors.wash },
        3: { cellWidth: (contentWidth - 62) / 2 },
      },
      didDrawPage: drawHeader,
    });
    cursor = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursor + 7) + 7;
  }

  for (const table of options.tables || []) {
    if (table.title) {
      if (cursor + 12 > pageHeight - 20) {
        doc.addPage();
        drawHeader();
        cursor = 54;
      }
      addSectionHeading(doc, table.title, cursor);
      cursor += 8;
    }
    autoTable(doc, {
      head: [table.columns],
      body: table.rows.map((row) => row.map(pdfText)),
      startY: cursor,
      margin: { top: 54, bottom: 18, left: 12, right: 12 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: orientation === 'landscape' ? 8 : 8.5, textColor: colors.ink, cellPadding: 2.2, lineColor: colors.rule, lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: colors.navy, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 249] },
      didDrawPage: drawHeader,
    });
    cursor = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursor) + 7;
  }

  for (const note of options.notes || []) {
    const lines = doc.splitTextToSize(note, contentWidth);
    if (cursor + lines.length * 4.3 > pageHeight - 24) {
      doc.addPage();
      drawHeader();
      cursor = 54;
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...colors.ink);
    doc.text(lines, 12, cursor + 3);
    cursor += lines.length * 4.3 + 4;
  }

  const signatures = options.signatures || [];
  if (signatures.length) {
    if (cursor + 32 > pageHeight - 19) {
      doc.addPage();
      drawHeader();
      cursor = 54;
    }
    const gap = 10;
    const width = (contentWidth - gap * (signatures.length - 1)) / signatures.length;
    const signatureY = cursor + 19;
    signatures.forEach((label, index) => {
      const x = 12 + index * (width + gap);
      doc.setDrawColor(...colors.muted);
      doc.setLineWidth(0.25);
      doc.line(x, signatureY, x + width, signatureY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...colors.muted);
      doc.text(label, x + width / 2, signatureY + 4.5, { align: 'center', maxWidth: width });
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    drawFooter(doc, options.brand, page, pageCount, options.footerNote);
  }
  return doc.output('blob');
}

export async function downloadSchoolPdf(filename: string, options: SchoolPdfOptions): Promise<void> {
  const blob = await createSchoolPdf(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}