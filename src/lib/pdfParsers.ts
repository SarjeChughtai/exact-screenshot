import * as pdfjsLib from 'pdfjs-dist';

export const COST_PARSER_VERSION = '2026-03-31';

export interface ParsedSteelComponent {
  name: string;
  weight?: number;
  cost: number;
}

export interface ParsedSteelCostDocument {
  documentType: 'mbs';
  projectId: string | null;
  clientName: string | null;
  clientId: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  widthFt: number | null;
  lengthFt: number | null;
  eaveHeightFt: number | null;
  leftEaveHeightFt: number | null;
  rightEaveHeightFt: number | null;
  isSingleSlope: boolean;
  roofSlope: number | null;
  floorAreaSqft: number | null;
  totalWeightLb: number | null;
  totalCost: number | null;
  costPerSqft: number | null;
  weightPerSqft: number | null;
  pricePerLb: number | null;
  snowLoadPsf: number | null;
  windLoadPsf: number | null;
  windCode: string | null;
  seismicCat: string | null;
  components: ParsedSteelComponent[];
  rawText: string;
}

export interface ParsedInsulationAccessory {
  description: string;
  quantity: string;
}

export interface ParsedInsulationCostDocument {
  documentType: 'insulation';
  projectId: string | null;
  clientName: string | null;
  location: string | null;
  province: string | null;
  postalCode: string | null;
  widthFt: number | null;
  lengthFt: number | null;
  eaveHeightFt: number | null;
  roofSlope: number | null;
  floorAreaSqft: number | null;
  roofRValue: string | null;
  wallRValue: string | null;
  grade: string | null;
  roofAreaSqft: number | null;
  wallAreaSqft: number | null;
  totalInsulatedSqft: number | null;
  materialCost: number | null;
  freightCost: number | null;
  fuelSurcharge: number | null;
  totalDelivery: number | null;
  totalCost: number | null;
  materialPerSqft: number | null;
  totalPerSqft: number | null;
  weightLb: number | null;
  shipBranch: string | null;
  quoteNumber: string | null;
  quoteDate: string | null;
  accessories: ParsedInsulationAccessory[];
  rawText: string;
}

export type ParsedCostDocument =
  | { type: 'mbs'; steel: ParsedSteelCostDocument; reviewStatus?: 'pending' | 'needs_review'; parseError?: string | null }
  | { type: 'insulation'; insulation: ParsedInsulationCostDocument; reviewStatus?: 'pending' | 'needs_review'; parseError?: string | null }
  | { type: 'unknown'; reviewStatus: 'needs_review'; parseError: string; rawText: string };

