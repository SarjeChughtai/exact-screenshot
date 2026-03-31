import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import {
  Quote,
  Deal,
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
} from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/context/RoleContext';
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
} from '@/lib/supabaseMappers';
import { SEED_DEALS } from '@/data/seedDeals';
import { toast } from 'sonner';

interface AppState {
  quotes: Quote[];
  deals: Deal[];
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
  addInternalCost: (ic: InternalCost) => void;
  updateInternalCost: (jobId: string, updates: Partial<InternalCost>) => void;
  addPayment: (p: PaymentEntry) => void;
  updatePayment: (id: string, updates: Partial<PaymentEntry>) => void;
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
  quickAddClient: (clientId: string, clientName: string) => Promise<Client | null>;
  quickAddVendor: (vendorName: string, province?: string) => Promise<Vendor | null>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useRoles();
  const [state, setState] = useState<AppState>({
    quotes: [],
    deals: [],
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
    loading: true,
  });

  const fetchAll = useCallback(async () => {
    try {
      const [
        quotesRes,
        dealsRes,
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
      ] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('deals').select('*'),
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
      ]);

      // Log fetch results for debugging
      console.log('Supabase fetch results:', {
        quotes: quotesRes.data?.length, quotesErr: quotesRes.error,
        deals: dealsRes.data?.length, dealsErr: dealsRes.error,
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
      const internalCosts = (costsRes.data || []).map(internalCostFromRow);
      const payments = (paymentsRes.data || []).map(paymentFromRow);
      const commissionPayouts = commissionPayoutsRes.error
        ? []
        : ((commissionPayoutsRes.data || []).map(commissionPayoutFromRow));
      const production = (prodRes.data || []).map(productionFromRow);
      const freight = (freightRes.data || []).map(freightFromRow);
      const clients = (clientsRes.data || []).map(clientFromRow);
      const vendors = (vendorsRes.data || []).map(vendorFromRow);
      const estimates = (estimatesRes.data || []).map(estimateFromRow);
      const steelCostData = (steelCostRes.data || []).map(steelCostDataFromRow);
      const insulationCostData = (insulationCostRes.data || []).map(insulationCostDataFromRow);
      const storedDocuments = (storedDocumentsRes.data || []).map(storedDocumentFromRow);

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
      const [qR, dR, cR, pR, cpR, prR, fR, clR, vR] = await Promise.all([
        supabase.from('quotes').select('*'),
        supabase.from('deals').select('*'),
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
        internalCosts: (cR.data || []).map(internalCostFromRow),
        payments: (pR.data || []).map(paymentFromRow),
        commissionPayouts: (cpR.data || []).map(commissionPayoutFromRow),
        production: (prR.data || []).map(productionFromRow),
        freight: (fR.data || []).map(freightFromRow),
        clients: (clR.data || []).map(clientFromRow),
        vendors: (vR.data || []).map(vendorFromRow),
        estimates: [],
        steelCostData: [],
        insulationCostData: [],
        storedDocuments: [],
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
        const currentState = { quotes: [], deals: SEED_DEALS, internalCosts: [], payments: [], commissionPayouts: [], production: [], freight: [], rfqs: [], clients: [], vendors: [], estimates: [], steelCostData: [], insulationCostData: [], storedDocuments: [] };
        localStorage.setItem('canada_steel_state', JSON.stringify(currentState));
      }
    } catch {
      setState(prev => ({ ...prev, deals: SEED_DEALS, loading: false }));
      const currentState = { quotes: [], deals: SEED_DEALS, internalCosts: [], payments: [], commissionPayouts: [], production: [], freight: [], rfqs: [], clients: [], vendors: [], estimates: [], steelCostData: [], insulationCostData: [], storedDocuments: [] };
      localStorage.setItem('canada_steel_state', JSON.stringify(currentState));
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Persist state changes to localStorage for dev mode / offline resilience
  useEffect(() => {
    if (state.loading) return;
    const { loading, ...dataToSave } = state;
    localStorage.setItem('canada_steel_state', JSON.stringify(dataToSave));
  }, [state]);

  // --- Quotes ---
  const addQuote = useCallback(async (q: Quote) => {
    setState(prev => ({ ...prev, quotes: [...prev.quotes, q] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Quote', q.id, q);
    try {
      const row = quoteToRow(q);
      await supabase.from('quotes').insert(row as any).select().single();
    } catch {}
  }, [currentUser]);

  const allocateJobId = useCallback(async (): Promise<string> => {
    const { data, error } = await (supabase.rpc as any)('allocate_job_id');
    if (error) throw error;
    return data as string;
  }, []);

  const updateQuote = useCallback(async (id: string, updates: Partial<Quote>) => {
    setState(prev => {
      const existing = prev.quotes.find(q => q.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Quote', id, updates, existing);
      return {
        ...prev,
        quotes: prev.quotes.map(q => q.id === id ? { ...q, ...updates } : q),
      };
    });
    try {
      const row = quoteToRow(updates);
      await supabase.from('quotes').update(row as any).eq('id', id);
    } catch {}
  }, [currentUser]);

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
  const quickAddClient = useCallback(async (clientId: string, clientName: string): Promise<Client | null> => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .insert({ client_id: clientId, client_name: clientName, job_ids: [] })
        .select()
        .single();
      if (error || !data) return null;
      const client = clientFromRow(data);
      setState(prev => ({ ...prev, clients: [...prev.clients, client] }));
      return client;
    } catch {
      return null;
    }
  }, []);

  const quickAddVendor = useCallback(async (vendorName: string, province = 'ON'): Promise<Vendor | null> => {
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
  }, []);

  // Upsert client: create if missing, append jobId to job_ids
  const upsertClientJob = useCallback(async (clientId: string, clientName: string, jobId: string) => {
    try {
      const { data: existing } = await supabase
        .from('clients')
        .select('id, job_ids')
        .eq('client_id', clientId)
        .maybeSingle();

      if (existing) {
        const newJobIds = [...(existing.job_ids || []), jobId];
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

  // --- Deals ---
  const addDeal = useCallback(async (d: Deal) => {
    setState(prev => ({ ...prev, deals: [...prev.deals, d] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Deal', d.jobId, d);
    try {
      const row = dealToRow(d);
      await supabase.from('deals').insert(row as any).select().single();
    } catch {}
    // Upsert client record with the new job ID
    if (d.clientName || d.clientId) {
      const cId = d.clientId || `C-${Date.now().toString(36).toUpperCase()}`;
      await upsertClientJob(cId, d.clientName, d.jobId);
    }
  }, [currentUser, upsertClientJob]);

  const updateDeal = useCallback(async (jobId: string, updates: Partial<Deal>) => {
    setState(prev => {
      const existing = prev.deals.find(d => d.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Deal', jobId, updates, existing);
      return {
        ...prev,
        deals: prev.deals.map(d => d.jobId === jobId ? { ...d, ...updates } : d),
      };
    });
    try {
      const row = dealToRow(updates);
      await supabase.from('deals').update(row as any).eq('job_id', jobId);
    } catch {}
  }, [currentUser]);

  const deleteDeal = useCallback(async (jobId: string) => {
    setState(prev => {
      const existing = prev.deals.find(d => d.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'DELETE', 'Deal', jobId, { jobId }, existing);
      return { ...prev, deals: prev.deals.filter(d => d.jobId !== jobId) };
    });
    try {
      await supabase.from('deals').delete().eq('job_id', jobId);
    } catch {}
  }, [currentUser]);

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
    setState(prev => ({ ...prev, payments: [...prev.payments, p] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Payment', p.id, p);
    try {
      const row = paymentToRow(p);
      await supabase.from('payments').insert(row as any).select().single();
    } catch {}
  }, [currentUser]);

  const updatePayment = useCallback(async (id: string, updates: Partial<PaymentEntry>) => {
    setState(prev => {
      const existing = prev.payments.find(p => p.id === id);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Payment', id, updates, existing);
      return {
        ...prev,
        payments: prev.payments.map(p => p.id === id ? { ...p, ...updates } : p),
      };
    });
    try {
      const row = paymentToRow(updates);
      await supabase.from('payments').update(row as any).eq('id', id);
    } catch {}
  }, [currentUser]);

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
    setState(prev => ({ ...prev, production: [...prev.production, pr] }));
    logAudit(currentUser?.name || 'System', 'CREATE', 'Production', pr.jobId, pr);
    try {
      const row = productionToRow(pr);
      await supabase.from('production').insert(row as any).select().single();
    } catch {}
  }, [currentUser]);

  const updateProduction = useCallback(async (jobId: string, updates: Partial<ProductionRecord>) => {
    setState(prev => {
      const existing = prev.production.find(p => p.jobId === jobId);
      if (existing) logAudit(currentUser?.name || 'System', 'UPDATE', 'Production', jobId, updates, existing);
      return {
        ...prev,
        production: prev.production.map(p => p.jobId === jobId ? { ...p, ...updates } : p),
      };
    });
    try {
      const row = productionToRow(updates);
      await supabase.from('production').update(row as any).eq('job_id', jobId);
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
  }, [currentUser]);

  const updateFreight = useCallback(async (jobId: string, updates: Partial<FreightRecord>) => {
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
  }, [currentUser]);

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
  }, [currentUser]);

  const updateEstimate = useCallback(async (id: string, updates: Partial<Estimate>) => {
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
  }, [currentUser]);

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
      addInternalCost, updateInternalCost, addPayment, updatePayment, deletePayment,
      upsertCommissionPayout, deleteCommissionPayout,
      addProduction, updateProduction, addFreight, updateFreight,
      addRFQ, updateRFQ, deleteRFQ,
      quickAddClient, quickAddVendor, addClient, updateClient, deleteClient,
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
