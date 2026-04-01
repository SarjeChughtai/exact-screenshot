import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  calcSteelCost, calcEngineering, lookupFoundation, lookupInsulation,
  calcInsulationArea, calcFreight, calcTax, formatCurrency, formatNumber,
  PROVINCES, INSULATION_GRADES, ENGINEERING_FACTORS, calcMarkup, getMarkupRate,
} from '@/lib/calculations';
import { estimateFreightFromLocation } from '@/lib/freightEstimate';
import {
  clearQuickEstimatorActiveState,
  createInitialQuickEstimatorState,
  getNextEstimateLabel,
  getQuickEstimatorLegacyLinerOption,
  getQuickEstimatorDraftTitle,
  loadQuickEstimatorActiveState,
  loadQuickEstimatorDrafts,
  normalizeQuickEstimatorGutterMode,
  normalizeQuickEstimatorLinerMode,
  quickEstimatorStateFromEstimate,
  QUICK_ESTIMATOR_ACTIVE_STATE_KEY,
  QUICK_ESTIMATOR_DRAFTS_KEY,
  saveQuickEstimatorActiveState,
  saveQuickEstimatorDrafts,
  type QuickEstimatorDraft,
  type QuickEstimatorGutterMode,
  type QuickEstimatorLinerMode,
  type QuickEstimatorPersistedState,
  type QuickEstimatorResultSnapshot,
} from '@/lib/estimateWorkflow';
import { MapPin, Lightbulb, ChevronDown, Save, FolderOpen, PlusCircle, Trash2 } from 'lucide-react';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import type { Estimate } from '@/types';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { ClientSelect } from '@/components/ClientSelect';
import { JobIdSelect } from '@/components/JobIdSelect';
import { SimilarJobs } from '@/components/SimilarJobs';
import { mapQuoteToSharedRFQForm } from '@/lib/rfqForm';
import { jobIdsMatch } from '@/lib/jobIds';

const isBrowser = typeof window !== 'undefined';

