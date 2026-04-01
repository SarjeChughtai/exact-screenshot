import type { Estimate } from '@/types';

export type QuickEstimatorFoundationType = 'slab' | 'frost_wall';
export type QuickEstimatorGutterMode = 'none' | 'per_side' | 'spacing';
export type QuickEstimatorLinerMode = 'none' | 'roof' | 'walls' | 'roof_walls';

export interface QuickEstimatorResultSnapshot {
  sqft: number;
  weight: number;
  steelCost: number;
  engineering: number;
  foundation: number;
  insulation: number;
  gutters: number;
  liners: number;
  freight: number;
  subtotal: number;
  internalMargin: number;
  estimatedTotal: number;
  contingency: number;
  gstHst: number;
  qst: number;
  grandTotal: number;
  province: string;
  steelWithMargin: number;
  markupType: string;
  markupRate: number;
  markupAmount: number;
}

export interface QuickEstimatorPersistedState {
  jobId: string;
  width: string;
  length: string;
  height: string;
  pitch: string;
  province: string;
  city: string;
  postalCode: string;
  distance: string;
  remoteLevel: string;
  locationInput: string;
  freightSource: string;
  guttersMode: QuickEstimatorGutterMode;
  guttersPerSide: string;
  guttersSpacing: string;
  gutterNotes: string;
  linersMode: QuickEstimatorLinerMode;
  linerNotes: string;
  insulationRequired: boolean;
  insulationRoofGrade: string;
  insulationWallGrade: string;
  foundationType: QuickEstimatorFoundationType;
  selectedFactors: string[];
  contingencyPct: string;
  singleSlope: boolean;
  leftEaveHeight: string;
  rightEaveHeight: string;
  clientName: string;
  clientId: string;
  salesRep: string;
  useFlat: boolean;
  flatMarkupPct: string;
  result: QuickEstimatorResultSnapshot | null;
}

export interface QuickEstimatorDraft {
  id: string;
  title: string;
  savedAt: string;
  state: QuickEstimatorPersistedState;
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export const QUICK_ESTIMATOR_ACTIVE_STATE_KEY = 'csb_quick_estimator_active_state';
export const QUICK_ESTIMATOR_DRAFTS_KEY = 'csb_quick_estimator_drafts';

const DEFAULT_QUICK_ESTIMATOR_STATE: QuickEstimatorPersistedState = {
  jobId: '',
  width: '',
  length: '',
  height: '',
  pitch: '1',
  province: 'ON',
  city: '',
  postalCode: '',
  distance: '200',
  remoteLevel: 'none',
  locationInput: '',
  freightSource: '',
  guttersMode: 'none',
  guttersPerSide: '',
  guttersSpacing: '',
  gutterNotes: '',
  linersMode: 'none',
  linerNotes: '',
  insulationRequired: false,
  insulationRoofGrade: 'R20/R20',
  insulationWallGrade: 'R20/R20',
  foundationType: 'slab',
  selectedFactors: ['Clear span up to 80ft'],
  contingencyPct: '5',
  singleSlope: false,
  leftEaveHeight: '',
  rightEaveHeight: '',
  clientName: '',
  clientId: '',
  salesRep: '',
  useFlat: false,
  flatMarkupPct: '5',
  result: null,
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return [...fallback];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim());
}

function asString(value: unknown, fallback = '') {
  return value != null ? String(value) : fallback;
}

function asBoolean(value: unknown) {
  return value === true || value === 'true';
}

export function normalizeQuickEstimatorGutterMode(
  value: Pick<QuickEstimatorPersistedState, 'guttersMode'> | Record<string, unknown>,
): QuickEstimatorGutterMode {
  const explicit = (value as Record<string, unknown>).guttersMode ?? (value as Record<string, unknown>).gutters;
  if (explicit === 'per_side' || explicit === 'spacing' || explicit === 'none') {
    return explicit;
  }
  return asBoolean((value as Record<string, unknown>).includeGutters) ? 'per_side' : 'none';
}

