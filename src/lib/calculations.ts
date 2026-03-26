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