export default function QuickEstimator() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addEstimate, estimates, updateEstimate, quotes, deals, clients } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { user } = useAuth();
  const isAdminOwner = hasAnyRole('admin', 'owner');

  const [jobId, setJobId] = useState('');
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [height, setHeight] = useState('');
  const [pitch, setPitch] = useState('1');
  const [province, setProvince] = useState('ON');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [distance, setDistance] = useState('200');
  const [remoteLevel, setRemoteLevel] = useState('none');
  const [locationInput, setLocationInput] = useState('');
  const [freightSource, setFreightSource] = useState('');
  const [guttersMode, setGuttersMode] = useState<QuickEstimatorGutterMode>('none');
  const [guttersPerSide, setGuttersPerSide] = useState('');
  const [guttersSpacing, setGuttersSpacing] = useState('');
  const [gutterNotes, setGutterNotes] = useState('');
  const [linersMode, setLinersMode] = useState<QuickEstimatorLinerMode>('none');
  const [linerNotes, setLinerNotes] = useState('');
  const [insulationRequired, setInsulationRequired] = useState(false);
  const [insulationRoofGrade, setInsulationRoofGrade] = useState('R20/R20');
  const [insulationWallGrade, setInsulationWallGrade] = useState('R20/R20');
  const [foundationType, setFoundationType] = useState<'slab' | 'frost_wall'>('slab');
  const [selectedFactors, setSelectedFactors] = useState<string[]>(['Clear span up to 80ft']);
  const [contingencyPct, setContingencyPct] = useState('5');
  const [result, setResult] = useState<QuickEstimatorResultSnapshot | null>(null);
  const [costSavingTips, setCostSavingTips] = useState<string[]>([]);
  const [singleSlope, setSingleSlope] = useState(false);
  const [leftEaveHeight, setLeftEaveHeight] = useState('');
  const [rightEaveHeight, setRightEaveHeight] = useState('');

  const handleEaveHeightChange = (side: 'left' | 'right', value: string) => {
    const left = side === 'left' ? value : leftEaveHeight;
    const right = side === 'right' ? value : rightEaveHeight;
    if (side === 'left') setLeftEaveHeight(value);
    else setRightEaveHeight(value);
    const maxH = Math.max(parseFloat(left) || 0, parseFloat(right) || 0);
    setHeight(maxH > 0 ? String(maxH) : '');
  };

  // Client & rep fields
  const [clientName, setClientName] = useState('');
  const [clientId, setClientId] = useState('');
  const [salesRep, setSalesRep] = useState('');

  // Admin/Owner markup toggle
  const [useFlat, setUseFlat] = useState(false);
  const [flatMarkupPct, setFlatMarkupPct] = useState('5');

  const [editingEstimateId, setEditingEstimateId] = useState<string | null>(null);
  const [loadedDraftId, setLoadedDraftId] = useState<string | null>(null);
  const [selectedEstimateId, setSelectedEstimateId] = useState('');
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [drafts, setDrafts] = useState<QuickEstimatorDraft[]>(() => (
    isBrowser ? loadQuickEstimatorDrafts(window.localStorage) : []
  ));

  const initializedRef = useRef(false);
  const lastLoadedRouteEstimateRef = useRef<string | null>(null);

  const editingEstimate = useMemo(
    () => estimates.find(estimate => estimate.id === editingEstimateId) || null,
    [editingEstimateId, estimates],
  );

  const sortedEstimates = useMemo(
    () => [...estimates].sort((left, right) => new Date(right.updatedAt || right.date).getTime() - new Date(left.updatedAt || left.date).getTime()),
    [estimates],
  );

  const sortedDrafts = useMemo(
    () => [...drafts].sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime()),
    [drafts],
  );

  const nextEstimateLabel = useMemo(() => getNextEstimateLabel(estimates), [estimates]);

  const currentWorkflowLabel = editingEstimate
    ? `Editing ${editingEstimate.label}`
    : loadedDraftId
      ? 'Loaded draft'
      : 'New estimate';

  const persistedState = useMemo<QuickEstimatorPersistedState>(() => createInitialQuickEstimatorState({
    jobId,
    width,
    length,
    height,
    pitch,
    province,
    city,
    postalCode,
    distance,
    remoteLevel,
    locationInput,
    freightSource,
    guttersMode,
    guttersPerSide,
    guttersSpacing,
    gutterNotes,
    linersMode,
    linerNotes,
    insulationRequired,
    insulationRoofGrade,
    insulationWallGrade,
    foundationType,
    selectedFactors,
    contingencyPct,
    singleSlope,
    leftEaveHeight,
    rightEaveHeight,
    clientName,
    clientId,
    salesRep,
    useFlat,
    flatMarkupPct,
    result,
  }), [
    city,
    clientId,
    clientName,
    contingencyPct,
    distance,
    flatMarkupPct,
    foundationType,
    freightSource,
    gutterNotes,
    guttersMode,
    guttersPerSide,
    guttersSpacing,
    height,
    insulationRequired,
    insulationRoofGrade,
    insulationWallGrade,
    jobId,
    leftEaveHeight,
    length,
    linerNotes,
    linersMode,
    locationInput,
    pitch,
    postalCode,
    province,
    remoteLevel,
    result,
    rightEaveHeight,
    salesRep,
    selectedFactors,
    singleSlope,
    useFlat,
    width,
  ]);

  const applyPersistedState = useCallback((nextState: QuickEstimatorPersistedState) => {
    setJobId(nextState.jobId);
    setWidth(nextState.width);
    setLength(nextState.length);
    setHeight(nextState.height);
    setPitch(nextState.pitch);
    setProvince(nextState.province);
    setCity(nextState.city);
    setPostalCode(nextState.postalCode);
    setDistance(nextState.distance);
    setRemoteLevel(nextState.remoteLevel);
    setLocationInput(nextState.locationInput);
    setFreightSource(nextState.freightSource);
    setGuttersMode(nextState.guttersMode);
    setGuttersPerSide(nextState.guttersPerSide);
    setGuttersSpacing(nextState.guttersSpacing);
    setGutterNotes(nextState.gutterNotes);
    setLinersMode(nextState.linersMode);
    setLinerNotes(nextState.linerNotes);
    setInsulationRequired(nextState.insulationRequired);
    setInsulationRoofGrade(nextState.insulationRoofGrade);
    setInsulationWallGrade(nextState.insulationWallGrade);
    setFoundationType(nextState.foundationType);
    setSelectedFactors(nextState.selectedFactors);
    setContingencyPct(nextState.contingencyPct);
    setSingleSlope(nextState.singleSlope);
    setLeftEaveHeight(nextState.leftEaveHeight);
    setRightEaveHeight(nextState.rightEaveHeight);
    setClientName(nextState.clientName);
    setClientId(nextState.clientId);
    setSalesRep(nextState.salesRep);
    setUseFlat(nextState.useFlat);
    setFlatMarkupPct(nextState.flatMarkupPct);
    setResult(nextState.result);
  }, []);

  const startNewEstimate = useCallback(() => {
    applyPersistedState(createInitialQuickEstimatorState());
    setCostSavingTips([]);
    setEditingEstimateId(null);
    setLoadedDraftId(null);
    setSelectedEstimateId('');
    setSelectedDraftId('');
    setSearchParams({});
    lastLoadedRouteEstimateRef.current = null;
    if (isBrowser) {
      clearQuickEstimatorActiveState(window.localStorage);
    }
  }, [applyPersistedState, setSearchParams]);

  const toggleFactor = (item: string) => {
    setSelectedFactors(prev => prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]);
  };

  const handleClientSelect = (client: { clientId: string; clientName: string }) => {
    setClientId(client.clientId);
    setClientName(client.clientName);
  };

  const handleJobIdChange = useCallback((nextJobId: string) => {
    setJobId(nextJobId);
    if (!nextJobId) return;

    const latestQuote = [...quotes]
      .filter(quote => !quote.isDeleted && jobIdsMatch(quote.jobId, nextJobId))
      .sort((left, right) =>
        new Date(right.updatedAt || right.createdAt || right.date).getTime()
        - new Date(left.updatedAt || left.createdAt || left.date).getTime(),
      )[0];
    const matchingDeal = deals.find(deal => jobIdsMatch(deal.jobId, nextJobId));
    const matchingClient = clients.find(client => client.jobIds.some(existingJobId => jobIdsMatch(existingJobId, nextJobId)));

    if (latestQuote) {
      const imported = mapQuoteToSharedRFQForm(latestQuote);
      const pitchValue = latestQuote.pitch != null
        ? String(latestQuote.pitch)
        : imported.roofPitch.endsWith(':12')
        ? imported.roofPitch.replace(':12', '')
        : imported.roofPitch;

      setClientId(latestQuote.clientId || matchingClient?.clientId || '');
      setClientName(latestQuote.clientName || matchingClient?.clientName || matchingClient?.name || '');
      setSalesRep(latestQuote.salesRep || '');
      setWidth(latestQuote.width ? String(latestQuote.width) : '');
      setLength(latestQuote.length ? String(latestQuote.length) : '');
      setHeight(latestQuote.height ? String(latestQuote.height) : '');
      setPitch(pitchValue || '1');
      setProvince(latestQuote.province || 'ON');
      setCity(latestQuote.city || '');
      setPostalCode(latestQuote.postalCode || '');
      setSingleSlope(Boolean(latestQuote.isSingleSlope || imported.buildingStyle === 'Single Slope'));
      setLeftEaveHeight(latestQuote.leftEaveHeight != null ? String(latestQuote.leftEaveHeight) : imported.lowSide);
      setRightEaveHeight(latestQuote.rightEaveHeight != null ? String(latestQuote.rightEaveHeight) : imported.highSide);
      setGuttersMode(imported.gutters);
      setGuttersPerSide(imported.guttersPerSide);
      setGuttersSpacing(imported.guttersSpacing);
      setGutterNotes(imported.gutterNotes);
      setLinersMode(imported.liners);
      setLinerNotes(imported.linerNotes);
      setInsulationRequired(imported.insulationRequired);
      setInsulationRoofGrade(imported.insulationRoofGrade || 'R20/R20');
      setInsulationWallGrade(imported.insulationWallGrade || imported.insulationRoofGrade || 'R20/R20');
      if (latestQuote.foundationType === 'slab' || latestQuote.foundationType === 'frost_wall') {
        setFoundationType(latestQuote.foundationType);
      }
      return;
    }

    if (matchingDeal) {
      setClientId(matchingDeal.clientId || matchingClient?.clientId || '');
      setClientName(matchingDeal.clientName || matchingClient?.clientName || matchingClient?.name || '');
      setSalesRep(matchingDeal.salesRep || '');
      setWidth(matchingDeal.width ? String(matchingDeal.width) : '');
      setLength(matchingDeal.length ? String(matchingDeal.length) : '');
      setHeight(matchingDeal.height ? String(matchingDeal.height) : '');
      setProvince(matchingDeal.province || 'ON');
      setCity(matchingDeal.city || '');
      setPostalCode(matchingDeal.postalCode || '');
      setSingleSlope(Boolean(matchingDeal.isSingleSlope));
      setLeftEaveHeight(matchingDeal.leftEaveHeight != null ? String(matchingDeal.leftEaveHeight) : '');
      setRightEaveHeight(matchingDeal.rightEaveHeight != null ? String(matchingDeal.rightEaveHeight) : '');
      return;
    }

    if (matchingClient) {
      setClientId(matchingClient.clientId);
      setClientName(matchingClient.clientName || matchingClient.name || '');
    }
  }, [clients, deals, quotes]);

  const loadEstimateIntoForm = useCallback((estimateId: string, updateRoute = true) => {
    const estimate = estimates.find(item => item.id === estimateId);
    if (!estimate) {
      toast.error('Estimate not found.');
      return;
    }

    applyPersistedState(quickEstimatorStateFromEstimate(estimate));
    setCostSavingTips([]);
    setEditingEstimateId(estimateId);
    setLoadedDraftId(null);
    setSelectedEstimateId(estimateId);
    setSelectedDraftId('');
    lastLoadedRouteEstimateRef.current = estimateId;
    if (updateRoute) {
      setSearchParams({ estimateId });
    }
  }, [applyPersistedState, estimates, setSearchParams]);

  const loadDraftIntoForm = useCallback((draftId: string) => {
    const draft = drafts.find(item => item.id === draftId);
    if (!draft) {
      toast.error('Draft not found.');
      return;
    }

    applyPersistedState(draft.state);
    setCostSavingTips([]);
    setLoadedDraftId(draftId);
    setSelectedDraftId(draftId);
    setEditingEstimateId(null);
    setSelectedEstimateId('');
    setSearchParams({});
    lastLoadedRouteEstimateRef.current = null;
  }, [applyPersistedState, drafts, setSearchParams]);

  const saveDraft = useCallback(() => {
    const draftId = loadedDraftId || crypto.randomUUID();
    const draft: QuickEstimatorDraft = {
      id: draftId,
      title: getQuickEstimatorDraftTitle(persistedState),
      savedAt: new Date().toISOString(),
      state: persistedState,
    };

    setDrafts(prev => {
      const next = [draft, ...prev.filter(item => item.id !== draftId)];
      return next.sort((left, right) => new Date(right.savedAt).getTime() - new Date(left.savedAt).getTime());
    });
    setLoadedDraftId(draftId);
    setSelectedDraftId(draftId);
    toast.success(loadedDraftId ? 'Draft updated' : 'Draft saved');
  }, [loadedDraftId, persistedState]);

  const deleteDraft = useCallback((draftId: string) => {
    setDrafts(prev => prev.filter(item => item.id !== draftId));
    if (loadedDraftId === draftId) setLoadedDraftId(null);
    if (selectedDraftId === draftId) setSelectedDraftId('');
    toast.success('Draft removed');
  }, [loadedDraftId, selectedDraftId]);

  useEffect(() => {
    const routeEstimateId = searchParams.get('estimateId');

    if (routeEstimateId) {
      if (lastLoadedRouteEstimateRef.current === routeEstimateId) return;
      const estimate = estimates.find(item => item.id === routeEstimateId);
      if (!estimate) return;

      applyPersistedState(quickEstimatorStateFromEstimate(estimate));
      setCostSavingTips([]);
      setEditingEstimateId(routeEstimateId);
      setLoadedDraftId(null);
      setSelectedEstimateId(routeEstimateId);
      setSelectedDraftId('');
      lastLoadedRouteEstimateRef.current = routeEstimateId;
      initializedRef.current = true;
      return;
    }

    lastLoadedRouteEstimateRef.current = null;
    if (!initializedRef.current && isBrowser) {
      const activeState = loadQuickEstimatorActiveState(window.localStorage);
      if (activeState) {
        applyPersistedState(activeState);
        setCostSavingTips([]);
      }
      initializedRef.current = true;
    }
  }, [applyPersistedState, estimates, searchParams]);

  useEffect(() => {
    if (!initializedRef.current || !isBrowser) return;
    saveQuickEstimatorActiveState(window.localStorage, persistedState);
  }, [persistedState]);

  useEffect(() => {
    if (!isBrowser) return;
    saveQuickEstimatorDrafts(window.localStorage, drafts);
  }, [drafts]);

  const handleLocationLookup = async () => {
    const lookupInput = [postalCode.trim(), city.trim(), province.trim()].filter(Boolean).join(', ');
    if (!lookupInput) {
      setFreightSource('Enter a postal code, city, or province');
      return;
    }
    setFreightSource('Looking up distance...');
    setLocationInput(lookupInput);
    const estimate = await estimateFreightFromLocation(lookupInput);
    if (estimate) {
      setDistance(estimate.distanceKm.toString());
      setRemoteLevel(estimate.remote);
      setProvince(estimate.province);
      const via = estimate.distanceSource === 'maps' ? 'Maps API' : 'heuristic';
      setFreightSource(`Auto: ~${estimate.distanceKm}km via ${via} (${estimate.method})`);
    } else {
      setFreightSource('Could not estimate — enter manually');
    }
  };

  const calculate = () => {
    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const h = parseFloat(height) || 14;
    const sqft = w * l;
    if (sqft <= 0) return;

    const steel = calcSteelCost(sqft);
    const eng = calcEngineering(selectedFactors);
    const found = lookupFoundation(sqft, foundationType);
    const insulationArea = calcInsulationArea(w, l, h);

    let ins = 0;
    if (insulationRequired) {
      const roofRate = lookupInsulation(insulationRoofGrade);
      const wallRate = lookupInsulation(insulationWallGrade || insulationRoofGrade);
      ins = (roofRate * insulationArea.roofArea) + (wallRate * insulationArea.wallArea);
    }

    let gutters = 0;
    if (guttersMode === 'per_side') {
      const sides = Math.max(parseFloat(guttersPerSide) || 2, 1);
      gutters = l * sides * 10;
    } else if (guttersMode === 'spacing') {
      const spacing = parseFloat(guttersSpacing) || 20;
      const downspoutCount = Math.max(Math.ceil((2 * (w + l)) / spacing), 2);
      gutters = (l * 2 * 10) + (downspoutCount * 65);
    }

    let linerArea = 0;
    if (linersMode === 'walls') linerArea = insulationArea.wallArea;
    else if (linersMode === 'roof') linerArea = sqft;
    else if (linersMode === 'roof_walls') linerArea = insulationArea.wallArea + sqft;
    const liners = linerArea * 3.25;

    const frt = calcFreight(parseFloat(distance) || 0, steel.weight, remoteLevel);

    // Pitch recorded for info only — no cost adjustment
    const p = parseFloat(pitch) || 1;
    const adjustedSteel = steel.cost;

    // Calculate markup - baked into steel price (hidden from user)
    let markupAmount: number;
    let markupRate: number;
    let markupType: string;

    if (isAdminOwner && useFlat) {
      markupRate = parseFloat(flatMarkupPct) / 100;
      markupAmount = adjustedSteel * markupRate;
      markupType = `Flat ${flatMarkupPct}%`;
    } else {
      markupAmount = calcMarkup(adjustedSteel);
      markupRate = getMarkupRate(adjustedSteel);
      markupType = `Tiered ${(markupRate * 100).toFixed(1)}%`;
    }

    const steelWithMargin = adjustedSteel + markupAmount;

    const subtotal = steelWithMargin + eng + found + ins + gutters + liners + frt;
    const contingency = subtotal * (parseFloat(contingencyPct) || 0) / 100;
    const estimatedTotal = subtotal;
    const taxes = calcTax(subtotal + contingency, province);

    setResult({
      sqft, weight: steel.weight,
      steelCost: adjustedSteel, engineering: eng, foundation: found,
      insulation: ins, gutters, liners, freight: frt,
      subtotal, internalMargin: markupAmount, estimatedTotal,
      contingency, gstHst: taxes.gstHst, qst: taxes.qst,
      grandTotal: subtotal + contingency + taxes.total,
      province,
      steelWithMargin,
      markupType,
      markupRate,
      markupAmount,
    });

    // Generate cost-saving tips
    const tips: string[] = [];
    if (w > 80) tips.push(`🏗️ Buildings over 80ft wide require multi-span framing — significantly more costly. Consider ≤ 80ft width.`);
    if (foundationType === 'frost_wall') tips.push(`🧱 Frost wall foundations cost ~65% more than slab. Verify if slab-on-grade is feasible.`);
    if (remoteLevel === 'extreme') tips.push(`🚛 Extreme remote freight adds $3,000+. Consider a staging/pickup arrangement.`);
    if (remoteLevel === 'remote') tips.push(`🚛 Remote location adds $1,500 to freight. Check if a closer delivery point is available.`);
    if (sqft > 10000 && parseFloat(contingencyPct) >= 5) tips.push(`💰 For large buildings (${formatNumber(sqft)} sqft), contingency could be reduced to 3% — larger projects have more predictable costs.`);
    if (insulationRequired && (!insulationRoofGrade || !insulationWallGrade)) tips.push(`🧊 Specify roof and wall insulation grades to keep the RFQ import complete.`);
    setCostSavingTips(tips);
  };

  const saveEstimate = (): Estimate | null => {
    if (!result) {
      toast.error('Calculate an estimate first.');
      return null;
    }
    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const h = parseFloat(height) || 14;
    const p = parseFloat(pitch) || 1;
    const rep = salesRep || currentUser.name || user?.email || '';
    const nowIso = new Date().toISOString();

    const auditNotes: string[] = [
      `Steel base: ${formatCurrency(result.steelCost)} at ${formatNumber(result.weight)} lbs`,
      `Margin baked in: ${result.markupType} = ${formatCurrency(result.markupAmount)}`,
      `Steel shown to client: ${formatCurrency(result.steelWithMargin)}`,
      `Engineering factors: ${selectedFactors.join(', ')}`,
      `Location: ${[city, province, postalCode].filter(Boolean).join(', ') || province}`,
    ];

    const label = editingEstimate?.label || nextEstimateLabel;
    const estimate: Estimate = {
      id: editingEstimate?.id || crypto.randomUUID(),
      label,
      date: editingEstimate?.date || nowIso.split('T')[0],
      jobId: jobId || null,
      clientName: clientName || 'TBD',
      clientId: clientId || '',
      salesRep: rep,
      width: w, length: l, height: h, pitch: p,
      province,
      city,
      postalCode,
      grandTotal: result.grandTotal,
      sqft: result.sqft,
      estimatedTotal: result.estimatedTotal,
      notes: editingEstimate?.notes || '',
      auditNotes,
      payload: {
        jobId,
        distance, remoteLevel, foundationType, contingencyPct,
        guttersMode,
        guttersPerSide,
        guttersSpacing,
        gutterNotes,
        linersMode,
        linerLocation: linersMode === 'none' ? '' : linersMode,
        linerNotes,
        insulationRequired,
        insulationRoofGrade,
        insulationWallGrade,
        includeInsulation: insulationRequired,
        insulationGrade: insulationRoofGrade || insulationWallGrade,
        includeGutters: guttersMode !== 'none',
        linerOption: getQuickEstimatorLegacyLinerOption(linersMode),
        locationInput, freightSource, useFlat, flatMarkupPct,
        singleSlope, leftEaveHeight, rightEaveHeight, selectedFactors,
        result,
      },
      createdByUserId: editingEstimate?.createdByUserId || currentUser.id || user?.id || null,
      createdAt: editingEstimate?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (editingEstimate) {
      void updateEstimate(editingEstimate.id, estimate);
      toast.success(`Estimate ${label} updated`);
    } else {
      void addEstimate(estimate);
      toast.success(`Estimate ${label} saved`);
    }

    if (loadedDraftId) {
      setDrafts(prev => prev.filter(item => item.id !== loadedDraftId));
      setLoadedDraftId(null);
      setSelectedDraftId('');
    }

    setEditingEstimateId(estimate.id);
    setSelectedEstimateId(estimate.id);
    setSearchParams({ estimateId: estimate.id });
    return estimate;
  };

  const convertToRFQ = () => {
    if (!result) {
      toast.error('Calculate an estimate first.');
      return;
    }

    const w = parseFloat(width) || 0;
    const l = parseFloat(length) || 0;
    const h = parseFloat(height) || 14;
    if (!w || !l) {
      toast.error('Missing building dimensions.');
      return;
    }

    const savedEstimate = saveEstimate();
    if (!savedEstimate) return;

    toast.success('Estimate imported into RFQ builder');
    navigate(`/quote-rfq?estimateId=${savedEstimate.id}`);

  };

  // Build compliance/audit notes for admin/owner
  const complianceNotes = result ? [
    `Base steel (before margin): ${formatCurrency(result.steelCost)}`,
    `Margin type: ${result.markupType}`,
    `Margin amount: ${formatCurrency(result.markupAmount)} (${(result.markupRate * 100).toFixed(1)}%)`,
    `Steel shown (margin baked in): ${formatCurrency(result.steelWithMargin)}`,
    `$/sqft: ${formatCurrency(result.subtotal / result.sqft)}`,
    `Weight: ${formatNumber(result.weight)} lbs`,
  ] : [];

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Quick Estimator</h2>
        <p className="text-sm text-muted-foreground mt-1">Instant ballpark pricing before a factory quote</p>
        <p className="text-xs text-muted-foreground mt-2">{currentWorkflowLabel}</p>
      </div>

      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Workflow Continuity</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Active estimator state is stored locally in
              {' '}
              <span className="font-mono">{QUICK_ESTIMATOR_ACTIVE_STATE_KEY}</span>
              {' '}
              and drafts in
              {' '}
              <span className="font-mono">{QUICK_ESTIMATOR_DRAFTS_KEY}</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={startNewEstimate}>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Estimate
            </Button>
            <Button variant="outline" onClick={saveDraft}>
              <Save className="h-4 w-4 mr-2" />
              {loadedDraftId ? 'Update Draft' : 'Save Draft'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-xs">Load Existing Estimate</Label>
            <div className="flex gap-2">
              <Select value={selectedEstimateId} onValueChange={setSelectedEstimateId}>
                <SelectTrigger className="input-blue">
                  <SelectValue placeholder="Select a saved estimate" />
                </SelectTrigger>
                <SelectContent>
                  {sortedEstimates.length === 0 ? (
                    <SelectItem value="__none__" disabled>No saved estimates</SelectItem>
                  ) : sortedEstimates.map(estimate => (
                    <SelectItem key={estimate.id} value={estimate.id}>
                      {estimate.label} | {estimate.clientName || 'TBD'} | {estimate.updatedAt?.split('T')[0] || estimate.date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!selectedEstimateId}
                onClick={() => loadEstimateIntoForm(selectedEstimateId)}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Load
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Load Draft</Label>
            <div className="flex gap-2">
              <Select value={selectedDraftId} onValueChange={setSelectedDraftId}>
                <SelectTrigger className="input-blue">
                  <SelectValue placeholder="Select a saved draft" />
                </SelectTrigger>
                <SelectContent>
                  {sortedDrafts.length === 0 ? (
                    <SelectItem value="__none__" disabled>No drafts saved</SelectItem>
                  ) : sortedDrafts.map(draft => (
                    <SelectItem key={draft.id} value={draft.id}>
                      {draft.title} | {new Date(draft.savedAt).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                disabled={!selectedDraftId}
                onClick={() => loadDraftIntoForm(selectedDraftId)}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                Load
              </Button>
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={!selectedDraftId}
                onClick={() => deleteDraft(selectedDraftId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-5 bg-card border rounded-lg p-5">
          {/* Client & Sales Rep */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client & Rep</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Job ID</Label>
                <JobIdSelect
                  value={jobId}
                  onValueChange={handleJobIdChange}
                  placeholder="Select or create a job ID"
                  triggerTestId="quick-estimator-job-id"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Selecting a shared job ID pulls the latest matching RFQ, quote, or deal defaults into this estimate when available.
                </p>
              </div>
              <div>
                <Label className="text-xs">Client Name</Label>
                <ClientSelect mode="name" valueId={clientId} valueName={clientName} onSelect={handleClientSelect} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Client ID</Label>
                <ClientSelect mode="id" valueId={clientId} valueName={clientName} onSelect={handleClientSelect} className="mt-1" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Sales Rep <span className="text-muted-foreground">(auto-assigned if empty)</span></Label>
                <PersonnelSelect value={salesRep} onValueChange={setSalesRep} role="sales_rep" className="mt-1" />
              </div>
            </div>
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Building Details</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Width (ft)</Label><Input className="input-blue mt-1" value={width} onChange={e => setWidth(e.target.value)} /></div>
            <div><Label className="text-xs">Length (ft)</Label><Input className="input-blue mt-1" value={length} onChange={e => setLength(e.target.value)} /></div>
            {!singleSlope ? (
              <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" value={height} onChange={e => setHeight(e.target.value)} /></div>
            ) : (
              <div><Label className="text-xs">Max Height (auto)</Label><Input className="input-blue mt-1 opacity-60" value={height} readOnly /></div>
            )}
            <div><Label className="text-xs">Roof Pitch (:12)</Label><Input className="input-blue mt-1" value={pitch} onChange={e => setPitch(e.target.value)} placeholder="1" /></div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={singleSlope} onCheckedChange={v => { setSingleSlope(v); if (!v) { setLeftEaveHeight(''); setRightEaveHeight(''); } }} />
            <Label className="text-xs">Single Slope</Label>
          </div>
          {singleSlope && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Left Eave Height (ft)</Label>
                <Input className="input-blue mt-1" value={leftEaveHeight} onChange={e => handleEaveHeightChange('left', e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Right Eave Height (ft)</Label>
                <Input className="input-blue mt-1" value={rightEaveHeight} onChange={e => handleEaveHeightChange('right', e.target.value)} />
              </div>
            </div>
          )}

          {/* Location */}
          <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-accent" />
              Auto Freight Estimate
            </Label>
            <div className="grid grid-cols-4 gap-2">
              <Input
                className="input-blue"
                value={postalCode}
                onChange={e => setPostalCode(e.target.value)}
                placeholder="Postal code"
                onKeyDown={e => e.key === 'Enter' && void handleLocationLookup()}
              />
              <Input
                className="input-blue col-span-2"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City"
                onKeyDown={e => e.key === 'Enter' && void handleLocationLookup()}
              />
              <Button size="sm" variant="outline" onClick={() => void handleLocationLookup()}>Lookup</Button>
            </div>
            {freightSource && <p className="text-[10px] text-muted-foreground">{freightSource}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Distance from Bradford (km)</Label><Input className="input-blue mt-1" value={distance} onChange={e => setDistance(e.target.value)} /></div>
          </div>

          <div>
            <Label className="text-xs">Remote Level</Label>
            <Select value={remoteLevel} onValueChange={setRemoteLevel}>
              <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="moderate">Moderate (+$500)</SelectItem>
                <SelectItem value="remote">Remote (+$1,500)</SelectItem>
                <SelectItem value="extreme">Extreme (+$3,000)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Foundation Type</Label>
              <Select value={foundationType} onValueChange={v => setFoundationType(v as 'slab' | 'frost_wall')}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="slab">Slab</SelectItem>
                  <SelectItem value="frost_wall">Frost Wall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Contingency %</Label><Input className="input-blue mt-1" value={contingencyPct} onChange={e => setContingencyPct(e.target.value)} /></div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox checked={insulationRequired} onCheckedChange={v => setInsulationRequired(!!v)} />
              <Label className="text-xs">Include Insulation</Label>
            </div>
            {insulationRequired && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Roof Insulation</Label>
                  <Select value={insulationRoofGrade} onValueChange={setInsulationRoofGrade}>
                    <SelectTrigger className="input-blue"><SelectValue /></SelectTrigger>
                    <SelectContent>{INSULATION_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Wall Insulation</Label>
                  <Select value={insulationWallGrade} onValueChange={setInsulationWallGrade}>
                    <SelectTrigger className="input-blue"><SelectValue /></SelectTrigger>
                    <SelectContent>{INSULATION_GRADES.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <Label className="text-xs">Gutters</Label>
              <Select value={guttersMode} onValueChange={value => setGuttersMode(value as QuickEstimatorGutterMode)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="per_side">Per Side</SelectItem>
                  <SelectItem value="spacing">Spacing / Downspouts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {guttersMode === 'per_side' && (
              <div>
                <Label className="text-xs">Gutter Sides</Label>
                <Input className="input-blue mt-1" value={guttersPerSide} onChange={e => setGuttersPerSide(e.target.value)} placeholder="2" />
              </div>
            )}
            {guttersMode === 'spacing' && (
              <div>
                <Label className="text-xs">Downspout Spacing (ft)</Label>
                <Input className="input-blue mt-1" value={guttersSpacing} onChange={e => setGuttersSpacing(e.target.value)} placeholder="20" />
              </div>
            )}
            {guttersMode !== 'none' && (
              <div>
                <Label className="text-xs">Gutter Notes</Label>
                <Input className="input-blue mt-1" value={gutterNotes} onChange={e => setGutterNotes(e.target.value)} placeholder="Optional gutter details" />
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs">Liners</Label>
            <Select value={linersMode} onValueChange={value => setLinersMode(value as QuickEstimatorLinerMode)}>
              <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Liners</SelectItem>
                <SelectItem value="roof">Roof Only</SelectItem>
                <SelectItem value="walls">Walls Only</SelectItem>
                <SelectItem value="roof_walls">Roof + Walls</SelectItem>
              </SelectContent>
            </Select>
            {linersMode !== 'none' && (
              <div>
                <Label className="text-xs">Liner Notes</Label>
                <Input className="input-blue mt-1" value={linerNotes} onChange={e => setLinerNotes(e.target.value)} placeholder="Optional liner details" />
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs mb-2 block">Engineering Complexity</Label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {ENGINEERING_FACTORS.map(f => (
                <div key={f.item} className="flex items-center gap-2">
                  <Checkbox checked={selectedFactors.includes(f.item)} onCheckedChange={() => toggleFactor(f.item)} />
                  <Label className="text-xs">{f.item} (×{f.factor})</Label>
                </div>
              ))}
            </div>
          </div>

          {/* Admin/Owner: Markup Toggle */}
          {isAdminOwner && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Use Flat Markup (instead of tiered)</Label>
                <Switch checked={useFlat} onCheckedChange={setUseFlat} />
              </div>
              {useFlat && (
                <div>
                  <Label className="text-xs">Flat Markup %</Label>
                  <Input className="input-blue mt-1" type="number" step="0.5" value={flatMarkupPct} onChange={e => setFlatMarkupPct(e.target.value)} />
                </div>
              )}
            </div>
          )}

          <Button onClick={calculate} className="w-full">Calculate Estimate</Button>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Estimate Summary</h3>
            <div className="text-xs text-muted-foreground">
              {parseFloat(width)}&apos; × {parseFloat(length)}&apos; × {parseFloat(height)}&apos; | Pitch: {pitch}:12 | {formatNumber(result.sqft)} sqft | {formatNumber(result.weight)} lbs
            </div>

            <div className="text-xs text-muted-foreground">
              Client: {clientName || 'TBD'} | Location: {[city, province, postalCode].filter(Boolean).join(', ') || province}
            </div>
            {jobId && (
              <div className="text-xs text-muted-foreground">
                Job ID: {jobId}
              </div>
            )}

            <div className="space-y-2 text-sm">
              <Row label="Steel" value={result.steelWithMargin} bold />
              <Row label="Engineering Fee" value={result.engineering} />
              <Row label="Foundation Drawing" value={result.foundation} />
              {result.insulation > 0 && <Row label={`Insulation (Roof ${insulationRoofGrade || 'N/A'} / Walls ${insulationWallGrade || 'N/A'})`} value={result.insulation} />}
              {result.gutters > 0 && <Row label="Gutters & Downspouts" value={result.gutters} />}
              {result.liners > 0 && <Row label="Liners" value={result.liners} />}
              <Row label="Freight Estimate" value={result.freight} />
              <div className="border-t pt-2" />
              <Row label="Estimated Total" value={result.estimatedTotal} bold />
              <Row label={`Contingency (${contingencyPct}%)`} value={result.contingency} />
              <div className="border-t pt-2" />
              <Row label="GST/HST" value={result.gstHst} />
              {result.qst > 0 && <Row label="QST" value={result.qst} />}
              <div className="border-t pt-2" />
              <div className="flex justify-between text-base font-bold text-foreground">
                <span>GRAND TOTAL (incl. tax)</span>
                <span>{formatCurrency(result.grandTotal)}</span>
              </div>
              <div className="text-xs text-muted-foreground text-right">
                {formatCurrency(result.estimatedTotal / result.sqft)}/sqft
              </div>

              <div className="pt-2 space-y-2">
                <Button onClick={saveEstimate} variant="outline" className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  {editingEstimate ? `Update Estimate (${editingEstimate.label})` : `Save Estimate (${nextEstimateLabel})`}
                </Button>
                <Button onClick={convertToRFQ} className="w-full">
                  Convert to RFQ (Stage 1)
                </Button>
              </div>

              {/* Cost-Saving Tips */}
              {costSavingTips.length > 0 && (
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-1.5 mt-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                    <Lightbulb className="h-3.5 w-3.5" /> Cost-Saving Opportunities
                  </div>
                  {costSavingTips.map((tip, i) => (
                    <p key={i} className="text-xs text-muted-foreground">{tip}</p>
                  ))}
                </div>
              )}

              {/* Admin/Owner Compliance Notes */}
              {isAdminOwner && complianceNotes.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="w-full">
                    <div className="bg-card border rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors mt-3">
                      <span className="text-xs font-semibold text-muted-foreground">🔒 Compliance Notes (Owner View)</span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="bg-card border border-t-0 rounded-b-lg p-4 space-y-1">
                      {complianceNotes.map((note, i) => (
                        <p key={i} className="text-xs text-muted-foreground font-mono">{note}</p>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Similar Jobs Comparison - always visible once dimensions are entered */}
      {(parseFloat(width) > 0 && parseFloat(length) > 0) && (
        <SimilarJobs
          width={parseFloat(width) || 0}
          length={parseFloat(length) || 0}
          height={parseFloat(height) || 14}
        />
      )}
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''} ${muted ? 'text-muted-foreground text-xs' : ''}`}>
      <span>{label}</span>
      <span className="font-mono">{formatCurrency(value)}</span>
    </div>
  );
}
