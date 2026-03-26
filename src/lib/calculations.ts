import data from '@/data/referenceData.json';

const { steel_pricing, insulation_pricing, foundation_schedule, engineering_fees, tax_rates, freight_logic, markup_rules } = data;

export function lookupSteelTier(sqft: number) {
  const tiers = steel_pricing.tiers;
  let tier = tiers[0];
  for (const t of tiers) {
    if (sqft >= t.min_sqft) tier = t;
    else break;
  }
  return tier;
}

export function calcSteelCost(sqft: number): { cost: number; weight: number } {
  const tier = lookupSteelTier(sqft);
  const cost = tier.avg_cost_sqft * sqft * 1.12; // 12% supplier increase
  const weight = tier.avg_wt_sqft * sqft;
  return { cost, weight };
}

export function calcEngineering(complexityFactors: string[]): number {
  const base = engineering_fees.base_fee;
  const totalFactor = complexityFactors.reduce((sum, item) => {
    const cf = engineering_fees.complexity_factors.find(f => f.item === item);
    return sum + (cf ? cf.factor : 0);
  }, 0);
  return base * (totalFactor || 1) + engineering_fees.sell_markup;
}

export function calcEngineeringFromFactor(factor: number): number {
  return engineering_fees.base_fee * factor + engineering_fees.sell_markup;
}

export function lookupFoundation(sqft: number, type: 'slab' | 'frost_wall'): number {
  const tiers = foundation_schedule.tiers;
  // Round up to next tier
  let slabCost = tiers[tiers.length - 1].slab_cost;
  
  if (sqft > 30000) {
    const extra = Math.ceil((sqft - 30000) / 1000) * 100;
    slabCost = tiers[tiers.length - 1].slab_cost + extra;
  } else {
    for (const t of tiers) {
      if (sqft <= t.sqft) {
        slabCost = t.slab_cost;
        break;
      }
    }
  }
  
  const cost = type === 'frost_wall' ? slabCost * foundation_schedule.frost_wall_multiplier : slabCost;
  return cost + markup_rules.drawings_markup;
}

export function lookupInsulation(grade: string): number {
  const g = insulation_pricing.grades.find(i => i.grade === grade);
  return g ? g.material_per_sqft : 0;
}

export function calcInsulationArea(width: number, length: number, height: number): { wallArea: number; roofArea: number; total: number } {
  const wallArea = 2 * (width + length) * height;
  const roofArea = width * length;
  return { wallArea, roofArea, total: wallArea + roofArea };
}

export function calcFreight(distanceKm: number, weight: number, remoteLevel: string): number {
  const base = Math.max(freight_logic.minimum, distanceKm * freight_logic.base_rate_per_km);
  const remote = (freight_logic.remote_modifiers as Record<string, number>)[remoteLevel] || 0;
  const overweight = weight > freight_logic.overweight_threshold_lbs ? freight_logic.overweight_surcharge : 0;
  return base + remote + overweight;
}

export function getProvinceTax(code: string) {
  return tax_rates.provinces.find(p => p.code === code) || tax_rates.provinces[0];
}

export function calcTax(amount: number, provinceCode: string): { gstHst: number; qst: number; total: number } {
  const prov = getProvinceTax(provinceCode);
  if (prov.type === 'GST+QST') {
    const gst = amount * (prov.gst || 0.05);
    const qst = amount * (prov.qst || 0.09975);
    return { gstHst: gst, qst, total: gst + qst };
  }
  const rate = prov.order_rate;
  return { gstHst: amount * rate, qst: 0, total: amount * rate };
}

export function getMarkupRate(steelAfter12: number): number {
  for (const tier of markup_rules.internal_markup_tiers) {
    if (steelAfter12 <= tier.max_value) return tier.rate;
  }
  return 0.05;
}