export function normalizeQuickEstimatorLinerMode(
  value: Pick<QuickEstimatorPersistedState, 'linersMode'> | Record<string, unknown>,
): QuickEstimatorLinerMode {
  const explicit = (value as Record<string, unknown>).linersMode ?? (value as Record<string, unknown>).linerLocation;
  if (explicit === 'roof' || explicit === 'walls' || explicit === 'roof_walls' || explicit === 'none') {
    return explicit;
  }

  const legacy = (value as Record<string, unknown>).linerOption;
  if (legacy === 'walls') return 'walls';
  if (legacy === 'ceiling') return 'roof';
  if (legacy === 'both') return 'roof_walls';
  return 'none';
}

export function getQuickEstimatorLegacyLinerOption(mode: QuickEstimatorLinerMode): 'none' | 'walls' | 'ceiling' | 'both' {
  if (mode === 'walls') return 'walls';
  if (mode === 'roof') return 'ceiling';
  if (mode === 'roof_walls') return 'both';
  return 'none';
}

function normalizeQuickEstimatorOverrides(
  overrides?: Partial<QuickEstimatorPersistedState> | Record<string, unknown>,
) {
  const next = (overrides || {}) as Record<string, unknown>;
  const insulationGrade = asString(next.insulationGrade, DEFAULT_QUICK_ESTIMATOR_STATE.insulationRoofGrade);

  return {
    ...next,
    jobId: asString(next.jobId),
    guttersMode: normalizeQuickEstimatorGutterMode(next),
    guttersPerSide: asString(next.guttersPerSide),
    guttersSpacing: asString(next.guttersSpacing),
    gutterNotes: asString(next.gutterNotes),
    linersMode: normalizeQuickEstimatorLinerMode(next),
    linerNotes: asString(next.linerNotes),
    insulationRequired: next.insulationRequired != null
      ? asBoolean(next.insulationRequired)
      : asBoolean(next.includeInsulation),
    insulationRoofGrade: asString(next.insulationRoofGrade, insulationGrade),
    insulationWallGrade: asString(next.insulationWallGrade, insulationGrade),
  } satisfies Partial<QuickEstimatorPersistedState>;
}

export function createInitialQuickEstimatorState(
  overrides?: Partial<QuickEstimatorPersistedState>,
): QuickEstimatorPersistedState {
  const normalizedOverrides = normalizeQuickEstimatorOverrides(overrides);
  return {
    ...DEFAULT_QUICK_ESTIMATOR_STATE,
    ...normalizedOverrides,
    selectedFactors: normalizedOverrides.selectedFactors
      ? [...(normalizedOverrides.selectedFactors as string[])]
      : [...DEFAULT_QUICK_ESTIMATOR_STATE.selectedFactors],
  };
}

