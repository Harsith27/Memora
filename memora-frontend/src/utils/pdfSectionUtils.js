import { PDFDocument } from 'pdf-lib';

const PDF_EXTENSION_RE = /\.pdf$/i;

export const isPdfFile = (file) => {
  if (!file) return false;
  return file.type === 'application/pdf' || PDF_EXTENSION_RE.test(String(file.name || ''));
};

export const getPdfBaseName = (fileName) => {
  const safeName = String(fileName || 'document.pdf').trim() || 'document.pdf';
  return safeName.replace(PDF_EXTENSION_RE, '');
};

export const normalizePageRanges = (ranges = [], pageCount = null) => {
  return ranges
    .map((range) => {
      const startPage = Number(range?.startPage ?? range?.start ?? range?.from);
      const endPage = Number(range?.endPage ?? range?.end ?? range?.to);
      const safeStart = Number.isFinite(startPage) ? Math.floor(startPage) : 1;
      const safeEnd = Number.isFinite(endPage) ? Math.floor(endPage) : safeStart;
      const boundedStart = Math.max(1, safeStart);
      const boundedEnd = pageCount ? Math.min(pageCount, Math.max(boundedStart, safeEnd)) : Math.max(boundedStart, safeEnd);

      return {
        startPage: boundedStart,
        endPage: boundedEnd
      };
    })
    .filter((range) => range.startPage <= range.endPage)
    .sort((left, right) => left.startPage - right.startPage);
};

export const parsePageRangeInput = (input) => {
  const rawValue = String(input || '').trim();
  if (!rawValue) return [];

  return rawValue
    .split(/[;,\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      const compact = segment.replace(/\s+/g, '');
      const rangeMatch = compact.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        return {
          startPage: Number(rangeMatch[1]),
          endPage: Number(rangeMatch[2])
        };
      }

      const singleMatch = compact.match(/^(\d+)$/);
      if (singleMatch) {
        const page = Number(singleMatch[1]);
        return { startPage: page, endPage: page };
      }

      return null;
    })
    .filter(Boolean);
};

export const invertPageRanges = (excludedRanges = [], pageCount = null) => {
  if (!pageCount || pageCount < 1) return [];

  const normalizedExcluded = normalizePageRanges(excludedRanges, pageCount);
  if (normalizedExcluded.length === 0) {
    return [{ startPage: 1, endPage: pageCount }];
  }

  const keptRanges = [];
  let cursor = 1;

  normalizedExcluded.forEach((range) => {
    if (cursor < range.startPage) {
      keptRanges.push({ startPage: cursor, endPage: range.startPage - 1 });
    }

    cursor = Math.max(cursor, range.endPage + 1);
  });

  if (cursor <= pageCount) {
    keptRanges.push({ startPage: cursor, endPage: pageCount });
  }

  return keptRanges.filter((range) => range.startPage <= range.endPage);
};

export const formatPageRanges = (ranges = []) => {
  const normalized = normalizePageRanges(ranges);
  if (normalized.length === 0) return '';
  return normalized.map((range) => `${range.startPage}-${range.endPage}`).join(', ');
};

export const getPdfPageCount = async (file) => {
  const pdfBytes = await file.arrayBuffer();
  const pdfDocument = await PDFDocument.load(pdfBytes);
  return pdfDocument.getPageCount();
};

export const buildSectionedPdfFile = async (file, ranges = []) => {
  const pdfBytes = await file.arrayBuffer();
  const sourceDocument = await PDFDocument.load(pdfBytes);
  const pageCount = sourceDocument.getPageCount();
  const normalizedRanges = normalizePageRanges(ranges, pageCount);

  if (normalizedRanges.length === 0) {
    throw new Error('Add at least one page range before storing the PDF section.');
  }

  const outputDocument = await PDFDocument.create();

  for (const range of normalizedRanges) {
    const pageIndexes = Array.from({ length: range.endPage - range.startPage + 1 }, (_, index) => range.startPage - 1 + index);
    const copiedPages = await outputDocument.copyPages(sourceDocument, pageIndexes);
    copiedPages.forEach((page) => outputDocument.addPage(page));
  }

  const outputBytes = await outputDocument.save();
  const baseName = getPdfBaseName(file.name);
  const suffix = normalizedRanges.map((range) => `${range.startPage}-${range.endPage}`).join('_');
  const outputName = `${baseName}_sections_${suffix || 'selected'}.pdf`;

  return {
    file: new File([outputBytes], outputName, { type: 'application/pdf' }),
    pageCount,
    pageRanges: normalizedRanges,
    outputName
  };
};

export const buildSectionPreviewUrl = async (file, ranges = []) => {
  const sectionedFile = await buildSectionedPdfFile(file, ranges);
  return {
    ...sectionedFile,
    previewUrl: URL.createObjectURL(sectionedFile.file)
  };
};