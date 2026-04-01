import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Quote,
  Deal,
  Opportunity,
  DealMilestone,
  InternalCost,
  PaymentEntry,
  CommissionPayout,
  ProductionRecord,
  FreightRecord,
  RFQ,
  Client,
  Vendor,
  Estimate,
  SteelCostDataRecord,
  InsulationCostDataRecord,
  StoredDocument,
  JobProfile,
  CommissionRecipientSetting,
} from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/context/RoleContext';
import { useSettings, type PersonnelEntry, type PersonnelRole } from '@/context/SettingsContext';
import { logAudit } from '@/lib/auditLog';
import {
  dealFromRow, dealToRow,
  quoteFromRow, quoteToRow,
  estimateFromRow, estimateToRow,
  internalCostFromRow, internalCostToRow,
  paymentFromRow, paymentToRow,
  commissionPayoutFromRow, commissionPayoutToRow,
  productionFromRow, productionToRow,
  freightFromRow, freightToRow,
  clientFromRow, clientToRow,
  vendorFromRow, vendorToRow,
  steelCostDataFromRow,
  insulationCostDataFromRow,
  storedDocumentFromRow,
  jobProfileFromRow,
  jobProfileToRow,
  commissionRecipientSettingFromRow,
  commissionRecipientSettingToRow,
  opportunityFromRow,
  opportunityToRow,
  dealMilestoneFromRow,
  dealMilestoneToRow,
} from '@/lib/supabaseMappers';
import { SEED_DEALS } from '@/data/seedDeals';
import { toast } from 'sonner';
import {
  buildDealMilestoneRecord,
  buildOpportunityFromDeal,
  buildOpportunityFromQuote,
} from '@/lib/opportunities';
import {
  buildProductionShadowRecord,
  deriveDealProductionStatusFromRecord,
} from '@/lib/productionLifecycle';
import { jobIdsMatch, resolveCanonicalJobId } from '@/lib/jobIds';
import {
  buildJobProfileFromDeal,
  buildJobProfileFromEstimate,
  buildJobProfileFromFreight,
  buildJobProfileFromQuote,
  findJobProfile,
  mergeJobProfile,
} from '@/lib/jobProfiles';
import {
  buildClientSeedForLedger,
  buildVendorSeedForLedger,
  findClientRecordForLedger,
  findVendorRecordForLedger,
} from '@/lib/paymentLedgerIntegrity';

interface AppState {
  quotes: Quote[];
  deals: Deal[];
  opportunities: Opportunity[];
  dealMilestones: DealMilestone[];
  internalCosts: InternalCost[];
  payments: PaymentEntry[];
  commissionPayouts: CommissionPayout[];
  production: ProductionRecord[];
  freight: FreightRecord[];
  rfqs: RFQ[];
  clients: Client[];
  vendors: Vendor[];
  estimates: Estimate[];
  steelCostData: SteelCostDataRecord[];
  insulationCostData: InsulationCostDataRecord[];
  storedDocuments: StoredDocument[];
  jobProfiles: JobProfile[];
  commissionRecipientSettings: CommissionRecipientSetting[];
  loading: boolean;
}

interface AppContextType extends AppState {
  addQuote: (q: Quote) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  restoreQuote: (id: string) => void;
  addDeal: (d: Deal) => void;
  updateDeal: (jobId: string, updates: Partial<Deal>) => void;
  deleteDeal: (jobId: string) => void;
  updateOpportunityByJob: (jobId: string, updates: Partial<Opportunity>) => Promise<void>;
  upsertDealMilestone: (jobId: string, milestoneKey: DealMilestone['milestoneKey'], isComplete: boolean, notes?: string) => Promise<void>;
  addInternalCost: (ic: InternalCost) => void;
  updateInternalCost: (jobId: string, updates: Partial<InternalCost>) => void;
  addPayment: (p: PaymentEntry) => Promise<void>;
  updatePayment: (id: string, updates: Partial<PaymentEntry>) => Promise<void>;
  deletePayment: (id: string) => void;
  upsertCommissionPayout: (payout: CommissionPayout) => Promise<void>;
  deleteCommissionPayout: (id: string) => Promise<void>;
  addProduction: (pr: ProductionRecord) => void;
  updateProduction: (jobId: string, updates: Partial<ProductionRecord>) => void;
  addFreight: (fr: FreightRecord) => void;
  updateFreight: (jobId: string, updates: Partial<FreightRecord>) => void;
  addRFQ: (rfq: RFQ) => void;
  updateRFQ: (id: string, updates: Partial<RFQ>) => void;
  deleteRFQ: (id: string) => void;
  addClient: (c: Client) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  addVendor: (v: Vendor) => void;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  addEstimate: (estimate: Estimate) => void;
  updateEstimate: (id: string, updates: Partial<Estimate>) => void;
  deleteEstimate: (id: string) => void;
  allocateJobId: () => Promise<string>;
  quickAddClient: (clientId: string, clientName: string, jobId?: string) => Promise<Client | null>;
  quickAddVendor: (vendorName: string, province?: string) => Promise<Vendor | null>;
  upsertJobProfile: (updates: Partial<JobProfile> & { jobId: string }) => Promise<JobProfile | null>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useRoles();
  const { settings, updateSettings } = useSettings();
  const [state, setState] = useState<AppState>({
    quotes: [],
    deals: [],
    opportunities: [],
    dealMilestones: [],
    internalCosts: [],
    payments: [],
    commissionPayouts: [],
    production: [],
    freight: [],
    rfqs: [],
    clients: [],
    vendors: [],
    estimates: [],
    steelCostData: [],
    insulationCostData: [],
    storedDocuments: [],
    jobProfiles: [],
    commissionRecipientSettings: [],
    loading: true,
  });

  const buildAuthoritativeProductionState = useCallback((deals: Deal[], productionRows: ProductionRecord[]) => {
    const productionByJobId = new Map<string, ProductionRecord>();

    for (const row of productionRows) {
      productionByJobId.set(row.jobId, row);
    }

    for (const deal of deals) {
      productionByJobId.set(deal.jobId, buildProductionShadowRecord({
        jobId: deal.jobId,
        productionStatus: deal.productionStatus,
        insulationStatus: deal.insulationStatus,
      }));
    }

    return Array.from(productionByJobId.values());
  }, []);

