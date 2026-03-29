import { describe, it, expect, vi } from 'vitest';
import {
  calcSteelCost,
  calcFreight,
  calcTax,
  calcMarkup,
  formatCurrency,
  formatNumber,
  getProvinceTax
} from '../lib/calculations';

describe('Calculations - Steel Cost', () => {
  it('calculates proper tier pricing based on sqft', () => {
    // Small building (e.g. 800 sqft)
    const small = calcSteelCost(800);
    expect(small.cost).toBeGreaterThan(0);
    
    // Large building (e.g. 15000 sqft)
    const large = calcSteelCost(15000);
    expect(large.cost).toBeGreaterThan(0);
  });
});

describe('Calculations - Freight', () => {
  it('applies minimum freight charge', () => {
    // 10km is below minimum threshold
    const cost = calcFreight(10, 5000, 'none');
    expect(cost).toBe(4000); // freight_logic.minimum from JSON
  });

  it('calculates distance freight', () => {
    const cost = calcFreight(1000, 5000, 'none');
    expect(cost).toBeGreaterThan(1200);
  });
});

describe('Calculations - Tax Rates', () => {
  it('gets correct tax rates for provinces', () => {
    const onTax = getProvinceTax('ON');
    expect(onTax.name).toBe('Ontario');
    expect(onTax.order_rate).toBe(0.13);

    const abTax = getProvinceTax('AB');
    expect(abTax.name).toBe('Alberta');
    expect(abTax.order_rate).toBe(0.05);

    const qeTax = getProvinceTax('QC');
    expect(qeTax.name).toBe('Quebec');
    expect(qeTax.type).toBe('GST+QST');
  });

  it('calculates tax amounts', () => {
    const tax = calcTax(1000, 'ON');
    expect(tax.gstHst).toBe(130);
    expect(tax.qst).toBe(0);
    expect(tax.total).toBe(130);
  });
});

describe('Calculations - Formatting', () => {
  it('formats currency correctly', () => {
    expect(formatCurrency(1234.56)).toContain('$1,234.56');
    expect(formatCurrency(0)).toContain('$0.00');
  });

  it('formats numbers correctly', () => {
    expect(formatNumber(1234567, 0)).toBe('1,234,567');
    expect(formatNumber(1234.56, 1)).toBe('1,234.6');
  });
});
