export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedData: Record<string, unknown> | null;
}

export function validateAIOutput(
  raw: any,
  documentType: 'mbs' | 'insulation' | 'unknown',
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { isValid: false, errors: ['AI output is not a valid object'], warnings: [], sanitizedData: null };
  }

  if (documentType === 'mbs') {
    if (!raw.weight || raw.weight <= 0) errors.push('Missing or invalid weight');
    if (raw.weight > 500000) warnings.push(`Unusually high weight: ${raw.weight} lbs`);
    if (!raw.total_cost || raw.total_cost <= 0) errors.push('Missing or invalid total_cost');
    if (raw.cost_per_lb && raw.cost_per_lb > 10) warnings.push(`High cost_per_lb: $${raw.cost_per_lb}`);
    if (raw.width && (raw.width < 10 || raw.width > 300)) warnings.push(`Unusual width: ${raw.width}ft`);
    if (raw.length && (raw.length < 10 || raw.length > 500)) warnings.push(`Unusual length: ${raw.length}ft`);
    if (raw.height && (raw.height < 8 || raw.height > 60)) warnings.push(`Unusual height: ${raw.height}ft`);
  }

  if (documentType === 'insulation') {
    if (!raw.insulation_total || raw.insulation_total <= 0) errors.push('Missing insulation_total');
    if (raw.insulation_total > 200000) warnings.push(`Unusually high insulation cost: $${raw.insulation_total}`);
  }

  // Sanitize: coerce numeric fields
  const sanitizedData = { ...raw };
  for (const numField of ['weight', 'total_cost', 'cost_per_lb', 'width', 'length', 'height', 'roof_pitch', 'insulation_total']) {
    if (sanitizedData[numField] !== undefined && sanitizedData[numField] !== null) {
      sanitizedData[numField] = Number(sanitizedData[numField]) || 0;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedData: errors.length === 0 ? sanitizedData : raw,
  };
}