export function calcMarkup(steelAfter12: number): number {
  const rate = getMarkupRate(steelAfter12);
  let markup = steelAfter12 * rate;
  if (steelAfter12 < markup_rules.minimum_margin.threshold && markup < markup_rules.minimum_margin.minimum_margin_dollars) {
    markup = markup_rules.minimum_margin.minimum_margin_dollars;
  }
  return markup;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

export const PROVINCES = tax_rates.provinces.map(p => ({ code: p.code, name: p.name }));
export const INSULATION_GRADES = insulation_pricing.grades.map(g => g.grade);
export const ENGINEERING_FACTORS = engineering_fees.complexity_factors;
export const REMOTE_LEVELS = ['none', 'moderate', 'remote', 'extreme'] as const;

/**
 * Auto-calculate engineering complexity factor based on building dimensions.
 * Larger buildings and wider clear spans require more engineering effort.
 * Based on analysis of 143 MBS projects.
 */
export function autoComplexityFactor(width: number, length: number, height: number): { factor: number; reason: string } {
  let factor = 1.0;
  const reasons: string[] = [];

  // Clear span width
  if (width > 80) {
    factor += 0.5;
    reasons.push(`Wide clear span (${width}ft > 80ft)`);
  } else if (width > 60) {
    factor += 0.15;
    reasons.push(`Moderate span (${width}ft)`);
  }

  // Building sqft complexity
  const sqft = width * length;
  if (sqft > 10000) {
    factor += 0.5;
    reasons.push(`Large building (${sqft.toLocaleString()} sqft)`);
  } else if (sqft > 5000) {
    factor += 0.25;
    reasons.push(`Mid-size building (${sqft.toLocaleString()} sqft)`);
  }

  // Height premium - taller buildings need more engineering
  if (height > 20) {
    factor += 0.5;
    reasons.push(`Tall structure (${height}ft > 20ft)`);
  } else if (height > 16) {
    factor += 0.25;
    reasons.push(`Above-standard height (${height}ft)`);
  }

  return { factor: Math.round(factor * 100) / 100, reason: reasons.length ? reasons.join('; ') : 'Standard complexity' };
}

/**
 * Estimate pitch impact on steel cost.
 * Standard pitch is 1:12. Higher pitches increase steel weight/cost.
 * Based on MBS data analysis: each 1:12 increase above standard adds ~3-5% to steel cost.
 */
export function pitchCostMultiplier(pitch: number): { multiplier: number; note: string } {
  // Standard pitch is 1:12 (0.5:12 to 1:12 considered standard)
  if (pitch <= 1) return { multiplier: 1.0, note: 'Standard pitch (≤1:12) — no adjustment' };
  if (pitch <= 2) return { multiplier: 1.04, note: `Pitch ${pitch}:12 — ~4% steel increase (more roof area + load)` };
  if (pitch <= 3) return { multiplier: 1.08, note: `Pitch ${pitch}:12 — ~8% steel increase` };
  if (pitch <= 4) return { multiplier: 1.12, note: `Pitch ${pitch}:12 — ~12% steel increase` };
  if (pitch <= 6) return { multiplier: 1.18, note: `Pitch ${pitch}:12 — ~18% steel increase` };
  return { multiplier: 1.25, note: `Steep pitch ${pitch}:12 — ~25% steel increase` };
}

/**
 * Estimate height impact on steel cost.
 * Standard eave height is 14ft. Taller buildings use more steel.
 * Based on MBS data: each foot above 14ft adds ~2-3% to steel weight.
 */
export function heightCostMultiplier(height: number): { multiplier: number; note: string } {
  if (height <= 14) return { multiplier: 1.0, note: 'Standard height (≤14ft) — no adjustment' };
  const extraFeet = height - 14;
  const multiplier = 1 + (extraFeet * 0.025); // 2.5% per foot above 14
  return { multiplier: Math.round(multiplier * 1000) / 1000, note: `${height}ft eave — ~${(extraFeet * 2.5).toFixed(1)}% more steel vs 14ft standard` };
}
