export type SchoolPrintOrientation = 'portrait' | 'landscape';

export interface SchoolPrintMetadata {
  label: string;
  value: string | number | null | undefined;
}

export interface SchoolPrintSignature {
  label: string;
  name?: string;
}

export interface SchoolPrintOptions {
  /** Document heading shown below the school masthead. */
  title: string;
  /** Optional issue date, academic period, register/class, or reference details. */
  metadata?: SchoolPrintMetadata[];
  /** Trusted HTML for the document body (tables, paragraphs, and sections). */
  bodyHtml: string;
  /** Trusted optional HTML displayed above the signature area. */
  footerHtml?: string;
  signatures?: SchoolPrintSignature[];
  orientation?: SchoolPrintOrientation;
  /** Optional motto; omitted entirely when blank or not supplied. */
  motto?: string;
  /** Crest path from the caller, e.g. /school-logo.jpg. Remote/data URLs are rejected. */
  crestSrc?: string;
  crestAlt?: string;
  schoolName?: string;
  addressLines?: string[];
  contactLines?: string[];
  /** Optional paper document footer note. */
  footerNote?: string;
  /** HTML document title; defaults to the visible document title. */
  pageTitle?: string;
  /** Omit the outer masthead when each body page renders its own letterhead. */
  hideMasthead?: boolean;
}

