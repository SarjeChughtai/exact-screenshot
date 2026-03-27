export interface CostLineItem {
  description: string;
  category: string;
  quantity: number;
  unit_price: number;
  total: number;
  vendor: string;
  date: string;
}

export interface AIExtractionResult {
  project_name: string | null;
  document_type: string;
  line_items: CostLineItem[];
  summary: {
    total_amount: number;
    currency: string;
  };
}

interface AIProviderConfig {
  provider: string;
  apiKey: string;
  baseUrl?: string | null;
}

const SYSTEM_PROMPT = `You are a cost data extraction assistant for a steel buildings company. Analyze the provided document content and extract all cost-related data.

Return ONLY valid JSON (no markdown, no code fences) with this exact structure:
{
  "project_name": "detected project/job name or null",
  "document_type": "invoice|quote|estimate|purchase_order|receipt|other",
  "line_items": [
    {
      "description": "Item description",
      "category": "materials|labor|subcontractor|freight|engineering|insulation|drawings|equipment|other",
      "quantity": 1,
      "unit_price": 0.00,
      "total": 0.00,
      "vendor": "Vendor name or empty string",
      "date": "YYYY-MM-DD or empty string"
    }
  ],
  "summary": {
    "total_amount": 0.00,
    "currency": "CAD"
  }
}

Rules:
- Extract every cost line item you can identify
- If quantity or unit_price aren't explicit, infer from context (e.g., total / quantity = unit_price)
- Categories should be one of: materials, labor, subcontractor, freight, engineering, insulation, drawings, equipment, other
- Dates should be in YYYY-MM-DD format
- Currency defaults to CAD unless clearly stated otherwise
- If you cannot determine a field, use reasonable defaults (0 for numbers, empty string for text)
- The summary total_amount should equal the sum of all line item totals`;

function getEndpointAndHeaders(config: AIProviderConfig): { url: string; headers: Record<string, string>; model: string } {
  switch (config.provider) {
    case 'perplexity':
      return {
        url: 'https://api.perplexity.ai/chat/completions',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        model: 'sonar',
      };
    case 'openrouter':
      return {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        model: 'anthropic/claude-sonnet-4',
      };
    case 'custom':
      return {
        url: `${(config.baseUrl || '').replace(/\/+$/, '')}/chat/completions`,
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        model: 'gpt-4o',
      };
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}

export async function processDocumentWithAI(
  documentContent: string,
  config: AIProviderConfig
): Promise<AIExtractionResult> {
  const { url, headers, model } = getEndpointAndHeaders(config);

  const truncated = documentContent.length > 50000
    ? documentContent.slice(0, 50000) + '\n\n[Content truncated due to length...]'
    : documentContent;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Please analyze this document and extract all cost data:\n\n${truncated}` },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('AI returned empty response');
  }

  // Parse the JSON from the response, stripping markdown fences if present
  let jsonStr = content.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }

  let result: AIExtractionResult;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse AI response as JSON. The AI may have returned an unexpected format.');
  }

  // Validate and fix the structure
  if (!result.line_items || !Array.isArray(result.line_items)) {
    result.line_items = [];
  }

  result.line_items = result.line_items.map(item => ({
    description: item.description || '',
    category: item.category || 'other',
    quantity: Number(item.quantity) || 0,
    unit_price: Number(item.unit_price) || 0,
    total: Number(item.total) || 0,
    vendor: item.vendor || '',
    date: item.date || '',
  }));

  if (!result.summary) {
    result.summary = {
      total_amount: result.line_items.reduce((sum, item) => sum + item.total, 0),
      currency: 'CAD',
    };
  }

  return result;
}

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // Use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const textParts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    textParts.push(`--- Page ${i} ---\n${pageText}`);
  }

  return textParts.join('\n\n');
}

export async function extractTextFromCSV(file: File): Promise<string> {
  return await file.text();
}

export async function extractTextFromXLSX(file: File): Promise<string> {
  const XLSX = await import('xlsx');
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  const textParts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    textParts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  return textParts.join('\n\n');
}

export async function extractFileContent(file: File): Promise<string> {
  const ext = file.name.toLowerCase().split('.').pop();

  switch (ext) {
    case 'pdf':
      return extractTextFromPDF(file);
    case 'csv':
      return extractTextFromCSV(file);
    case 'xlsx':
    case 'xls':
      return extractTextFromXLSX(file);
    default:
      throw new Error(`Unsupported file type: .${ext}`);
  }
}