function parseNumber(value: string | undefined | null): number | null {
  if (!value) return null;
  const normalized = value.replace(/,/g, '').trim();
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toIsoDate(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[1]}-${match[2]}`;
}

function matchText(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() || null;
}

export async function extractTextFromPdf(file: File): Promise<string[]> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    pages.push(content.items.map((item: any) => item.str).join(' '));
  }

  return pages;
}

export function isInsulationQuoteText(text: string): boolean {
  return /Silvercote|QUOTATION|ROOF MATERIAL|WALLS MATERIAL/i.test(text);
}

export function parseMbsQuotePages(pages: string[]): ParsedSteelCostDocument | null {
  const rawText = pages.join('\n');
  const pageTwo = pages[1] || rawText;
  const summaryPage = pages.find((page) => /PRICE PER WEIGHT|PRICE PER FLOOR AREA/i.test(page)) || rawText;

  const projectId = matchText(rawText, /JOB\s*:?\s*([A-Za-z0-9-]+)/i);
  const clientName = matchText(pageTwo, /FOR\s+(.+?)\s+\d{5,}/i);
  const clientId = matchText(pageTwo, /FOR\s+.+?\s+(\d{5,})/i);
  const locationLine = matchText(pageTwo, /\d{5,}\s+([^,]+,\s*[A-Z]{2},\s*[A-Z0-9 ]{3,})/i);
  const city = locationLine?.split(',')[0]?.trim() || null;
  const province = locationLine?.split(',')[1]?.trim() || null;
  const postalCode = locationLine?.split(',')[2]?.trim() || null;

  const widthFt = parseNumber(matchText(pageTwo, /Width\s*\(ft\)\s*=\s*([\d.]+)/i));
  const lengthFt = parseNumber(matchText(pageTwo, /Length\s*\(ft\)\s*=\s*([\d.]+)/i));
  const heightMatch = rawText.match(/Eave Height\s*\(ft\)\s*=\s*([\d.]+)\s*\/\s*([\d.]+)/i)
    || rawText.match(/Eave Height\s*\(ft\)\s*=\s*([\d.]+)/i);

  const leftEaveHeightFt = heightMatch ? parseNumber(heightMatch[1]) : null;
  const rightEaveHeightFt = heightMatch?.[2] ? parseNumber(heightMatch[2]) : leftEaveHeightFt;
  const eaveHeightFt = Math.max(leftEaveHeightFt || 0, rightEaveHeightFt || 0) || null;
  const isSingleSlope = leftEaveHeightFt != null && rightEaveHeightFt != null && leftEaveHeightFt !== rightEaveHeightFt;
  const roofSlope = parseNumber(matchText(rawText, /Roof Slope\s*\(rise\/12\s*\)\s*=\s*([\d.]+)/i));

  const totalWeightLb = parseNumber(matchText(summaryPage, /Total:\s*([\d,]+\.?\d*)\s+[\d,]+\.?\d*/i));
  const totalCost = parseNumber(matchText(summaryPage, /Total:\s*[\d,]+\.?\d*\s+([\d,]+\.?\d*)/i));
  const pricePerLb = parseNumber(matchText(summaryPage, /PRICE PER WEIGHT\(lb\)\s*([\d.]+)/i));
  const costPerSqft = parseNumber(matchText(summaryPage, /PRICE PER FLOOR AREA\(ft2\)\s*([\d.]+)/i));
  const weightPerSqft = parseNumber(matchText(summaryPage, /WEIGHT PER FLOOR AREA\(ft2\)\s*([\d.]+)/i));
  const snowLoadPsf = parseNumber(matchText(pageTwo, /Snow Load\s*\(psf\s*\)\s*=\s*([\d.]+)/i));
  const windLoadPsf = parseNumber(matchText(pageTwo, /Wind Load 1:50\s*\(psf\s*\)\s*=\s*([\d.]+)/i));
  const windCode = matchText(pageTwo, /Wind Code\s*=\s*([A-Z]{2,}[^ ]*(?:\s*\([^)]+\))?)/i);
  const seismicCat = matchText(pageTwo, /Seismic Category\s*=\s*([A-Za-z0-9.-]+)/i);

  const components: ParsedSteelComponent[] = [];
  const componentSource = summaryPage.split(/Description\s+Weight\(lb\)\s+Price/i)[1] || '';
  for (const line of componentSource.split('\n')) {
    const match = line.match(/([A-Za-z][A-Za-z0-9 &,'()/.-]+?)\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/);
    if (!match) continue;
    const name = match[1].trim();
    if (/^Total:?$/i.test(name)) continue;
    const weight = parseNumber(match[2]) || undefined;
    const cost = parseNumber(match[3]) || 0;
    components.push({ name, weight, cost });
  }

  if (!projectId && !totalWeightLb && !totalCost) return null;

  return {
    documentType: 'mbs',
    projectId,
    clientName,
    clientId,
    city,
    province,
    postalCode,
    widthFt,
    lengthFt,
    eaveHeightFt,
    leftEaveHeightFt,
    rightEaveHeightFt,
    isSingleSlope,
    roofSlope,
    floorAreaSqft: widthFt && lengthFt ? widthFt * lengthFt : null,
    totalWeightLb,
    totalCost,
    costPerSqft,
    weightPerSqft,
    pricePerLb,
    snowLoadPsf,
    windLoadPsf,
    windCode,
    seismicCat,
    components,
    rawText,
  };
}

export function parseSilvercoteQuotePages(pages: string[]): ParsedInsulationCostDocument | null {
  const rawText = pages.join('\n');
  const quotePage = pages[0] || rawText;

  const buildingMatch = quotePage.match(/([A-Za-z0-9-]+):\s+([\d.]+)\s*ft W X\s*([\d.]+)\s*ft L X\s*([\d.]+)\s*ft H\s*DS:\s*([\d.]+):12/i);
  const projectId = buildingMatch?.[1]?.trim() || matchText(rawText, /ORDER NUMBER:\s*([A-Z0-9-]+)/i);
  const widthFt = parseNumber(buildingMatch?.[2]);
  const lengthFt = parseNumber(buildingMatch?.[3]);
  const eaveHeightFt = parseNumber(buildingMatch?.[4]);
  const roofSlope = parseNumber(buildingMatch?.[5]);

  const location = matchText(quotePage, /WOODBRIDGE, ON L4L 8N4\s+(.+?)\s+CONFIGURED BUILDING SECTION/i);
  const locationMatch = location?.match(/(.+?),\s*([A-Z]{2})\s+([A-Z0-9 ]{3,})/i);
  const province = locationMatch?.[2]?.trim() || null;
  const postalCode = locationMatch?.[3]?.trim() || null;

  const roofMaterial = matchText(quotePage, /ROOF MATERIAL:\s+(.+?)\s+([\d,]+)\s*sf/i);
  const roofAreaSqft = parseNumber(matchText(quotePage, /ROOF MATERIAL:\s+.+?\s+([\d,]+)\s*sf/i));
  const wallMaterial = matchText(quotePage, /WALLS MATERIAL:\s+(.+?)\s+\*See Diagram Page/i)
    || matchText(quotePage, /WALLS MATERIAL:\s+(.+?)\s+([\d,]+)\s*sf/i);
  const wallAreaSqft = parseNumber(matchText(quotePage, /WALLS MATERIAL:\s+.+?\s+([\d,]+)\s*sf/i));
  const roofRValue = matchText(roofMaterial || '', /R-([\d.]+)/i);
  const wallRValue = matchText(wallMaterial || '', /R-([\d.]+)/i);
  const grade = roofMaterial || wallMaterial;

  const freightCost = parseNumber(matchText(quotePage, /Freight\s+\$([\d,]+(?:\.\d+)?)/i));
  const fuelSurcharge = parseNumber(matchText(quotePage, /Fuel Surcharge\s+\$([\d,]+(?:\.\d+)?)/i));
  const totalCost = parseNumber(matchText(rawText, /TOTAL \(CAD\):\s*\$([\d,]+(?:\.\d+)?)/i));
  const weightLb = parseNumber(matchText(rawText, /Total Weight:\s*([\d,]+(?:\.\d+)?)/i));
  const quoteNumber = matchText(quotePage, /Quote #:\s*([A-Z0-9-]+\s*-?\s*\d+)/i)?.replace(/\s+/g, '') || null;
  const quoteDate = toIsoDate(matchText(quotePage, /Quote Date:\s*([0-9/]+)/i));
  const shipBranch = matchText(quotePage, /Shipping Branch:\s*([^\n]+?)\s+Account #:/i);

  const accessoriesSection = quotePage.split(/BUILDING ACCESSORIES:\s+QUANTITY:/i)[1]?.split(/CHARGES AND DISCOUNTS/i)[0] || '';
  const accessories: ParsedInsulationAccessory[] = [];
  for (const rawLine of accessoriesSection.split(/\s{2,}/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^(.+?)\s+([0-9]+(?:\s+[A-Z]+)?)$/i);
    if (match) {
      accessories.push({ description: match[1].trim(), quantity: match[2].trim() });
    }
  }

  const floorAreaSqft = widthFt && lengthFt ? widthFt * lengthFt : null;
  const totalInsulatedSqft = (roofAreaSqft || 0) + (wallAreaSqft || 0) || null;
  const totalDelivery = (freightCost || 0) + (fuelSurcharge || 0) || null;
  const materialCost = totalCost != null && totalDelivery != null ? totalCost - totalDelivery : null;
  const materialPerSqft = materialCost != null && totalInsulatedSqft ? materialCost / totalInsulatedSqft : null;
  const totalPerSqft = totalCost != null && totalInsulatedSqft ? totalCost / totalInsulatedSqft : null;

  if (!projectId && !totalCost) return null;

  return {
    documentType: 'insulation',
    projectId,
    clientName: 'CANADA STEEL BUILDINGS-SC',
    location,
    province,
    postalCode,
    widthFt,
    lengthFt,
    eaveHeightFt,
    roofSlope,
    floorAreaSqft,
    roofRValue,
    wallRValue,
    grade,
    roofAreaSqft,
    wallAreaSqft,
    totalInsulatedSqft,
    materialCost,
    freightCost,
    fuelSurcharge,
    totalDelivery,
    totalCost,
    materialPerSqft,
    totalPerSqft,
    weightLb,
    shipBranch,
    quoteNumber,
    quoteDate,
    accessories,
    rawText,
  };
}

export function parseCostDocumentFromPages(fileName: string, pages: string[]): ParsedCostDocument {
  const rawText = pages.join('\n');
  if (isInsulationQuoteText(rawText) || /Silvercote/i.test(fileName)) {
    const insulation = parseSilvercoteQuotePages(pages);
    if (insulation) {
      return { type: 'insulation', insulation, reviewStatus: insulation.totalCost ? 'pending' : 'needs_review', parseError: null };
    }
  }

  const steel = parseMbsQuotePages(pages);
  if (steel) {
    return { type: 'mbs', steel, reviewStatus: steel.totalCost ? 'pending' : 'needs_review', parseError: null };
  }

  return {
    type: 'unknown',
    reviewStatus: 'needs_review',
    parseError: `Unsupported or unrecognized cost document format: ${fileName}`,
    rawText,
  };
}