const DEFAULT_SCHOOL_NAME = 'EMMECTY NURSERY & PRIMARY SCHOOL';
const DEFAULT_ADDRESS_LINES = ['P.O. Box 490699, Hoima City', 'Kasasa Road behind Kabagambe Fuel Station'];
const DEFAULT_CONTACT_LINES = ['0784905399 / 0775705175'];

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function localAssetPath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  const trimmed = path.trim();
  // Only accept same-origin public paths or simple relative public paths.
  if (!trimmed || /^(?:[a-z][a-z\d+.-]*:|\/\/|\\\\)/i.test(trimmed)) return undefined;
  if (trimmed.split(/[?#]/, 1)[0].split('/').some((part) => part === '..')) return undefined;
  return trimmed;
}

function cleanLines(lines: string[] | undefined, fallback: string[]): string[] {
  const values = lines ?? fallback;
  return values.map((line) => line.trim()).filter(Boolean);
}

export function renderSchoolMastheadHtml(
  options: Pick<SchoolPrintOptions, 'schoolName' | 'motto' | 'addressLines' | 'contactLines' | 'crestSrc' | 'crestAlt'>,
): string {
  const schoolName = options.schoolName?.trim() || DEFAULT_SCHOOL_NAME;
  const addressLines = cleanLines(options.addressLines, DEFAULT_ADDRESS_LINES);
  const contactLines = cleanLines(options.contactLines, DEFAULT_CONTACT_LINES);
  const schoolDetails = [...addressLines, ...contactLines];
  const motto = options.motto?.trim();
  const crestSrc = localAssetPath(options.crestSrc);
  const mastheadImage = crestSrc
    ? `<img class="school-crest" src="${escapeHtml(crestSrc)}" alt="${escapeHtml(options.crestAlt || `${schoolName} crest`)}">`
    : '';
  return `<header class="masthead">
      ${mastheadImage}
      <div class="masthead-copy">
        <h1 class="school-name">${escapeHtml(schoolName)}</h1>
        ${motto ? `<p class="school-motto">${escapeHtml(motto)}</p>` : ''}
        <div class="school-details">${schoolDetails.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}</div>
      </div>
      ${mastheadImage ? '<span class="masthead-spacer" aria-hidden="true"></span>' : ''}
    </header>`;
}

/**
 * Render a complete, standalone A4 print document.
 *
 * `bodyHtml` and `footerHtml` are intentional markup slots: callers should
 * escape interpolated data before composing them. All shell text and asset
 * attributes are escaped/validated here.
 */
export function renderSchoolPrintHtml(options: SchoolPrintOptions): string {
  const orientation = options.orientation === 'landscape' ? 'landscape' : 'portrait';
  const metadata = (options.metadata ?? []).filter((item) => item.value !== null && item.value !== undefined && String(item.value).trim() !== '');
  const signatures = options.signatures ?? [];
  const mastheadMarkup = options.hideMasthead ? '' : renderSchoolMastheadHtml(options);
  const metadataMarkup = metadata.length
    ? `<dl class="document-metadata">${metadata.map(({ label, value }) => `<div class="metadata-item"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`
    : '';
  const signaturesMarkup = signatures.length
    ? `<section class="signatures" aria-label="Signatures">${signatures.map(({ label, name }) => `<div class="signature"><div class="signature-line"></div>${name?.trim() ? `<p class="signature-name">${escapeHtml(name)}</p>` : ''}<p class="signature-label">${escapeHtml(label)}</p></div>`).join('')}</section>`
    : '';
  const creditMarkup = '<span class="system-credit">School management by Corenexa Systems</span>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.pageTitle?.trim() || options.title)}</title>
  <style>
    :root { color-scheme: light; --ink: #24352f; --muted: #5e7069; --green: #1d7056; --navy: #173d31; --gold: #c4a83f; --rule: #b9c8c1; --wash: #edf3ef; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { color: var(--ink); background: #fff; font: 10.5pt/1.45 "Aptos", "Segoe UI", sans-serif; }
    .print-document { width: 100%; margin: 0 auto; }
    .masthead { display: flex; align-items: center; gap: 16px; padding: 0 0 12px; border-bottom: 3px solid var(--green); position: relative; }
    .masthead::after { content: ""; position: absolute; right: 0; bottom: -5px; left: 0; border-bottom: 1px solid var(--gold); }
    .school-crest { width: 76px; height: 76px; flex: 0 0 76px; object-fit: contain; }
    .masthead-copy { flex: 1; min-width: 0; text-align: center; }
    .school-name { margin: 0; color: var(--navy); font: 700 19pt/1.12 Georgia, "Times New Roman", serif; letter-spacing: .015em; }
    .school-motto { margin: 4px 0 0; color: var(--green); font: italic 9pt/1.3 Georgia, "Times New Roman", serif; }
    .school-details { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 13px; margin-top: 7px; color: var(--muted); font-size: 8.2pt; }
    .school-details span + span::before { content: "·"; margin-right: 13px; color: var(--gold); }
    .masthead-spacer { width: 76px; flex: 0 0 76px; }
    .document-heading { padding: 19px 0 13px; border-bottom: 1px solid var(--rule); }
    .document-title { margin: 0; color: var(--navy); font: 700 15pt/1.25 Georgia, "Times New Roman", serif; text-align: center; }
    .document-metadata { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px 23px; margin: 11px 0 0; }
    .metadata-item { display: flex; gap: 6px; align-items: baseline; }
    .metadata-item dt { color: var(--muted); font-size: 8pt; font-weight: 700; letter-spacing: .065em; text-transform: uppercase; }
    .metadata-item dd { margin: 0; font-size: 9pt; font-weight: 600; }
    .document-body { padding: 17px 0 0; }
    .document-body h2, .document-body h3 { break-after: avoid; color: var(--navy); }
    .document-body h2 { margin: 17px 0 8px; padding: 6px 9px; border-left: 4px solid var(--gold); background: var(--wash); font: 700 12pt/1.3 Georgia, "Times New Roman", serif; }
    .document-body h3 { margin: 14px 0 6px; font-size: 10.5pt; }
    .document-body p { margin: 0 0 9px; }
    .document-body table { width: 100%; border-collapse: collapse; table-layout: auto; }
    .document-body th, .document-body td { padding: 6px 7px; border: 1px solid var(--rule); text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    .document-body th { background: var(--wash); color: var(--navy); font-size: 8pt; font-weight: 700; letter-spacing: .045em; text-transform: uppercase; }
    .document-body td { font-size: 9pt; }
    .document-body tbody tr:nth-child(even) td { background: #f8faf9; }
     .document-body .value-table th { width: 27%; }
     .document-body .value-table td { font-weight: 600; }
     .document-body .amount { color: var(--green); font-size: 12pt; font-weight: 700; }
    .document-body tr { break-inside: avoid; }
    .document-body thead { display: table-header-group; }
    .document-body tfoot { display: table-footer-group; }
     .document-body .admission-identity { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 0 0 13px; padding: 10px 0 12px; border-bottom: 1px solid var(--rule); break-inside: avoid; }
     .document-body .admission-identity strong { color: var(--green); font-size: 8pt; letter-spacing: .08em; text-transform: uppercase; }
     .document-body .photo-box { display: flex; width: 30mm; height: 40mm; flex: 0 0 auto; align-items: center; justify-content: center; overflow: hidden; border: 1px solid var(--green); color: var(--green); font-size: 7pt; font-weight: 700; text-align: center; }
     .document-body .photo-image { width: 100%; height: 100%; object-fit: cover; }
     .document-body .admission-values { display: grid; grid-template-columns: 1fr 1fr; }
     .document-body .admission-values > div { min-height: 10mm; margin: -1px 0 0 -1px; padding: 2mm; border: 1px solid var(--rule); }
     .document-body .admission-values dt { color: var(--muted); font-size: 7pt; letter-spacing: .04em; text-transform: uppercase; }
     .document-body .admission-values dd { margin: 1mm 0 0; font-size: 8.5pt; font-weight: 600; overflow-wrap: anywhere; }
     .document-body .parent-table { table-layout: fixed; }
     .document-body .parent-table th { font-size: 7pt; }
     .document-body .parent-table td { font-size: 8pt; line-height: 1.35; }
     .document-body .form { break-after: page; }
     .document-body .form:last-child { break-after: auto; }
     .document-body .repeat-letterhead { margin-bottom: 12px; break-inside: avoid; }
    .signatures { display: flex; justify-content: space-between; gap: 30px; margin: 34px 0 12px; break-inside: avoid; }
    .signature { width: 30%; min-width: 130px; text-align: center; }
    .signature-line { height: 27px; border-bottom: 1px solid #64766e; }
    .signature-name { margin: 5px 0 0 !important; font-size: 8.5pt; font-weight: 600; }
    .signature-label { margin: 5px 0 0 !important; color: var(--muted); font-size: 8pt; }
    .document-footer { display: flex; align-items: end; justify-content: space-between; gap: 12px; margin-top: 22px; padding-top: 8px; border-top: 1px solid var(--rule); color: var(--muted); font-size: 7.5pt; }
    .footer-note { max-width: 75%; }
    .system-credit { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 5px; color: #77837e; font-size: 6.5pt; white-space: nowrap; }
    @page {
      size: A4 ${orientation};
      margin: 14mm;
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        color: var(--muted);
        font: 8pt "Segoe UI", sans-serif;
      }
    }
    @media print {
      html, body { width: auto; }
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .print-document { max-width: none; }
      a { color: inherit; text-decoration: none; }
    }
    @media screen {
      body { max-width: 210mm; min-height: 297mm; margin: 24px auto; padding: 18mm; box-shadow: 0 5px 28px rgba(23,61,49,.12); }
      body[data-orientation="landscape"] { max-width: 297mm; min-height: 210mm; }
    }
    @media screen and (max-width: 680px) {
      body, body[data-orientation="landscape"] { min-height: 100vh; margin: 0; padding: 22px 18px; box-shadow: none; }
      .masthead { gap: 10px; }
      .school-crest { width: 56px; height: 56px; flex-basis: 56px; }
      .masthead-spacer { width: 0; flex-basis: 0; }
      .school-name { font-size: 15pt; }
      .document-body .admission-values { grid-template-columns: 1fr; }
      .signatures { gap: 14px; }
      .signature { min-width: 0; flex: 1; }
    }
  </style>
</head>
<body data-orientation="${orientation}">
  <main class="print-document">
    ${mastheadMarkup}
    <section class="document-heading">
      <h2 class="document-title">${escapeHtml(options.title)}</h2>
      ${metadataMarkup}
    </section>
    <section class="document-body">${options.bodyHtml}</section>
    ${options.footerHtml ? `<section class="document-extra-footer">${options.footerHtml}</section>` : ''}
    ${signaturesMarkup}
    <footer class="document-footer">
      <span class="footer-note">${escapeHtml(options.footerNote || '')}</span>
      ${creditMarkup}
    </footer>
  </main>
</body>
</html>`;
}

/**
 * Open a named print window, write the generated document, and invoke the
 * browser print dialog once local images have either loaded or failed.
 * Returns null when blocked/unavailable; callers can fall back to window.print().
 */
export function openSchoolPrintWindow(html: string, windowName = 'emmecty-school-print'): Window | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  let printWindow: Window | null = null;
  try {
    printWindow = window.open('', windowName, 'popup,width=1100,height=800');
    if (!printWindow) return null;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    let printRequested = false;
    const printWhenReady = () => {
      if (printRequested || printWindow?.closed) return;
      printRequested = true;
      const target = printWindow;
      if (!target) return;
      const images = Array.from(target.document.images);
      Promise.all(images.map((image) => {
        if (image.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true });
          image.addEventListener('error', () => resolve(), { once: true });
        });
      })).then(() => {
        target.focus();
        target.print();
      });
    };

    if (printWindow.document.readyState === 'complete') {
      window.setTimeout(printWhenReady, 0);
    } else {
      printWindow.addEventListener('load', printWhenReady, { once: true });
      window.setTimeout(printWhenReady, 500);
    }
    return printWindow;
  } catch {
    try {
      printWindow?.close();
    } catch {
      // Ignore a partially opened or browser-blocked print window.
    }
    return null;
  }
}