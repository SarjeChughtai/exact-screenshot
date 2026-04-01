import type { Estimate, Quote } from '@/types';
import type { RFQOpening } from '@/lib/rfqShared';
import {
  normalizeQuickEstimatorGutterMode,
  normalizeQuickEstimatorLinerMode,
} from '@/lib/estimateWorkflow';

export type SharedRFQBuildingStyle = 'Symmetrical' | 'Single Slope';
export type SharedRFQGutterMode = 'none' | 'per_side' | 'spacing';
export type SharedRFQLinerMode = 'none' | 'roof' | 'walls' | 'roof_walls';

export interface SharedRFQFormValues {
  clientId: string;
  clientName: string;
  jobId: string;
  jobName: string;
  contactEmail: string;
  contactPhone: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  buildingStyle: SharedRFQBuildingStyle;
  width: string;
  length: string;
  height: string;
  lowSide: string;
  highSide: string;
  roofPitch: string;
  salesRep: string;
  estimator: string;
  gutters: SharedRFQGutterMode;
  guttersPerSide: string;
  guttersSpacing: string;
  gutterNotes: string;
  liners: SharedRFQLinerMode;
  linerLocation: '' | Exclude<SharedRFQLinerMode, 'none'>;
  linerNotes: string;
  insulationRequired: boolean;
  insulationRoofGrade: string;
  insulationWallGrade: string;
  notes: string;
}

const DEFAULT_FORM: SharedRFQFormValues = {
  clientId: '',
  clientName: '',
  jobId: '',
  jobName: '',
  contactEmail: '',
  contactPhone: '',
  province: 'ON',
  city: '',
  address: '',
  postalCode: '',
  buildingStyle: 'Symmetrical',
  width: '',
  length: '',
  height: '',
  lowSide: '',
  highSide: '',
  roofPitch: '1:12',
  salesRep: '',
  estimator: '',
  gutters: 'none',
  guttersPerSide: '',
  guttersSpacing: '',
  gutterNotes: '',
  liners: 'none',
  linerLocation: '',
  linerNotes: '',
  insulationRequired: false,
  insulationRoofGrade: '',
  insulationWallGrade: '',
  notes: '',
};

export function createInitialRFQFormValues(overrides?: Partial<SharedRFQFormValues>): SharedRFQFormValues {
  return { ...DEFAULT_FORM, ...overrides };
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 'true';
}

function normalizeGutterMode(payload: Record<string, unknown>): SharedRFQGutterMode {
  const explicit = payload.guttersMode ?? payload.gutters;
  if (explicit === 'per_side' || explicit === 'spacing' || explicit === 'none') {
    return explicit;
  }
  if (normalizeBoolean(explicit)) {
    return 'per_side';
  }
  return 'none';
}

function normalizeLinerMode(payload: Record<string, unknown>): SharedRFQLinerMode {
  const explicit = payload.linersMode ?? payload.linerLocation;
  if (explicit === 'roof' || explicit === 'walls' || explicit === 'roof_walls' || explicit === 'none') {
    return explicit;
  }
  if (normalizeBoolean(payload.liners)) {
    return 'roof_walls';
  }
  return 'none';
}

export function mapEstimateToSharedRFQForm(estimate: Estimate): Partial<SharedRFQFormValues> {
  const payload = (estimate.payload || {}) as Record<string, unknown>;
  const gutters = normalizeQuickEstimatorGutterMode(payload);
  const liners = normalizeQuickEstimatorLinerMode(payload);

  return {
    clientId: estimate.clientId,
    clientName: estimate.clientName,
    jobId: estimate.jobId || '',
    jobName: `${estimate.width}x${estimate.length} steel building`,
    province: estimate.province,
    city: estimate.city,
    postalCode: estimate.postalCode,
    buildingStyle: payload.singleSlope === true ? 'Single Slope' : 'Symmetrical',
    width: String(estimate.width),
    length: String(estimate.length),
    height: String(estimate.height),
    lowSide: String(payload.leftEaveHeight ?? ''),
    highSide: String(payload.rightEaveHeight ?? ''),
    roofPitch: `${estimate.pitch}:12`,
    salesRep: estimate.salesRep,
    gutters,
    guttersPerSide: String(payload.guttersPerSide ?? ''),
    guttersSpacing: String(payload.guttersSpacing ?? ''),
    gutterNotes: String(payload.gutterNotes ?? ''),
    liners,
    linerLocation: liners === 'none' ? '' : liners,
    linerNotes: String(payload.linerNotes ?? ''),
    insulationRequired: payload.insulationRequired === true || payload.includeInsulation === true,
    insulationRoofGrade: String(payload.insulationRoofGrade ?? payload.insulationGrade ?? ''),
    insulationWallGrade: String(payload.insulationWallGrade ?? payload.insulationGrade ?? ''),
    notes: estimate.notes || '',
  };
}

