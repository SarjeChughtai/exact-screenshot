import { describe, it, expect, vi } from 'vitest';
import { csvCurrency, csvDate } from '../lib/csvExport';

describe('CSV Export Utilities', () => {
  it('formats currency correctly for CSV', () => {
    // Should plain strings with 2 decimals, no '$' or commas to avoid parsing issues
    expect(csvCurrency(1234.56)).toBe('1234.56');
    expect(csvCurrency(1000)).toBe('1000.00');
    expect(csvCurrency(0)).toBe('0.00');
  });

  it('formats date string properly', () => {
    expect(csvDate('2024-05-10')).toBe('2024-05-10');
    expect(csvDate('')).toBe('');
    expect(csvDate(undefined as unknown as string)).toBe('');
  });
});
