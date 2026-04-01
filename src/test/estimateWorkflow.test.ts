import { describe, expect, it } from 'vitest';

import type { Estimate } from '@/types';
import {
  QUICK_ESTIMATOR_ACTIVE_STATE_KEY,
  QUICK_ESTIMATOR_DRAFTS_KEY,
  createInitialQuickEstimatorState,
  getNextEstimateLabel,
  loadQuickEstimatorActiveState,
  loadQuickEstimatorDrafts,
  quickEstimatorStateFromEstimate,
  saveQuickEstimatorActiveState,
  saveQuickEstimatorDrafts,
} from '@/lib/estimateWorkflow';
import { mapEstimateToSharedRFQForm } from '@/lib/rfqForm';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
    removeItem(key: string) {
      store.delete(key);
    },
  };
}

function buildEstimate(overrides: Partial<Estimate> = {}): Estimate {
  return {
    id: 'estimate-1',
    label: 'EST-001',
    date: '2026-03-31',
    jobId: 'JOB-100',
    clientName: 'North Yard',
    clientId: 'CL-001',
    salesRep: 'Rep One',
    width: 60,
    length: 100,
    height: 18,
    pitch: 1,
    province: 'ON',
    city: 'Barrie',
    postalCode: 'L4N 0A1',
    grandTotal: 100000,
    sqft: 6000,
    estimatedTotal: 90000,
    notes: '',
    auditNotes: [],
    payload: {
      distance: '250',
      remoteLevel: 'moderate',
      locationInput: 'Barrie, ON',
      freightSource: 'Auto',
      insulationRequired: true,
      insulationRoofGrade: 'R20/R20',
      insulationWallGrade: 'R12/R20',
      includeInsulation: true,
      insulationGrade: 'R20/R20',
      guttersMode: 'spacing',
      guttersSpacing: '20',
      gutterNotes: 'Front elevation',
      includeGutters: true,
      linersMode: 'walls',
      linerNotes: 'Wall liner package',
      linerOption: 'walls',
      foundationType: 'slab',
      selectedFactors: ['Clear span up to 80ft'],
      contingencyPct: '5',
      singleSlope: false,
      leftEaveHeight: '',
      rightEaveHeight: '',
      useFlat: false,
      flatMarkupPct: '5',
      result: {
        sqft: 6000,
        weight: 50000,
        steelCost: 60000,
        engineering: 1500,
        foundation: 1000,
        insulation: 5000,
        gutters: 1500,
        liners: 2500,
        freight: 3500,
        subtotal: 75000,
        internalMargin: 7000,
        estimatedTotal: 82000,
        contingency: 4100,
        gstHst: 11193,
        qst: 0,
        grandTotal: 97293,
        province: 'ON',
        steelWithMargin: 67000,
        markupType: 'Tiered 10%',
        markupRate: 0.1,
        markupAmount: 7000,
      },
    },
    createdByUserId: 'user-1',
    createdAt: '2026-03-31T10:00:00.000Z',
    updatedAt: '2026-03-31T10:30:00.000Z',
    ...overrides,
  };
}

describe('estimate workflow helpers', () => {
  it('derives the next estimate label from saved estimates', () => {
    expect(getNextEstimateLabel([{ label: 'EST-001' }, { label: 'EST-009' }, { label: 'CUSTOM' }])).toBe('EST-010');
  });

  it('maps estimate state into the persisted quick estimator state including location fields', () => {
    const state = quickEstimatorStateFromEstimate(buildEstimate());

    expect(state.city).toBe('Barrie');
    expect(state.postalCode).toBe('L4N 0A1');
    expect(state.distance).toBe('250');
    expect(state.jobId).toBe('JOB-100');
    expect(state.insulationRequired).toBe(true);
    expect(state.insulationRoofGrade).toBe('R20/R20');
    expect(state.insulationWallGrade).toBe('R12/R20');
    expect(state.guttersMode).toBe('spacing');
    expect(state.guttersSpacing).toBe('20');
    expect(state.linersMode).toBe('walls');
  });

  it('persists active state and drafts to storage', () => {
    const storage = createMemoryStorage();
    const state = createInitialQuickEstimatorState({
      clientName: 'Saved Draft Client',
      city: 'Toronto',
      postalCode: 'M5V 2T6',
    });

    saveQuickEstimatorActiveState(storage, state);
    saveQuickEstimatorDrafts(storage, [
      { id: 'draft-1', title: 'Draft 1', savedAt: '2026-03-31T12:00:00.000Z', state },
    ]);

    expect(loadQuickEstimatorActiveState(storage)?.city).toBe('Toronto');
    expect(loadQuickEstimatorDrafts(storage)).toHaveLength(1);
    expect(storage.getItem(QUICK_ESTIMATOR_ACTIVE_STATE_KEY)).toContain('Toronto');
    expect(storage.getItem(QUICK_ESTIMATOR_DRAFTS_KEY)).toContain('Draft 1');
  });

  it('transfers estimate location fields into the shared RFQ form', () => {
    const form = mapEstimateToSharedRFQForm(buildEstimate());

    expect(form.jobId).toBe('JOB-100');
    expect(form.city).toBe('Barrie');
    expect(form.province).toBe('ON');
    expect(form.postalCode).toBe('L4N 0A1');
    expect(form.gutters).toBe('spacing');
    expect(form.guttersSpacing).toBe('20');
    expect(form.liners).toBe('walls');
    expect(form.insulationRequired).toBe(true);
    expect(form.insulationRoofGrade).toBe('R20/R20');
    expect(form.insulationWallGrade).toBe('R12/R20');
  });
});
