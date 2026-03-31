import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/context/RoleContext';
import type { UserProfileSettings } from '@/types';

export type PersonnelRole = 'sales_rep' | 'estimator' | 'team_lead';

export interface PersonnelEntry {
  id: string;
  name: string;
  email: string;
  role: PersonnelRole;
  roles: PersonnelRole[];
}

export interface ClientEntry {
  clientId: string;
  clientName: string;
}

export interface DealerProfile {
  userId: string;
  clientId: string;
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  billingInfo: string;
}

export interface AppSettings {
  supplierIncreasePct: number;
  internalMarkupTiers: { threshold: number; rate: number }[];
  minimumMargin: number;
  minimumMarginThreshold: number;
  drawingsMarkup: number;
  internalMarginOnEstimator: number;
  frostWallMultiplier: number;
  gutterPerLF: number;
  linerPerSqft: number;
  freightBaseRate: number;
  freightMinimum: number;
  showMarkupOnEstimator: boolean;
  dealStatuses: string[];
  clientPaymentStatuses: string[];
  factoryPaymentStatuses: string[];
  productionStatuses: string[];
  insulationStatuses: string[];
  freightStatuses: string[];
  personnel: PersonnelEntry[];
  externalPersonnel: PersonnelEntry[];
  clients: ClientEntry[];
  dealers: DealerProfile[];
}

const DEFAULT_SETTINGS: AppSettings = {
  supplierIncreasePct: 12,
  internalMarkupTiers: [
    { threshold: 30000, rate: 0.20 },
    { threshold: 60000, rate: 0.15 },
    { threshold: 100000, rate: 0.12 },
    { threshold: 150000, rate: 0.10 },
    { threshold: 200000, rate: 0.08 },
    { threshold: Infinity, rate: 0.05 },
  ],
  minimumMargin: 3000,
  minimumMarginThreshold: 30000,
  drawingsMarkup: 500,
  internalMarginOnEstimator: 5,
  frostWallMultiplier: 1.65,
  gutterPerLF: 10,
  linerPerSqft: 3.25,
  freightBaseRate: 4,
  freightMinimum: 4000,
  showMarkupOnEstimator: true,
  dealStatuses: ['Lead', 'Quoted', 'Pending Payment', 'In Progress', 'In Production', 'Shipped', 'Delivered', 'Complete', 'Cancelled', 'On Hold'],
  clientPaymentStatuses: ['1st Deposit', '2nd Production', '3rd Delivery'],
  factoryPaymentStatuses: ['1st Deposit', '2nd Production', '3rd Delivery'],
  productionStatuses: ['Drawings to be Signed', 'MBS File Requested', 'Sent to Engineering', 'Drawings Stamped', 'Sent to Production', 'Ready for Pickup', 'Delivered'],
  insulationStatuses: ['Requested', 'Ordered', 'Delivered', 'N/A'],
  freightStatuses: ['RFQ', 'Quoted', 'Booked', 'Delivered'],
  personnel: [],
  externalPersonnel: [],
  clients: [],
  dealers: [],
};

const DEFAULT_PROFILE: UserProfileSettings = {
  userId: '',
  phone: '',
  address: '',
  emailNotifications: true,
  smsNotifications: false,
  canViewAllFreightBoard: false,
};

