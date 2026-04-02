import { describe, expect, it } from 'vitest';

import {
  normalizeProvinceCode,
  inferRemoteLevel,
  estimateDistanceFromPostalCode,
  POSTAL_PREFIX_MAP,
} from '@/lib/geoDistance';

describe('normalizeProvinceCode', () => {
  it('returns two-letter codes as-is', () => {
    expect(normalizeProvinceCode('ON')).toBe('ON');
    expect(normalizeProvinceCode('bc')).toBe('BC');
    expect(normalizeProvinceCode(' AB ')).toBe('AB');
  });

  it('converts full province names to codes', () => {
    expect(normalizeProvinceCode('Ontario')).toBe('ON');
    expect(normalizeProvinceCode('British Columbia')).toBe('BC');
    expect(normalizeProvinceCode('Newfoundland and Labrador')).toBe('NL');
    expect(normalizeProvinceCode('Prince Edward Island')).toBe('PE');
  });

  it('handles null and undefined', () => {
    expect(normalizeProvinceCode(null)).toBe('');
    expect(normalizeProvinceCode(undefined)).toBe('');
    expect(normalizeProvinceCode('')).toBe('');
  });
});

describe('inferRemoteLevel', () => {
  it('returns none for short distances', () => {
    expect(inferRemoteLevel(500)).toBe('none');
    expect(inferRemoteLevel(1199)).toBe('none');
  });

  it('returns moderate for mid distances', () => {
    expect(inferRemoteLevel(1200)).toBe('moderate');
    expect(inferRemoteLevel(2499)).toBe('moderate');
  });

  it('returns remote for far distances', () => {
    expect(inferRemoteLevel(2500)).toBe('remote');
    expect(inferRemoteLevel(4199)).toBe('remote');
  });

  it('returns extreme for very far distances', () => {
    expect(inferRemoteLevel(4200)).toBe('extreme');
    expect(inferRemoteLevel(6000)).toBe('extreme');
  });
});

describe('estimateDistanceFromPostalCode', () => {
  it('returns distance and province for known prefixes', () => {
    const result = estimateDistanceFromPostalCode('V5K 0A1');
    expect(result).toEqual({ distanceKm: 4400, province: 'BC' });
  });

  it('uses provided province over heuristic province', () => {
    const result = estimateDistanceFromPostalCode('V5K 0A1', 'British Columbia');
    expect(result).toEqual({ distanceKm: 4400, province: 'BC' });
  });

  it('returns null for unknown prefix', () => {
    expect(estimateDistanceFromPostalCode('Z1A 1A1')).toBeNull();
  });

  it('returns null for empty or missing postal code', () => {
    expect(estimateDistanceFromPostalCode('')).toBeNull();
    expect(estimateDistanceFromPostalCode(undefined)).toBeNull();
  });

  it('handles lowercase postal codes', () => {
    const result = estimateDistanceFromPostalCode('t2p 1j9');
    expect(result).toEqual({ distanceKm: 3400, province: 'AB' });
  });

  it('covers all postal prefix entries', () => {
    for (const [prefix, entry] of Object.entries(POSTAL_PREFIX_MAP)) {
      const result = estimateDistanceFromPostalCode(`${prefix}1A 1A1`);
      expect(result).not.toBeNull();
      expect(result!.distanceKm).toBe(entry.distanceKm);
      expect(result!.province).toBe(entry.province);
    }
  });
});