  const ensureManualPersonnelEntry = useCallback(async (name: string, roles: PersonnelRole[]) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const existing = settings.personnel.find(person =>
      person.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );

    if (existing) {
      const mergedRoles = Array.from(new Set([...(existing.roles || [existing.role]), ...roles])) as PersonnelRole[];
      const existingManual = settings.externalPersonnel.find(person => person.id === existing.id);
      if (existingManual && mergedRoles.length !== (existing.roles || []).length) {
        await updateSettings({
          externalPersonnel: settings.externalPersonnel.map(person =>
            person.id === existingManual.id ? { ...person, role: mergedRoles[0], roles: mergedRoles } : person,
          ),
        });
      }
      return;
    }

    const nextEntry: PersonnelEntry = {
      id: `manual:${trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: trimmedName,
      email: '',
      role: roles[0],
      roles,
    };

    await updateSettings({
      externalPersonnel: [...settings.externalPersonnel, nextEntry],
    });
  }, [settings, updateSettings]);

  const upsertJobProfile = useCallback(async (updates: Partial<JobProfile> & { jobId: string }) => {
    const canonicalJobId = resolveCanonicalJobId(updates.jobId) || updates.jobId.trim();
    if (!canonicalJobId) return null;

    const existing = findJobProfile(state.jobProfiles, canonicalJobId);
    const nextProfile = mergeJobProfile(existing, { ...updates, jobId: canonicalJobId });

    setState(prev => ({
      ...prev,
      jobProfiles: [...prev.jobProfiles.filter(profile => !jobIdsMatch(profile.jobId, canonicalJobId)), nextProfile],
    }));

    try {
      const { data, error } = await (supabase.from as any)('job_profiles')
        .upsert(jobProfileToRow(nextProfile), { onConflict: 'job_id' })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const mapped = jobProfileFromRow(data);
        setState(prev => ({
          ...prev,
          jobProfiles: [...prev.jobProfiles.filter(profile => !jobIdsMatch(profile.jobId, canonicalJobId)), mapped],
        }));
        return mapped;
      }
    } catch (error) {
      console.error('Failed to persist job profile', error);
    }

    return nextProfile;
  }, [state.jobProfiles]);

  const syncJobProfileFromQuote = useCallback(async (quote: Partial<Quote>) => {
    const seed = buildJobProfileFromQuote(quote);
    if (seed) {
      await upsertJobProfile(seed);
    }
  }, [upsertJobProfile]);

  const syncJobProfileFromDeal = useCallback(async (deal: Partial<Deal>) => {
    const seed = buildJobProfileFromDeal(deal);
    if (seed) {
      await upsertJobProfile(seed);
    }
  }, [upsertJobProfile]);

  const syncJobProfileFromEstimate = useCallback(async (estimate: Partial<Estimate>) => {
    const seed = buildJobProfileFromEstimate(estimate);
    if (seed) {
      await upsertJobProfile(seed);
    }
  }, [upsertJobProfile]);

  const syncJobProfileFromFreight = useCallback(async (record: Partial<FreightRecord>) => {
    const seed = buildJobProfileFromFreight(record);
    if (seed) {
      await upsertJobProfile(seed);
    }
  }, [upsertJobProfile]);

  const fetchAll = useCallback(async () => {
    try {
      const [
        quotesRes,
        dealsRes,
        opportunitiesRes,
        dealMilestonesRes,
        costsRes,
        paymentsRes,
        commissionPayoutsRes,
        prodRes,
        freightRes,
        clientsRes,
        vendorsRes,
        estimatesRes,
        steelCostRes,
        insulationCostRes,
        storedDocumentsRes,
        jobProfilesRes,
        commissionRecipientSettingsRes,
      ] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('deals').select('*'),
        (supabase.from as any)('opportunities').select('*'),
        (supabase.from as any)('deal_milestones').select('*'),
        supabase.from('internal_costs').select('*'),
        supabase.from('payments').select('*'),
        (supabase.from as any)('commission_payouts').select('*'),
        supabase.from('production').select('*'),
        supabase.from('freight').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('vendors').select('*'),
        (supabase.from as any)('estimates').select('*'),
        (supabase.from as any)('steel_cost_data').select('*'),
        (supabase.from as any)('insulation_cost_data').select('*'),
        (supabase.from as any)('stored_documents').select('*'),
        (supabase.from as any)('job_profiles').select('*'),
        (supabase.from as any)('commission_recipient_settings').select('*'),
      ]);

      // Log fetch results for debugging
      console.log('Supabase fetch results:', {
        quotes: quotesRes.data?.length, quotesErr: quotesRes.error,
        deals: dealsRes.data?.length, dealsErr: dealsRes.error,
        opportunities: opportunitiesRes.data?.length, opportunitiesErr: opportunitiesRes.error,
        dealMilestones: dealMilestonesRes.data?.length, dealMilestonesErr: dealMilestonesRes.error,
        costs: costsRes.data?.length, costsErr: costsRes.error,
        payments: paymentsRes.data?.length, paymentsErr: paymentsRes.error,
        commissionPayouts: commissionPayoutsRes.data?.length, commissionPayoutsErr: commissionPayoutsRes.error,
        production: prodRes.data?.length, prodErr: prodRes.error,
        freight: freightRes.data?.length, freightErr: freightRes.error,
        clients: clientsRes.data?.length, clientsErr: clientsRes.error,
        vendors: vendorsRes.data?.length, vendorsErr: vendorsRes.error,
        estimates: estimatesRes.data?.length, estimatesErr: estimatesRes.error,
        steelCostData: steelCostRes.data?.length, steelCostErr: steelCostRes.error,
        insulationCostData: insulationCostRes.data?.length, insulationCostErr: insulationCostRes.error,
        storedDocuments: storedDocumentsRes.data?.length, storedDocumentsErr: storedDocumentsRes.error,
        jobProfiles: jobProfilesRes.data?.length, jobProfilesErr: jobProfilesRes.error,
        commissionRecipientSettings: commissionRecipientSettingsRes.data?.length, commissionRecipientSettingsErr: commissionRecipientSettingsRes.error,
      });

      // Check if any core query had an error (e.g. RLS blocking unauthenticated)
      const anyError = [quotesRes, dealsRes, costsRes, paymentsRes, prodRes, freightRes].some(r => r.error);

      if (anyError) {
        console.warn('Supabase fetch failed, falling back to localStorage');
        loadFromLocalStorage();
        return;
      }

      const quotes = (quotesRes.data || []).map(quoteFromRow);
      const deals = (dealsRes.data || []).map(dealFromRow);
      const opportunities = (opportunitiesRes.data || []).map(opportunityFromRow);
      const dealMilestones = (dealMilestonesRes.data || []).map(dealMilestoneFromRow);
      const internalCosts = (costsRes.data || []).map(internalCostFromRow);
      const payments = (paymentsRes.data || []).map(paymentFromRow);
      const commissionPayouts = commissionPayoutsRes.error
        ? []
        : ((commissionPayoutsRes.data || []).map(commissionPayoutFromRow));
      const production = buildAuthoritativeProductionState(
        deals,
        (prodRes.data || []).map(productionFromRow),
      );
      const freight = (freightRes.data || []).map(freightFromRow);
      const clients = (clientsRes.data || []).map(clientFromRow);
      const vendors = (vendorsRes.data || []).map(vendorFromRow);
      const estimates = (estimatesRes.data || []).map(estimateFromRow);
      const steelCostData = (steelCostRes.data || []).map(steelCostDataFromRow);
      const insulationCostData = (insulationCostRes.data || []).map(insulationCostDataFromRow);
      const storedDocuments = (storedDocumentsRes.data || []).map(storedDocumentFromRow);
      const jobProfiles = jobProfilesRes.error ? [] : ((jobProfilesRes.data || []).map(jobProfileFromRow));
      const commissionRecipientSettings = commissionRecipientSettingsRes.error ? [] : ((commissionRecipientSettingsRes.data || []).map(commissionRecipientSettingFromRow));

      // If all Supabase tables are empty, try migrating from localStorage
      const allEmpty = quotes.length === 0 && deals.length === 0 && payments.length === 0;

      if (allEmpty) {
        const migrated = await migrateFromLocalStorage();
        if (migrated) return; // migrateFromLocalStorage sets state

        // If no localStorage data either, seed deals
        if (deals.length === 0) {
          await seedDeals();
          return;
        }
      }

      setState({
        quotes,
        deals,
        opportunities,
        dealMilestones,
        internalCosts,
        payments,
        commissionPayouts,
        production,
        freight,
        rfqs: state.rfqs,
        clients,
        vendors,
        estimates,
        steelCostData,
        insulationCostData,
        storedDocuments,
        jobProfiles,
        commissionRecipientSettings,
        loading: false,
      });
    } catch (err) {
      console.error('Supabase fetch error, falling back to localStorage', err);
      loadFromLocalStorage();
    }
  }, []);

  const loadFromLocalStorage = useCallback(() => {
    try {
      const raw = localStorage.getItem('canada_steel_state');
      if (raw) {
        const data = JSON.parse(raw);
        setState({
          quotes: data.quotes || [],
          deals: data.deals || [],
          opportunities: data.opportunities || [],
          dealMilestones: data.dealMilestones || [],
          internalCosts: data.internalCosts || [],
          payments: data.payments || [],
          commissionPayouts: data.commissionPayouts || [],
          production: data.production || [],
          freight: data.freight || [],
          rfqs: data.rfqs || [],
          clients: data.clients || [],
          vendors: data.vendors || [],
          estimates: data.estimates || [],
          steelCostData: data.steelCostData || [],
          insulationCostData: data.insulationCostData || [],
          storedDocuments: data.storedDocuments || [],
          jobProfiles: data.jobProfiles || [],
          commissionRecipientSettings: data.commissionRecipientSettings || [],
          loading: false,
        });
      } else {
        // No localStorage data either — use seed deals
        setState(prev => ({ ...prev, deals: SEED_DEALS, loading: false }));
      }
    } catch {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const migrateFromLocalStorage = useCallback(async (): Promise<boolean> => {
    try {
      const raw = localStorage.getItem('canada_steel_state');
      if (!raw) return false;

      const data = JSON.parse(raw);
      const hasData = (data.quotes?.length || data.deals?.length || data.payments?.length ||
        data.internalCosts?.length || data.production?.length || data.freight?.length || data.commissionPayouts?.length);
      if (!hasData) return false;

      // Insert into Supabase
      if (data.deals?.length) {
        const rows = data.deals.map((d: Deal) => dealToRow(d));
        await supabase.from('deals').insert(rows as any).select();
      }
      if (data.quotes?.length) {
        const rows = data.quotes.map((q: Quote) => quoteToRow(q));
        await supabase.from('quotes').insert(rows as any).select();
      }
      if (data.internalCosts?.length) {
        const rows = data.internalCosts.map((ic: InternalCost) => internalCostToRow(ic));
        await supabase.from('internal_costs').insert(rows as any).select();
      }
      if (data.payments?.length) {
        const rows = data.payments.map((p: PaymentEntry) => paymentToRow(p));
        await supabase.from('payments').insert(rows as any).select();
      }
      if (data.commissionPayouts?.length) {
        const rows = data.commissionPayouts.map((p: CommissionPayout) => commissionPayoutToRow(p));
        await (supabase.from as any)('commission_payouts').upsert(rows, { onConflict: 'job_id,recipient_role,payout_stage' });
      }
      if (data.production?.length) {
        const rows = data.production.map((pr: ProductionRecord) => productionToRow(pr));
        await supabase.from('production').insert(rows as any).select();
      }
      if (data.freight?.length) {
        const rows = data.freight.map((fr: FreightRecord) => freightToRow(fr));
        await supabase.from('freight').insert(rows as any).select();
      }

      toast.success('Data migrated from local storage to Supabase');
      localStorage.removeItem('canada_steel_state');

      // Re-fetch from Supabase after migration
      const [qR, dR, oR, dmR, cR, pR, cpR, prR, fR, clR, vR] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('deals').select('*'),
        (supabase.from as any)('opportunities').select('*'),
        (supabase.from as any)('deal_milestones').select('*'),
        supabase.from('internal_costs').select('*'),
        supabase.from('payments').select('*'),
        (supabase.from as any)('commission_payouts').select('*'),
        supabase.from('production').select('*'),
        supabase.from('freight').select('*'),
        supabase.from('clients').select('*'),
        supabase.from('vendors').select('*'),
      ]);

      setState({
        quotes: (qR.data || []).map(quoteFromRow),
        deals: (dR.data || []).map(dealFromRow),
        opportunities: (oR.data || []).map(opportunityFromRow),
        dealMilestones: (dmR.data || []).map(dealMilestoneFromRow),
        internalCosts: (cR.data || []).map(internalCostFromRow),
        payments: (pR.data || []).map(paymentFromRow),
        commissionPayouts: (cpR.data || []).map(commissionPayoutFromRow),
        production: buildAuthoritativeProductionState(
          (dR.data || []).map(dealFromRow),
          (prR.data || []).map(productionFromRow),
        ),
        freight: (fR.data || []).map(freightFromRow),
        clients: (clR.data || []).map(clientFromRow),
        vendors: (vR.data || []).map(vendorFromRow),
        estimates: [],
        steelCostData: [],
        insulationCostData: [],
        storedDocuments: [],
        jobProfiles: [],
        commissionRecipientSettings: [],
        rfqs: [],
        loading: false,
      });
      return true;
    } catch (err) {
      console.error('Migration from localStorage failed', err);
      return false;
    }
  }, []);

  const seedDeals = useCallback(async () => {
    try {
      const rows = SEED_DEALS.map(d => dealToRow(d));
      await supabase.from('deals').insert(rows as any);
      const { data } = await supabase.from('deals').select('*');
      if (data && data.length > 0) {
        setState(prev => ({ ...prev, deals: data.map(dealFromRow), loading: false }));
      } else {
        // Insert succeeded but returned 0 rows (e.g. RLS blocking, dev mode)
        // Fall back to seed data in state + localStorage
        console.warn('[Data] Supabase insert returned 0 rows — using SEED_DEALS in-memory');
        setState(prev => ({ ...prev, deals: SEED_DEALS, loading: false }));
        // Also save to localStorage so it persists
        const currentState = { quotes: [], deals: SEED_DEALS, opportunities: [], dealMilestones: [], internalCosts: [], payments: [], commissionPayouts: [], production: [], freight: [], rfqs: [], clients: [], vendors: [], estimates: [], steelCostData: [], insulationCostData: [], storedDocuments: [], jobProfiles: [], commissionRecipientSettings: [] };
        localStorage.setItem('canada_steel_state', JSON.stringify(currentState));
      }
    } catch {
      setState(prev => ({ ...prev, deals: SEED_DEALS, loading: false }));
      const currentState = { quotes: [], deals: SEED_DEALS, opportunities: [], dealMilestones: [], internalCosts: [], payments: [], commissionPayouts: [], production: [], freight: [], rfqs: [], clients: [], vendors: [], estimates: [], steelCostData: [], insulationCostData: [], storedDocuments: [], jobProfiles: [], commissionRecipientSettings: [] };
      localStorage.setItem('canada_steel_state', JSON.stringify(currentState));
    }
  }, [buildAuthoritativeProductionState]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Persist state changes to localStorage for dev mode / offline resilience
  useEffect(() => {
    if (state.loading) return;
    const { loading, ...dataToSave } = state;
    localStorage.setItem('canada_steel_state', JSON.stringify(dataToSave));
  }, [state]);

  const upsertOpportunityRecord = useCallback(async (
    source: Quote | Deal,
    sourceType: 'quote' | 'deal',
    overrides?: Partial<Opportunity>,
  ) => {
    const existing = state.opportunities.find(opportunity =>
      opportunity.jobId === source.jobId || (source.opportunityId && opportunity.id === source.opportunityId),
    );

    const derived = sourceType === 'quote'
      ? buildOpportunityFromQuote(source as Quote, existing)
      : buildOpportunityFromDeal(source as Deal, existing);

    const nextOpportunity: Opportunity = {
      ...derived,
      ...overrides,
      id: overrides?.id || derived.id,
      jobId: source.jobId,
      clientId: overrides?.clientId ?? derived.clientId,
      clientName: overrides?.clientName ?? derived.clientName,
      name: overrides?.name ?? derived.name,
      potentialRevenue: overrides?.potentialRevenue ?? derived.potentialRevenue,
      status: overrides?.status ?? derived.status,
      source: overrides?.source ?? derived.source,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || derived.createdAt,
    };

    setState(prev => ({
      ...prev,
      opportunities: [...prev.opportunities.filter(opportunity => opportunity.jobId !== nextOpportunity.jobId), nextOpportunity],
    }));

    try {
      const { data } = await (supabase.from as any)('opportunities')
        .upsert(opportunityToRow(nextOpportunity), { onConflict: 'job_id' })
        .select()
        .single();

      if (data) {
        const mapped = opportunityFromRow(data);
        setState(prev => ({
          ...prev,
          opportunities: [...prev.opportunities.filter(opportunity => opportunity.jobId !== mapped.jobId), mapped],
        }));
        return mapped;
      }
    } catch {}

    return nextOpportunity;
  }, [state.opportunities]);

  const updateOpportunityByJob = useCallback(async (jobId: string, updates: Partial<Opportunity>) => {
    const existing = state.opportunities.find(opportunity => opportunity.jobId === jobId);
    if (!existing) return;

    const nextOpportunity = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setState(prev => ({
      ...prev,
      opportunities: prev.opportunities.map(opportunity => opportunity.jobId === jobId ? nextOpportunity : opportunity),
    }));

    try {
      await (supabase.from as any)('opportunities')
        .update(opportunityToRow(nextOpportunity))
        .eq('job_id', jobId);
    } catch {}
  }, [state.opportunities]);

  const upsertDealMilestone = useCallback(async (
    jobId: string,
    milestoneKey: DealMilestone['milestoneKey'],
    isComplete: boolean,
    notes = '',
  ) => {
    const existing = state.dealMilestones.find(milestone =>
      milestone.jobId === jobId && milestone.milestoneKey === milestoneKey,
    );

    const nextMilestone = buildDealMilestoneRecord({
      jobId,
      milestoneKey,
      isComplete,
      notes,
      completedByUserId: currentUser?.id || null,
      existing,
    });

    setState(prev => ({
      ...prev,
      dealMilestones: [
        ...prev.dealMilestones.filter(milestone => !(milestone.jobId === jobId && milestone.milestoneKey === milestoneKey)),
        nextMilestone,
      ],
    }));

    try {
      const { data } = await (supabase.from as any)('deal_milestones')
        .upsert(dealMilestoneToRow(nextMilestone), { onConflict: 'job_id,milestone_key' })
        .select()
        .single();

      if (data) {
        const mapped = dealMilestoneFromRow(data);
        setState(prev => ({
          ...prev,
          dealMilestones: [
            ...prev.dealMilestones.filter(milestone => !(milestone.jobId === jobId && milestone.milestoneKey === milestoneKey)),
            mapped,
          ],
        }));
      }
    } catch {}
  }, [currentUser?.id, state.dealMilestones]);

  const syncProductionShadow = useCallback(async (
    input: Pick<
      Deal,
      'jobId' | 'productionStatus' | 'insulationStatus' | 'engineeringDrawingsStatus' | 'foundationDrawingsStatus'
    >,
  ) => {
    const shadowRecord = buildProductionShadowRecord(input);

    setState(prev => ({
      ...prev,
      production: [
        ...prev.production.filter(record => record.jobId !== shadowRecord.jobId),
        shadowRecord,
      ],
    }));

    try {
      const { data } = await supabase
        .from('production')
        .upsert(productionToRow(shadowRecord) as any, { onConflict: 'job_id' })
        .select()
        .single();

      if (data) {
        const mapped = productionFromRow(data);
        setState(prev => ({
          ...prev,
          production: [
            ...prev.production.filter(record => record.jobId !== mapped.jobId),
            mapped,
          ],
        }));
      }
    } catch {}

    return shadowRecord;
  }, [buildAuthoritativeProductionState]);

  // --- Quotes ---
  const addQuote = useCallback(async (q: Quote) => {
    const opportunity = await upsertOpportunityRecord(q, 'quote');
    const nextQuote = { ...q, opportunityId: q.opportunityId || opportunity?.id || null };
    setState(prev => ({ ...prev, quotes: [...prev.quotes, nextQuote] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Quote', nextQuote.id, nextQuote);
    try {
      const row = quoteToRow(nextQuote);
      await supabase.from('quotes').insert(row as any).select().single();
    } catch {}
    await syncJobProfileFromQuote(nextQuote);
  }, [currentUser, upsertOpportunityRecord]);

  const allocateJobId = useCallback(async (): Promise<string> => {
    const { data, error } = await (supabase.rpc as any)('allocate_job_id');
    if (error) throw error;
    return data as string;
  }, []);

  const updateQuote = useCallback(async (id: string, updates: Partial<Quote>) => {
    const existingQuote = state.quotes.find(q => q.id === id);
    const nextQuote = existingQuote ? { ...existingQuote, ...updates } : null;
    setState(prev => {
      const existing = prev.quotes.find(q => q.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Quote', id, updates, existing);
      return {
        ...prev,
        quotes: prev.quotes.map(q => q.id === id ? { ...q, ...updates } : q),
      };
    });
    if (nextQuote) {
      void upsertOpportunityRecord(nextQuote, 'quote');
      void syncJobProfileFromQuote(nextQuote);
    }
    try {
      const row = quoteToRow(updates);
      await supabase.from('quotes').update(row as any).eq('id', id);
    } catch {}
  }, [currentUser, state.quotes, syncJobProfileFromQuote, upsertOpportunityRecord]);

  const deleteQuote = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.quotes.find(q => q.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Quote', id, { isDeleted: true }, existing);
      return {
        ...prev,
        quotes: prev.quotes.map(q => q.id === id ? { ...q, isDeleted: true } : q),
      };
    });
    try {
      await (supabase.from('quotes').update({ is_deleted: true } as any) as any).eq('id', id);
    } catch {}
  }, [currentUser]);

  const restoreQuote = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.quotes.find(q => q.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'RESTORE', 'Quote', id, { isDeleted: false }, existing);
      return {
        ...prev,
        quotes: prev.quotes.map(q => q.id === id ? { ...q, isDeleted: false } : q),
      };
    });
    try {
      await (supabase.from('quotes').update({ is_deleted: false } as any) as any).eq('id', id);
    } catch {}
  }, [currentUser]);

  // --- Clients ---
  const quickAddClient = useCallback(async (clientId: string, clientName: string, jobId?: string): Promise<Client | null> => {
    const existingClient = state.clients.find(client =>
      client.id === clientId
      || client.clientId === clientId
      || (!!clientName && (
        client.clientName.trim().toLowerCase() === clientName.trim().toLowerCase()
        || (client.name || '').trim().toLowerCase() === clientName.trim().toLowerCase()
      )),
    );

    if (existingClient) return existingClient;

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ client_id: clientId, client_name: clientName, job_ids: jobId ? [jobId] : [] })
        .select()
        .single();
      if (error || !data) return null;
      const client = clientFromRow(data);
      setState(prev => ({ ...prev, clients: [...prev.clients, client] }));
      return client;
    } catch {
      return null;
    }
  }, [state.clients]);

  const quickAddVendor = useCallback(async (vendorName: string, province = 'ON'): Promise<Vendor | null> => {
    const existingVendor = state.vendors.find(vendor =>
      vendor.id === vendorName
      || vendor.name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
    );
    if (existingVendor) return existingVendor;

    try {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          name: vendorName,
          province,
          contact_email: '',
          contact_phone: '',
          notes: '',
        })
        .select()
        .single();
      if (error || !data) return null;
      const vendor = vendorFromRow(data);
      setState(prev => ({ ...prev, vendors: [...prev.vendors, vendor] }));
      return vendor;
    } catch {
      return null;
    }
  }, [state.vendors]);

  // Upsert client: create if missing, append jobId to job_ids
  const upsertClientJob = useCallback(async (clientId: string, clientName: string, jobId: string) => {
    try {
      const { data: existing } = await supabase
        .from('clients')
        .select('id, job_ids')
        .eq('client_id', clientId)
        .maybeSingle();

      if (existing) {
        const newJobIds = Array.from(new Set([...(existing.job_ids || []), jobId]));
        await supabase.from('clients').update({ job_ids: newJobIds }).eq('client_id', clientId);
        setState(prev => ({
          ...prev,
          clients: prev.clients.map(c =>
            c.clientId === clientId ? { ...c, jobIds: newJobIds } : c
          ),
        }));
      } else {
        const { data } = await supabase
          .from('clients')
          .insert({ client_id: clientId, client_name: clientName, job_ids: [jobId] })
          .select()
          .single();
        if (data) {
          setState(prev => ({ ...prev, clients: [...prev.clients, clientFromRow(data)] }));
        }
      }
    } catch {}
  }, []);

  const ensurePaymentIntegrity = useCallback(async (payment: PaymentEntry) => {
    const rawJobId = (payment.jobId || '').trim();
    const canonicalJobId = resolveCanonicalJobId(rawJobId) || rawJobId;
    const linkedDeal = canonicalJobId
      ? state.deals.find(deal => jobIdsMatch(deal.jobId, canonicalJobId)) || null
      : null;
    const isClientPaymentDirection = payment.direction === 'Client Payment IN' || payment.direction === 'Refund OUT';
    const isVendorPaymentDirection = payment.direction === 'Vendor Payment OUT' || payment.direction === 'Refund IN' || payment.direction === 'Expense OUT';
    const inferredPartyType = payment.partyType || (
      payment.direction === 'Commission Payment OUT'
        ? 'commission'
        : isClientPaymentDirection
          ? 'client'
          : isVendorPaymentDirection
            ? 'vendor'
            : 'general_expense'
    );

    let nextPayment: PaymentEntry = {
      ...payment,
      jobId: canonicalJobId || null,
      partyType: inferredPartyType,
      clientVendorName: payment.clientVendorName.trim(),
    };

    if (isClientPaymentDirection) {
      const matchingClient = findClientRecordForLedger(state.clients, {
        clientId: payment.clientId,
        clientVendorName: payment.clientVendorName,
        linkedDeal,
      });

      const client = matchingClient || await quickAddClient(
        buildClientSeedForLedger({
          explicitClientId: payment.clientId,
          clientVendorName: payment.clientVendorName,
          linkedDeal,
        }).clientId,
        buildClientSeedForLedger({
          explicitClientId: payment.clientId,
          clientVendorName: payment.clientVendorName,
          linkedDeal,
        }).clientName,
        canonicalJobId,
      );

      if (client) {
        if (canonicalJobId) {
          await upsertClientJob(client.clientId, client.clientName || client.name || nextPayment.clientVendorName, canonicalJobId);
        }
        nextPayment = {
          ...nextPayment,
          clientId: client.id,
          vendorId: undefined,
          clientVendorName: client.clientName || client.name || nextPayment.clientVendorName,
        };
      } else {
        nextPayment = {
          ...nextPayment,
          clientId: undefined,
          vendorId: undefined,
        };
      }
    } else if (isVendorPaymentDirection) {
      const matchingVendor = findVendorRecordForLedger(state.vendors, {
        vendorId: payment.vendorId,
        clientVendorName: payment.clientVendorName,
      });

      const vendor = matchingVendor || await quickAddVendor(
        buildVendorSeedForLedger({
          clientVendorName: payment.clientVendorName,
          province: payment.vendorProvinceOverride || payment.province || linkedDeal?.province,
        }).vendorName,
        buildVendorSeedForLedger({
          clientVendorName: payment.clientVendorName,
          province: payment.vendorProvinceOverride || payment.province || linkedDeal?.province,
        }).province,
      );

      if (vendor) {
        nextPayment = {
          ...nextPayment,
          clientId: undefined,
          vendorId: vendor.id,
          clientVendorName: vendor.name,
          vendorProvinceOverride: payment.vendorProvinceOverride || vendor.province || undefined,
        };
      } else {
        nextPayment = {
          ...nextPayment,
          clientId: undefined,
          vendorId: undefined,
        };
      }
    } else {
      nextPayment = {
        ...nextPayment,
        clientId: undefined,
        vendorId: undefined,
      };
    }

    return nextPayment;
  }, [quickAddClient, quickAddVendor, state.clients, state.deals, state.vendors, upsertClientJob]);

  // --- Deals ---
  const addDeal = useCallback(async (d: Deal) => {
    const opportunity = await upsertOpportunityRecord(d, 'deal');
    const nextDeal = { ...d, opportunityId: d.opportunityId || opportunity?.id || null };
    setState(prev => ({ ...prev, deals: [...prev.deals, nextDeal] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Deal', nextDeal.jobId, nextDeal);
    try {
      const row = dealToRow(nextDeal);
      await supabase.from('deals').insert(row as any).select().single();
    } catch {}
    void syncProductionShadow(nextDeal);
    void syncJobProfileFromDeal(nextDeal);
    if (nextDeal.salesRep) await ensureManualPersonnelEntry(nextDeal.salesRep, ['sales_rep']);
    if (nextDeal.estimator) await ensureManualPersonnelEntry(nextDeal.estimator, ['estimator']);
    if (nextDeal.teamLead) await ensureManualPersonnelEntry(nextDeal.teamLead, ['team_lead']);
    // Upsert client record with the new job ID
    if (nextDeal.clientName || nextDeal.clientId) {
      const cId = nextDeal.clientId || `C-${Date.now().toString(36).toUpperCase()}`;
      await upsertClientJob(cId, nextDeal.clientName, nextDeal.jobId);
    }
  }, [currentUser, ensureManualPersonnelEntry, syncJobProfileFromDeal, syncProductionShadow, upsertClientJob, upsertOpportunityRecord]);

  const updateDeal = useCallback(async (jobId: string, updates: Partial<Deal>) => {
    const existingDeal = state.deals.find(d => d.jobId === jobId);
    const nextDeal = existingDeal ? { ...existingDeal, ...updates } : null;
    setState(prev => {
      const existing = prev.deals.find(d => d.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Deal', jobId, updates, existing);
      return {
        ...prev,
        deals: prev.deals.map(d => d.jobId === jobId ? { ...d, ...updates } : d),
      };
    });
    if (nextDeal) {
      void upsertOpportunityRecord(nextDeal, 'deal');
      void syncProductionShadow(nextDeal);
      void syncJobProfileFromDeal(nextDeal);
      if (nextDeal.salesRep) void ensureManualPersonnelEntry(nextDeal.salesRep, ['sales_rep']);
      if (nextDeal.estimator) void ensureManualPersonnelEntry(nextDeal.estimator, ['estimator']);
      if (nextDeal.teamLead) void ensureManualPersonnelEntry(nextDeal.teamLead, ['team_lead']);
    }
    try {
      const row = dealToRow(updates);
      const { data, error } = await supabase.from('deals').update(row as any).eq('job_id', jobId).select().single();
      if (error) throw error;

      if (data) {
        const mapped = dealFromRow(data);
        setState(prev => ({
          ...prev,
          deals: prev.deals.map(deal => deal.jobId === jobId ? mapped : deal),
        }));
      }
    } catch (error) {
      console.error('Failed to persist deal update', error);
      if (existingDeal) {
        setState(prev => ({
          ...prev,
          deals: prev.deals.map(deal => deal.jobId === jobId ? existingDeal : deal),
        }));
      }
      toast.error('Unable to save the deal update. The previous value was restored.');
    }
  }, [currentUser, ensureManualPersonnelEntry, state.deals, syncJobProfileFromDeal, syncProductionShadow, upsertOpportunityRecord]);

  const deleteDeal = useCallback(async (jobId: string) => {
    const revertedQuote = state.quotes.find(quote =>
      quote.jobId === jobId
      && quote.documentType === 'external_quote'
      && quote.workflowStatus === 'converted_to_deal'
      && !quote.isDeleted,
    ) || null;

    setState(prev => {
      const existing = prev.deals.find(d => d.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Deal', jobId, { jobId }, existing);
      return {
        ...prev,
        deals: prev.deals.filter(d => d.jobId !== jobId),
        dealMilestones: prev.dealMilestones.filter(milestone => milestone.jobId !== jobId),
        production: prev.production.filter(record => record.jobId !== jobId),
        quotes: revertedQuote
          ? prev.quotes.map(quote => quote.id === revertedQuote.id ? {
            ...quote,
            workflowStatus: 'quote_sent',
            status: 'Sent',
          } : quote)
          : prev.quotes,
      };
    });
    try {
      await supabase.from('deals').delete().eq('job_id', jobId);
      await supabase.from('production').delete().eq('job_id', jobId);
      if (revertedQuote) {
        await supabase.from('quotes').update({
          workflow_status: 'quote_sent',
          status: 'Sent',
          updated_at: new Date().toISOString(),
        } as any).eq('id', revertedQuote.id);
      }
    } catch (error) {
      console.error('Failed to delete deal', error);
      toast.error('Unable to remove the deal from the database.');
    }
  }, [currentUser, state.quotes]);

  // --- Internal Costs ---
  const addInternalCost = useCallback(async (ic: InternalCost) => {
    setState(prev => ({ ...prev, internalCosts: [...prev.internalCosts, ic] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'InternalCost', ic.jobId, ic);
    try {
      const row = internalCostToRow(ic);
      await supabase.from('internal_costs').insert(row as any).select().single();
    } catch {}
  }, [currentUser]);

  const updateInternalCost = useCallback(async (jobId: string, updates: Partial<InternalCost>) => {
    setState(prev => {
      const existing = prev.internalCosts.find(ic => ic.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'InternalCost', jobId, updates, existing);
      return {
        ...prev,
        internalCosts: prev.internalCosts.map(ic => ic.jobId === jobId ? { ...ic, ...updates } : ic),
      };
    });
    try {
      const row = internalCostToRow(updates);
      await supabase.from('internal_costs').update(row as any).eq('job_id', jobId);
    } catch {}
  }, [currentUser]);

  // --- Payments ---
  const addPayment = useCallback(async (p: PaymentEntry) => {
    const nextPayment = await ensurePaymentIntegrity(p);
    setState(prev => ({ ...prev, payments: [...prev.payments, nextPayment] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Payment', nextPayment.id, nextPayment);
    try {
      const row = paymentToRow(nextPayment);
      await supabase.from('payments').insert(row as any).select().single();
    } catch {}
  }, [currentUser, ensurePaymentIntegrity]);

  const updatePayment = useCallback(async (id: string, updates: Partial<PaymentEntry>) => {
    const existingPayment = state.payments.find(payment => payment.id === id);
    if (!existingPayment) return;

    const nextPayment = await ensurePaymentIntegrity({ ...existingPayment, ...updates });

    setState(prev => {
      if (existingPayment) logAudit(currentUser?.name || 'System', 'UPDATE', 'Payment', id, nextPayment, existingPayment);
      return {
        ...prev,
        payments: prev.payments.map(payment => payment.id === id ? nextPayment : payment),
      };
    });
    try {
      const row = paymentToRow(nextPayment);
      await supabase.from('payments').update(row as any).eq('id', id);
    } catch {}
  }, [currentUser, ensurePaymentIntegrity, state.payments]);

  const deletePayment = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.payments.find(p => p.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Payment', id, { id }, existing);
      return { ...prev, payments: prev.payments.filter(p => p.id !== id) };
    });
    try {
      await supabase.from('payments').delete().eq('id', id);
    } catch {}
  }, [currentUser]);

  const upsertCommissionPayout = useCallback(async (payout: CommissionPayout) => {
    const nextPayout = {
      ...payout,
      updatedAt: new Date().toISOString(),
      createdAt: payout.createdAt || new Date().toISOString(),
    };

    setState(prev => {
      const existing = prev.commissionPayouts.find(entry =>
        entry.jobId === nextPayout.jobId
        && entry.recipientRole === nextPayout.recipientRole
        && entry.payoutStage === nextPayout.payoutStage,
      );

      if (existing) {
        logAudit(currentUser?.name || 'System', 'UPDATE', 'CommissionPayout', existing.id, nextPayout, existing);
        return {
          ...prev,
          commissionPayouts: prev.commissionPayouts.map(entry =>
            entry.id === existing.id ? { ...existing, ...nextPayout, id: existing.id } : entry,
          ),
        };
      }

      logAudit(currentUser?.name || 'System', 'CREATE', 'CommissionPayout', nextPayout.id, nextPayout);
      return {
        ...prev,
        commissionPayouts: [...prev.commissionPayouts, nextPayout],
      };
    });

    try {
      const row = commissionPayoutToRow(nextPayout);
      await (supabase.from as any)('commission_payouts').upsert(row, { onConflict: 'job_id,recipient_role,payout_stage' });
    } catch {}
  }, [currentUser]);

  const deleteCommissionPayout = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.commissionPayouts.find(entry => entry.id === id);
      if (existing) {
        logAudit(currentUser?.name || 'System', 'DELETE', 'CommissionPayout', id, { id }, existing);
      }
      return {
        ...prev,
        commissionPayouts: prev.commissionPayouts.filter(entry => entry.id !== id),
      };
    });

    try {
      await (supabase.from as any)('commission_payouts').delete().eq('id', id);
    } catch {}
  }, [currentUser]);

  // --- Production ---
  const addProduction = useCallback(async (pr: ProductionRecord) => {
    const nextStatus = deriveDealProductionStatusFromRecord(pr);
    setState(prev => ({
      ...prev,
      production: [...prev.production.filter(record => record.jobId !== pr.jobId), pr],
      deals: prev.deals.map(deal => deal.jobId === pr.jobId ? {
        ...deal,
        productionStatus: nextStatus,
        insulationStatus: pr.insulationStatus || deal.insulationStatus,
        engineeringDrawingsStatus: pr.engineeringDrawingsStatus || deal.engineeringDrawingsStatus,
        foundationDrawingsStatus: pr.foundationDrawingsStatus || deal.foundationDrawingsStatus,
      } : deal),
    }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Production', pr.jobId, pr);
    try {
      const row = productionToRow(pr);
      await supabase.from('production').upsert(row as any, { onConflict: 'job_id' }).select().single();
      await supabase.from('deals').update({
        production_status: nextStatus,
        insulation_status: pr.insulationStatus || '',
        engineering_drawings_status: pr.engineeringDrawingsStatus || 'not_requested',
        foundation_drawings_status: pr.foundationDrawingsStatus || 'not_requested',
      } as any).eq('job_id', pr.jobId);
    } catch {}
  }, [currentUser]);

  const updateProduction = useCallback(async (jobId: string, updates: Partial<ProductionRecord>) => {
    let nextRecord: ProductionRecord | null = null;
    let nextStatus: ReturnType<typeof deriveDealProductionStatusFromRecord> = 'Submitted';
    setState(prev => {
      const existing = prev.production.find(p => p.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Production', jobId, updates, existing);
      nextRecord = existing ? { ...existing, ...updates } : null;
      if (nextRecord) {
        nextStatus = deriveDealProductionStatusFromRecord(nextRecord);
      }
      return {
        ...prev,
        production: prev.production.map(p => p.jobId === jobId ? { ...p, ...updates } : p),
        deals: prev.deals.map(deal => deal.jobId === jobId && nextRecord ? {
          ...deal,
          productionStatus: nextStatus,
          insulationStatus: nextRecord.insulationStatus || deal.insulationStatus,
          engineeringDrawingsStatus: nextRecord.engineeringDrawingsStatus || deal.engineeringDrawingsStatus,
          foundationDrawingsStatus: nextRecord.foundationDrawingsStatus || deal.foundationDrawingsStatus,
        } : deal),
      };
    });
    try {
      const row = productionToRow(updates);
      await supabase.from('production').update(row as any).eq('job_id', jobId);
      if (nextRecord) {
        await supabase.from('deals').update({
          production_status: nextStatus,
          insulation_status: nextRecord.insulationStatus || '',
          engineering_drawings_status: nextRecord.engineeringDrawingsStatus || 'not_requested',
          foundation_drawings_status: nextRecord.foundationDrawingsStatus || 'not_requested',
        } as any).eq('job_id', jobId);
      }
    } catch {}
  }, [currentUser]);

  // --- Freight ---
  const addFreight = useCallback(async (fr: FreightRecord) => {
    setState(prev => ({ ...prev, freight: [...prev.freight, fr] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Freight', fr.jobId, fr);
    try {
      const row = freightToRow(fr);
      await supabase.from('freight').insert(row as any).select().single();
    } catch {}
    await syncJobProfileFromFreight(fr);
  }, [currentUser, syncJobProfileFromFreight]);

  const updateFreight = useCallback(async (jobId: string, updates: Partial<FreightRecord>) => {
    const nextFreight = state.freight.find(record => record.jobId === jobId)
      ? { ...state.freight.find(record => record.jobId === jobId)!, ...updates }
      : null;
    setState(prev => {
      const existing = prev.freight.find(f => f.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Freight', jobId, updates, existing);
      return {
        ...prev,
        freight: prev.freight.map(f => f.jobId === jobId ? { ...f, ...updates } : f),
      };
    });
    try {
      const row = freightToRow(updates);
      await supabase.from('freight').update(row as any).eq('job_id', jobId);
    } catch {}
    if (nextFreight) {
      void syncJobProfileFromFreight(nextFreight);
    }
  }, [currentUser, state.freight, syncJobProfileFromFreight]);

  // --- RFQs ---
  const addRFQ = useCallback((rfq: RFQ) => {
    setState(prev => ({ ...prev, rfqs: [...prev.rfqs, rfq] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'RFQ', rfq.id, rfq);
  }, [currentUser]);

  const updateRFQ = useCallback((id: string, updates: Partial<RFQ>) => {
    setState(prev => {
      const existing = prev.rfqs.find(r => r.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'RFQ', id, updates, existing);
      return {
        ...prev,
        rfqs: prev.rfqs.map(r => r.id === id ? { ...r, ...updates } : r),
      };
    });
  }, [currentUser]);

  const deleteRFQ = useCallback((id: string) => {
    setState(prev => {
      const existing = prev.rfqs.find(r => r.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'RFQ', id, { id }, existing);
      return { ...prev, rfqs: prev.rfqs.filter(r => r.id !== id) };
    });
  }, [currentUser]);

  // --- Clients ---
  const addClient = useCallback(async (c: Client) => {
    setState(prev => ({ ...prev, clients: [...prev.clients, c] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Client', c.id, c);
    try {
      const row = clientToRow(c);
      await supabase.from('clients').insert(row as any).select().single();
    } catch {}
  }, [currentUser]);

  const updateClient = useCallback(async (id: string, updates: Partial<Client>) => {
    setState(prev => {
      const existing = prev.clients.find(c => c.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Client', id, updates, existing);
      return {
        ...prev,
        clients: prev.clients.map(c => c.id === id ? { ...c, ...updates } : c),
      };
    });
    try {
      const row = clientToRow(updates);
      await supabase.from('clients').update(row as any).eq('id', id);
    } catch {}
  }, [currentUser]);

  const deleteClient = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.clients.find(c => c.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Client', id, { id }, existing);
      return { ...prev, clients: prev.clients.filter(c => c.id !== id) };
    });
    try {
      await supabase.from('clients').delete().eq('id', id);
    } catch {}
  }, [currentUser]);

  // --- Vendors ---
  const addVendor = useCallback(async (v: Vendor) => {
    setState(prev => ({ ...prev, vendors: [...prev.vendors, v] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Vendor', v.id, v);
    try {
      const row = vendorToRow(v);
      await supabase.from('vendors').insert(row as any).select().single();
    } catch {}
  }, [currentUser]);

  const updateVendor = useCallback(async (id: string, updates: Partial<Vendor>) => {
    setState(prev => {
      const existing = prev.vendors.find(v => v.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Vendor', id, updates, existing);
      return {
        ...prev,
        vendors: prev.vendors.map(v => v.id === id ? { ...v, ...updates } : v),
      };
    });
    try {
      const row = vendorToRow(updates);
      await supabase.from('vendors').update(row as any).eq('id', id);
    } catch {}
  }, [currentUser]);

  const deleteVendor = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.vendors.find(v => v.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Vendor', id, { id }, existing);
      return { ...prev, vendors: prev.vendors.filter(v => v.id !== id) };
    });
    try {
      await supabase.from('vendors').delete().eq('id', id);
    } catch {}
  }, [currentUser]);

  // --- Estimates ---
  const addEstimate = useCallback(async (estimate: Estimate) => {
    setState(prev => ({ ...prev, estimates: [...prev.estimates, estimate] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Estimate', estimate.id, estimate);
    try {
      const row = estimateToRow(estimate);
      await (supabase.from as any)('estimates').insert(row).select().single();
    } catch {}
    await syncJobProfileFromEstimate(estimate);
  }, [currentUser, syncJobProfileFromEstimate]);

  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
    const nextEstimate = state.estimates.find(estimate => estimate.id === id)
      ? { ...state.estimates.find(estimate => estimate.id === id)!, ...updates }
      : null;
    setState(prev => {
      const existing = prev.estimates.find(estimate => estimate.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Estimate', id, updates, existing);
      return {
        ...prev,
        estimates: prev.estimates.map(estimate => estimate.id === id ? { ...estimate, ...updates } : estimate),
      };
    });
    try {
      const row = estimateToRow(updates);
      await (supabase.from as any)('estimates').update(row).eq('id', id);
    } catch {}
    if (nextEstimate) {
      void syncJobProfileFromEstimate(nextEstimate);
    }
  }, [currentUser, state.estimates, syncJobProfileFromEstimate]);

  const deleteEstimate = useCallback(async (id: string) => {
    setState(prev => {
      const existing = prev.estimates.find(estimate => estimate.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Estimate', id, { id }, existing);
      return { ...prev, estimates: prev.estimates.filter(estimate => estimate.id !== id) };
    });
    try {
      await (supabase.from as any)('estimates').delete().eq('id', id);
    } catch {}
  }, [currentUser]);

  return (
    <AppContext.Provider value={{
      ...state, addQuote, updateQuote, deleteQuote, restoreQuote, addDeal, updateDeal, deleteDeal,
      updateOpportunityByJob, upsertDealMilestone,
      addInternalCost, updateInternalCost, addPayment, updatePayment, deletePayment,
      upsertCommissionPayout, deleteCommissionPayout,
      addProduction, updateProduction, addFreight, updateFreight,
      addRFQ, updateRFQ, deleteRFQ,
      quickAddClient, quickAddVendor, upsertJobProfile, addClient, updateClient, deleteClient,
      addVendor, updateVendor, deleteVendor,
      addEstimate, updateEstimate, deleteEstimate, allocateJobId,
      refreshData: fetchAll,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
