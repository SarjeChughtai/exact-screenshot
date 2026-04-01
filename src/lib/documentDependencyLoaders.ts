let pdfJsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
let xlsxPromise: Promise<typeof import('xlsx-js-style')> | null = null;

export async function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = import('pdfjs-dist');
  }

  const pdfjsLib = await pdfJsPromise;
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  return pdfjsLib;
}

export async function loadXlsxJsStyle() {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx-js-style');
  }

  return xlsxPromise;
}