export function mapQuoteToSharedRFQForm(quote: Quote): SharedRFQFormValues {
  const payload = (quote.payload || {}) as Record<string, unknown>;
  const liners = normalizeLinerMode(payload);
  const linerLocation = liners === 'none' ? '' : liners;

  return createInitialRFQFormValues({
    clientId: quote.clientId,
    clientName: quote.clientName,
    jobId: quote.jobId,
    jobName: quote.jobName,
    contactEmail: String(payload.contactEmail ?? ''),
    contactPhone: String(payload.contactPhone ?? ''),
    province: quote.province,
    city: quote.city,
    address: quote.address,
    postalCode: quote.postalCode,
    buildingStyle: payload.buildingStyle === 'Single Slope' ? 'Single Slope' : 'Symmetrical',
    width: String(quote.width || ''),
    length: String(quote.length || ''),
    height: String(quote.height || ''),
    lowSide: String(payload.lowSide ?? ''),
    highSide: String(payload.highSide ?? ''),
    roofPitch: String(payload.roofPitch ?? ''),
    salesRep: quote.salesRep,
    estimator: quote.estimator,
    gutters: normalizeGutterMode(payload),
    guttersPerSide: String(payload.guttersPerSide ?? ''),
    guttersSpacing: String(payload.guttersSpacing ?? ''),
    gutterNotes: String(payload.gutterNotes ?? ''),
    liners,
    linerLocation,
    linerNotes: String(payload.linerNotes ?? ''),
    insulationRequired: Boolean(payload.insulationRequired),
    insulationRoofGrade: String(payload.insulationRoofGrade ?? ''),
    insulationWallGrade: String(payload.insulationWallGrade ?? ''),
    notes: String(payload.notes ?? ''),
  });
}

export function buildRFQPayloadFromForm(
  form: SharedRFQFormValues,
  openings: RFQOpening[],
  extras?: Record<string, unknown>,
) {
  return {
    buildingStyle: form.buildingStyle,
    lowSide: form.lowSide,
    highSide: form.highSide,
    roofPitch: form.roofPitch,
    openings,
    contactEmail: form.contactEmail,
    contactPhone: form.contactPhone,
    gutters: form.gutters !== 'none',
    guttersMode: form.gutters,
    guttersPerSide: form.guttersPerSide,
    guttersSpacing: form.guttersSpacing,
    gutterNotes: form.gutterNotes,
    liners: form.liners !== 'none',
    linersMode: form.liners,
    linerLocation: form.liners === 'none' ? '' : form.liners,
    linerNotes: form.linerNotes,
    insulationRequired: form.insulationRequired,
    insulationRoofGrade: form.insulationRoofGrade,
    insulationWallGrade: form.insulationWallGrade,
    notes: form.notes,
    ...(extras || {}),
  };
}

export function computeRFQDimensionsFromForm(form: SharedRFQFormValues) {
  const width = parseFloat(form.width) || 0;
  const length = parseFloat(form.length) || 0;
  const height =
    form.buildingStyle === 'Single Slope'
      ? parseFloat(form.highSide) || parseFloat(form.height) || 0
      : parseFloat(form.height) || 0;

  return {
    width,
    length,
    height,
    sqft: width * length,
  };
}