export function getNextEstimateLabel(estimates: Array<Pick<Estimate, 'label'>>) {
  const maxNum = estimates.reduce((max, estimate) => {
    const match = estimate.label.match(/EST-(\d+)/);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);
  return `EST-${String(maxNum + 1).padStart(3, '0')}`;
}

export function getQuickEstimatorDraftTitle(
  state: Pick<QuickEstimatorPersistedState, 'clientName' | 'width' | 'length' | 'height'>,
) {
  if (state.clientName.trim()) return state.clientName.trim();

  const parts = [state.width, state.length, state.height].map(value => value.trim()).filter(Boolean);
  if (parts.length > 0) {
    return `${parts.join('x')} quick estimate`;
  }

  return 'Untitled quick estimate';
}

export function quickEstimatorStateFromEstimate(estimate: Estimate): QuickEstimatorPersistedState {
  const payload = asRecord(estimate.payload);
  const result = asRecord(payload.result);
  const insulationGrade = payload.insulationGrade != null
    ? String(payload.insulationGrade)
    : DEFAULT_QUICK_ESTIMATOR_STATE.insulationRoofGrade;
  const guttersMode = normalizeQuickEstimatorGutterMode(payload);
  const linersMode = normalizeQuickEstimatorLinerMode(payload);

  return createInitialQuickEstimatorState({
    jobId: estimate.jobId || '',
    width: estimate.width ? String(estimate.width) : '',
    length: estimate.length ? String(estimate.length) : '',
    height: estimate.height ? String(estimate.height) : '',
    pitch: estimate.pitch ? String(estimate.pitch) : '1',
    province: estimate.province || 'ON',
    city: estimate.city || '',
    postalCode: estimate.postalCode || '',
    distance: payload.distance != null ? String(payload.distance) : DEFAULT_QUICK_ESTIMATOR_STATE.distance,
    remoteLevel: payload.remoteLevel != null ? String(payload.remoteLevel) : DEFAULT_QUICK_ESTIMATOR_STATE.remoteLevel,
    locationInput: payload.locationInput != null ? String(payload.locationInput) : '',
    freightSource: payload.freightSource != null ? String(payload.freightSource) : '',
    guttersMode,
    guttersPerSide: payload.guttersPerSide != null ? String(payload.guttersPerSide) : '',
    guttersSpacing: payload.guttersSpacing != null ? String(payload.guttersSpacing) : '',
    gutterNotes: payload.gutterNotes != null ? String(payload.gutterNotes) : '',
    linersMode,
    linerNotes: payload.linerNotes != null ? String(payload.linerNotes) : '',
    insulationRequired: payload.insulationRequired != null
      ? asBoolean(payload.insulationRequired)
      : asBoolean(payload.includeInsulation),
    insulationRoofGrade: payload.insulationRoofGrade != null
      ? String(payload.insulationRoofGrade)
      : insulationGrade,
    insulationWallGrade: payload.insulationWallGrade != null
      ? String(payload.insulationWallGrade)
      : insulationGrade,
    foundationType: (payload.foundationType as QuickEstimatorFoundationType) || DEFAULT_QUICK_ESTIMATOR_STATE.foundationType,
    selectedFactors: asStringArray(payload.selectedFactors, DEFAULT_QUICK_ESTIMATOR_STATE.selectedFactors),
    contingencyPct: payload.contingencyPct != null
      ? String(payload.contingencyPct)
      : DEFAULT_QUICK_ESTIMATOR_STATE.contingencyPct,
    singleSlope: payload.singleSlope === true,
    leftEaveHeight: payload.leftEaveHeight != null ? String(payload.leftEaveHeight) : '',
    rightEaveHeight: payload.rightEaveHeight != null ? String(payload.rightEaveHeight) : '',
    clientName: estimate.clientName || '',
    clientId: estimate.clientId || '',
    salesRep: estimate.salesRep || '',
    useFlat: payload.useFlat === true,
    flatMarkupPct: payload.flatMarkupPct != null ? String(payload.flatMarkupPct) : DEFAULT_QUICK_ESTIMATOR_STATE.flatMarkupPct,
    result: Object.keys(result).length > 0 ? (result as QuickEstimatorResultSnapshot) : null,
  });
}

export function loadQuickEstimatorActiveState(storage: StorageLike) {
  const raw = storage.getItem(QUICK_ESTIMATOR_ACTIVE_STATE_KEY);
  if (!raw) return null;

  try {
    return createInitialQuickEstimatorState(JSON.parse(raw) as Partial<QuickEstimatorPersistedState>);
  } catch {
    return null;
  }
}

export function saveQuickEstimatorActiveState(
  storage: StorageLike,
  state: QuickEstimatorPersistedState,
) {
  storage.setItem(QUICK_ESTIMATOR_ACTIVE_STATE_KEY, JSON.stringify(state));
}

export function clearQuickEstimatorActiveState(storage: StorageLike) {
  storage.removeItem(QUICK_ESTIMATOR_ACTIVE_STATE_KEY);
}

export function loadQuickEstimatorDrafts(storage: StorageLike) {
  const raw = storage.getItem(QUICK_ESTIMATOR_DRAFTS_KEY);
  if (!raw) return [] as QuickEstimatorDraft[];

  try {
    const drafts = JSON.parse(raw) as QuickEstimatorDraft[];
    if (!Array.isArray(drafts)) return [];

    return drafts
      .filter((draft): draft is QuickEstimatorDraft => Boolean(draft?.id && draft?.savedAt && draft?.state))
      .map(draft => ({
        ...draft,
        state: createInitialQuickEstimatorState(draft.state),
      }));
  } catch {
    return [];
  }
}

export function saveQuickEstimatorDrafts(
  storage: StorageLike,
  drafts: QuickEstimatorDraft[],
) {
  storage.setItem(QUICK_ESTIMATOR_DRAFTS_KEY, JSON.stringify(drafts));
}
