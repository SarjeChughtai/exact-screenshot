import type { Estimate } from '@/types';

export type QuickEstimatorFoundationType = 'slab' | 'frost_wall';
export type QuickEstimatorLinerOption = 'none' | 'walls' | 'ceiling' | 'both';

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
  includeInsulation: boolean;
  insulationGrade: string;
  includeGutters: boolean;
  linerOption: QuickEstimatorLinerOption;
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
  includeInsulation: false,
  insulationGrade: 'R20/R20',
  includeGutters: false,
  linerOption: 'none',
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

export function createInitialQuickEstimatorState(
  overrides?: Partial<QuickEstimatorPersistedState>,
): QuickEstimatorPersistedState {
  return {
    ...DEFAULT_QUICK_ESTIMATOR_STATE,
    ...overrides,
    selectedFactors: overrides?.selectedFactors
      ? [...overrides.selectedFactors]
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

  return createInitialQuickEstimatorState({
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
    includeInsulation: payload.includeInsulation === true,
    insulationGrade: payload.insulationGrade != null
      ? String(payload.insulationGrade)
      : DEFAULT_QUICK_ESTIMATOR_STATE.insulationGrade,
    includeGutters: payload.includeGutters === true,
    linerOption: (payload.linerOption as QuickEstimatorLinerOption) || DEFAULT_QUICK_ESTIMATOR_STATE.linerOption,
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