interface SettingsContextType {
  settings: AppSettings;
  profile: UserProfileSettings;
  loading: boolean;
  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
  updateProfile: (updates: Partial<UserProfileSettings>) => Promise<void>;
  getSalesReps: () => PersonnelEntry[];
  getEstimators: () => PersonnelEntry[];
  getTeamLeads: () => PersonnelEntry[];
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const SETTINGS_KEY_MAP: Record<keyof AppSettings, string | null> = {
  supplierIncreasePct: 'pricing',
  internalMarkupTiers: 'internal_markup_tiers',
  minimumMargin: 'pricing',
  minimumMarginThreshold: 'pricing',
  drawingsMarkup: 'pricing',
  internalMarginOnEstimator: 'pricing',
  frostWallMultiplier: 'pricing',
  gutterPerLF: 'pricing',
  linerPerSqft: 'pricing',
  freightBaseRate: 'pricing',
  freightMinimum: 'pricing',
  showMarkupOnEstimator: 'pricing',
  dealStatuses: 'deal_statuses',
  clientPaymentStatuses: 'client_payment_statuses',
  factoryPaymentStatuses: 'factory_payment_statuses',
  productionStatuses: 'production_statuses',
  insulationStatuses: 'insulation_statuses',
  freightStatuses: 'freight_statuses',
  personnel: null,
  externalPersonnel: 'manual_personnel',
  clients: 'clients',
  dealers: 'dealers',
};

function normalizeThreshold(value: unknown) {
  return value === 'Infinity' || value === null || value === undefined
    ? Infinity
    : Number(value) || 0;
}

function isPlaceholderDisplayName(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.trim();
  if (!normalized) return true;

  return /^user[\s_-]*[a-z0-9-]{6,}$/i.test(normalized);
}

function resolvePersonnelName(options: {
  displayName?: string | null;
  accessRequestName?: string | null;
  email?: string | null;
  userId: string;
}) {
  const displayName = options.displayName?.trim() || '';
  const accessRequestName = options.accessRequestName?.trim() || '';
  const email = options.email?.trim() || '';

  if (displayName && !isPlaceholderDisplayName(displayName)) {
    return displayName;
  }

  if (accessRequestName) {
    return accessRequestName;
  }

  if (displayName) {
    return displayName;
  }

  if (email) {
    return email.split('@')[0];
  }

  return `User ${options.userId.slice(0, 8)}`;
}

function isManualPersonnelEntry(entry: PersonnelEntry) {
  return entry.id.startsWith('manual:');
}

function normalizeManualPersonnelEntry(entry: any, index: number): PersonnelEntry {
  const roles = Array.isArray(entry?.roles) && entry.roles.length
    ? entry.roles.filter((role: string) => ['sales_rep', 'estimator', 'team_lead'].includes(role))
    : [entry?.role || 'sales_rep'];
  const normalizedRoles = (roles.length ? roles : ['sales_rep']) as PersonnelRole[];

  return {
    id: String(entry?.id || `manual:${index}`),
    name: String(entry?.name || '').trim(),
    email: String(entry?.email || '').trim(),
    role: normalizedRoles[0],
    roles: normalizedRoles,
  };
}

function mergePersonnelLists(platformPersonnel: PersonnelEntry[], externalPersonnel: PersonnelEntry[]) {
  return [...platformPersonnel, ...externalPersonnel]
    .filter(entry => entry.name || entry.email)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeSettingsRows(rows: { key: string; value: any }[], personnel: PersonnelEntry[]): AppSettings {
  const next = { ...DEFAULT_SETTINGS, personnel: [], externalPersonnel: [] };
  const byKey = new Map(rows.map(row => [row.key, row.value]));

  const pricing = byKey.get('pricing') || {};
  Object.assign(next, {
    supplierIncreasePct: Number(pricing.supplierIncreasePct ?? next.supplierIncreasePct),
    minimumMargin: Number(pricing.minimumMargin ?? next.minimumMargin),
    minimumMarginThreshold: Number(pricing.minimumMarginThreshold ?? next.minimumMarginThreshold),
    drawingsMarkup: Number(pricing.drawingsMarkup ?? next.drawingsMarkup),
    internalMarginOnEstimator: Number(pricing.internalMarginOnEstimator ?? next.internalMarginOnEstimator),
    frostWallMultiplier: Number(pricing.frostWallMultiplier ?? next.frostWallMultiplier),
    gutterPerLF: Number(pricing.gutterPerLF ?? next.gutterPerLF),
    linerPerSqft: Number(pricing.linerPerSqft ?? next.linerPerSqft),
    freightBaseRate: Number(pricing.freightBaseRate ?? next.freightBaseRate),
    freightMinimum: Number(pricing.freightMinimum ?? next.freightMinimum),
    showMarkupOnEstimator: Boolean(pricing.showMarkupOnEstimator ?? next.showMarkupOnEstimator),
  });

  const tiers = byKey.get('internal_markup_tiers');
  if (Array.isArray(tiers)) {
    next.internalMarkupTiers = tiers.map((tier: any) => ({
      threshold: normalizeThreshold(tier.threshold),
      rate: Number(tier.rate) || 0,
    }));
  }

  const keyedLists: Array<[keyof AppSettings, string]> = [
    ['dealStatuses', 'deal_statuses'],
    ['clientPaymentStatuses', 'client_payment_statuses'],
    ['factoryPaymentStatuses', 'factory_payment_statuses'],
    ['productionStatuses', 'production_statuses'],
    ['insulationStatuses', 'insulation_statuses'],
    ['freightStatuses', 'freight_statuses'],
    ['clients', 'clients'],
    ['dealers', 'dealers'],
  ];
  for (const [settingKey, rowKey] of keyedLists) {
    const value = byKey.get(rowKey);
    if (Array.isArray(value)) {
      (next as any)[settingKey] = value;
    }
  }

  const manualPersonnel = byKey.get('manual_personnel');
  if (Array.isArray(manualPersonnel)) {
    next.externalPersonnel = manualPersonnel
      .map(normalizeManualPersonnelEntry)
      .filter(entry => entry.name || entry.email);
  }

  next.personnel = mergePersonnelLists(personnel, next.externalPersonnel);

  return next;
}

async function fetchPersonnel(): Promise<PersonnelEntry[]> {
  const { data: rolesData } = await supabase.from('user_roles').select('user_id, role');
  if (!rolesData?.length) return [];

  const relevantRoles = rolesData.filter(role => ['sales_rep', 'estimator'].includes(role.role));
  const grouped = new Map<string, string[]>();
  for (const row of relevantRoles) {
    grouped.set(row.user_id, [...(grouped.get(row.user_id) || []), row.role]);
  }

  const ids = Array.from(grouped.keys());
  if (!ids.length) return [];

  let displayInfo: any[] = [];
  const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_user_directory', { user_ids: ids });
  if (!rpcError && Array.isArray(rpcData)) {
    displayInfo = rpcData;
  }
  const displayMap = new Map((displayInfo || []).map((row: any) => [row.id, row]));

  const accessRequestMap = new Map<string, { email: string; name: string }>();
  const { data: accessRequests } = await supabase
    .from('access_requests')
    .select('user_id, email, name, created_at')
    .in('user_id', ids)
    .order('created_at', { ascending: false });

  for (const row of accessRequests || []) {
    if (!accessRequestMap.has(row.user_id)) {
      accessRequestMap.set(row.user_id, {
        email: row.email || '',
        name: row.name || '',
      });
    }
  }

  return ids.map(id => {
    const info = displayMap.get(id);
    const accessRequest = accessRequestMap.get(id);
    const roles = grouped.get(id) || [];
    const email = info?.email || accessRequest?.email || '';

    return {
      id,
      name: resolvePersonnelName({
        displayName: info?.display_name,
        accessRequestName: accessRequest?.name,
        email,
        userId: id,
      }),
      email,
      role: (roles[0] as PersonnelRole) || 'sales_rep',
      roles: roles as PersonnelRole[],
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useRoles();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [profile, setProfile] = useState<UserProfileSettings>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  const fetchRemoteState = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, personnel, profileRes] = await Promise.all([
        (supabase.from as any)('app_settings').select('key, value'),
        fetchPersonnel(),
        currentUser.id
          ? (supabase.from as any)('user_profiles').select('*').eq('user_id', currentUser.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const nextSettings = mergeSettingsRows(settingsRes.data || [], personnel);
      setSettings(nextSettings);

      if (profileRes?.data) {
        setProfile({
          userId: profileRes.data.user_id,
          phone: profileRes.data.phone ?? '',
          address: profileRes.data.address ?? '',
          emailNotifications: profileRes.data.email_notifications ?? true,
          smsNotifications: profileRes.data.sms_notifications ?? false,
          canViewAllFreightBoard: profileRes.data.can_view_all_freight_board ?? false,
          createdAt: profileRes.data.created_at ?? '',
          updatedAt: profileRes.data.updated_at ?? '',
        });
      } else {
        setProfile(prev => ({ ...DEFAULT_PROFILE, ...prev, userId: currentUser.id || '' }));
      }
    } finally {
      setLoading(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    void fetchRemoteState();
  }, [fetchRemoteState]);

  const persistSettings = useCallback(async (next: AppSettings, updates: Partial<AppSettings>) => {
    const groupedPayloads = new Map<string, any>();

    const pricingKeys: (keyof AppSettings)[] = [
      'supplierIncreasePct', 'minimumMargin', 'minimumMarginThreshold', 'drawingsMarkup',
      'internalMarginOnEstimator', 'frostWallMultiplier', 'gutterPerLF', 'linerPerSqft',
      'freightBaseRate', 'freightMinimum', 'showMarkupOnEstimator',
    ];

    if (pricingKeys.some(key => key in updates)) {
      groupedPayloads.set('pricing', {
        supplierIncreasePct: next.supplierIncreasePct,
        minimumMargin: next.minimumMargin,
        minimumMarginThreshold: next.minimumMarginThreshold,
        drawingsMarkup: next.drawingsMarkup,
        internalMarginOnEstimator: next.internalMarginOnEstimator,
        frostWallMultiplier: next.frostWallMultiplier,
        gutterPerLF: next.gutterPerLF,
        linerPerSqft: next.linerPerSqft,
        freightBaseRate: next.freightBaseRate,
        freightMinimum: next.freightMinimum,
        showMarkupOnEstimator: next.showMarkupOnEstimator,
      });
    }

    if (updates.internalMarkupTiers) {
      groupedPayloads.set('internal_markup_tiers', next.internalMarkupTiers.map(tier => ({
        threshold: Number.isFinite(tier.threshold) ? tier.threshold : 'Infinity',
        rate: tier.rate,
      })));
    }

    for (const [key, value] of Object.entries(updates) as Array<[keyof AppSettings, any]>) {
      const storageKey = SETTINGS_KEY_MAP[key];
      if (!storageKey || groupedPayloads.has(storageKey)) continue;
      groupedPayloads.set(storageKey, value);
    }

    await Promise.all(
      Array.from(groupedPayloads.entries()).map(([key, value]) =>
        (supabase.from as any)('app_settings').upsert({
          key,
          value,
          updated_by: currentUser.id || null,
          updated_at: new Date().toISOString(),
        })
      )
    );
  }, [currentUser.id]);

  const updateSettings = useCallback(async (updates: Partial<AppSettings>) => {
    const next = { ...settings, ...updates };
    if (updates.externalPersonnel) {
      const platformPersonnel = settings.personnel.filter(entry => !isManualPersonnelEntry(entry));
      next.personnel = mergePersonnelLists(platformPersonnel, updates.externalPersonnel);
    }
    setSettings(next);
    await persistSettings(next, updates);
    if ('personnel' in updates) {
      void fetchRemoteState();
    }
  }, [fetchRemoteState, persistSettings, settings]);

  const updateProfile = useCallback(async (updates: Partial<UserProfileSettings>) => {
    const next = { ...profile, ...updates, userId: currentUser.id || profile.userId };
    setProfile(next);
    if (!next.userId) return;

    await (supabase.from as any)('user_profiles').upsert({
      user_id: next.userId,
      phone: next.phone,
      address: next.address,
      email_notifications: next.emailNotifications,
      sms_notifications: next.smsNotifications,
      can_view_all_freight_board: next.canViewAllFreightBoard,
      updated_at: new Date().toISOString(),
    });
  }, [currentUser.id, profile]);

  const getSalesReps = useCallback(() => settings.personnel.filter(person => person.roles.includes('sales_rep')), [settings]);
  const getEstimators = useCallback(() => settings.personnel.filter(person => person.roles.includes('estimator')), [settings]);
  const getTeamLeads = useCallback(() => settings.personnel.filter(person => person.roles.includes('team_lead')), [settings]);

  return (
    <SettingsContext.Provider value={{ settings, profile, loading, updateSettings, updateProfile, getSalesReps, getEstimators, getTeamLeads }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
