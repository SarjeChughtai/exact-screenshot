import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { useRoles } from '@/context/RoleContext';

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
  clientPaymentStatuses: ['1st Payment', '2nd Payment', '3rd Payment', 'Paid in Full'],
  factoryPaymentStatuses: ['1st Payment (15%)', '2nd Payment (50%)', '3rd Payment (35%)', 'Paid'],
  productionStatuses: ['Drawings to be Signed', 'MBS File Requested', 'Sent to Engineering', 'Drawings Stamped', 'Sent to Production', 'Ready for Pickup', 'Delivered'],
  insulationStatuses: ['Requested', 'Ordered', 'Delivered', 'N/A'],
  freightStatuses: ['RFQ', 'Quoted', 'Booked', 'Delivered'],
  personnel: [
    { id: '1', name: 'Devin Sloane', email: 'devin@canadasteel.ca', role: 'sales_rep', roles: ['sales_rep'] },
    { id: '2', name: 'Jatin Mahey', email: 'jatin@canadasteel.ca', role: 'sales_rep', roles: ['sales_rep'] },
    { id: '3', name: 'Mitch Fink', email: 'mitch@canadasteel.ca', role: 'sales_rep', roles: ['sales_rep'] },
  ],
  clients: [],
  dealers: [],
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  getSalesReps: () => PersonnelEntry[];
  getEstimators: () => PersonnelEntry[];
  getTeamLeads: () => PersonnelEntry[];
}

function migratePersonnel(personnel: any[]): PersonnelEntry[] {
  return personnel.map(p => ({
    ...p,
    roles: p.roles || [p.role || 'sales_rep'],
  }));
}

function loadSettings(): AppSettings {
  try {
    const s = localStorage.getItem('canada_steel_settings');
    if (s) {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
      if (parsed.personnel) parsed.personnel = migratePersonnel(parsed.personnel);
      return parsed;
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const { actualRoles, currentUser } = useRoles();

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('canada_steel_settings', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    // Automatically add current user to personnel if they have sales_rep role
    if (actualRoles.includes('sales_rep') && currentUser.email) {
      const exists = settings.personnel.some(p => p.email.toLowerCase() === currentUser.email.toLowerCase());
      if (!exists) {
        const newEntry: PersonnelEntry = {
          id: currentUser.id || crypto.randomUUID(),
          name: currentUser.name || currentUser.email,
          email: currentUser.email,
          role: 'sales_rep',
          roles: ['sales_rep']
        };
        updateSettings({ personnel: [...settings.personnel, newEntry] });
      }
    }
  }, [actualRoles, currentUser, settings.personnel, updateSettings]);

  const getSalesReps = useCallback(() => settings.personnel.filter(p => (p.roles || [p.role]).includes('sales_rep')), [settings]);
  const getEstimators = useCallback(() => settings.personnel.filter(p => (p.roles || [p.role]).includes('estimator')), [settings]);
  const getTeamLeads = useCallback(() => settings.personnel.filter(p => (p.roles || [p.role]).includes('team_lead')), [settings]);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, getSalesReps, getEstimators, getTeamLeads }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
