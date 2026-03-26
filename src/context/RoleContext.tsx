import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type UserRole = 'admin' | 'owner' | 'accounting' | 'operations' | 'sales_rep' | 'freight' | 'estimator';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
}

interface RoleContextType {
  currentUser: UserProfile;
  setCurrentUser: (user: UserProfile) => void;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (...roles: UserRole[]) => boolean;
  canAccess: (module: string) => boolean;
}

const MODULE_ACCESS: Record<string, UserRole[]> = {
  dashboard: ['admin', 'owner', 'accounting', 'operations', 'sales_rep', 'freight'],
  estimator: ['admin', 'owner', 'sales_rep'],
  'quote-builder': ['admin', 'owner', 'sales_rep'],
  'internal-quote-builder': ['admin', 'owner'],
  'quote-log': ['admin', 'owner', 'sales_rep', 'operations', 'estimator'],
  'rfq-builder': ['admin', 'owner', 'sales_rep'],
  deals: ['admin', 'owner', 'operations', 'sales_rep'],
  'deal-pl': ['admin', 'owner', 'accounting'],
  'commission': ['admin', 'owner'],
  'production': ['admin', 'owner', 'operations'],
  'internal-costs': ['admin', 'owner', 'operations'],
  'payment-ledger': ['admin', 'owner', 'accounting'],
  'client-payments': ['admin', 'owner', 'accounting'],
  'vendor-payments': ['admin', 'owner', 'accounting'],
  financials: ['admin', 'owner', 'accounting'],
  'monthly-hst': ['admin', 'owner', 'accounting'],
  'commission-statement': ['admin', 'owner', 'accounting'],
  freight: ['admin', 'owner', 'freight', 'operations'],
  settings: ['admin', 'owner', 'accounting', 'operations', 'sales_rep', 'freight'],
};

function loadUser(): UserProfile {
  try {
    const s = localStorage.getItem('canada_steel_user');
    if (s) return JSON.parse(s);
  } catch {}
  return { id: 'admin-1', name: 'Admin User', email: 'admin@canadasteel.ca', roles: ['admin'] };
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<UserProfile>(loadUser);

  const setCurrentUser = useCallback((user: UserProfile) => {
    setCurrentUserState(user);
    localStorage.setItem('canada_steel_user', JSON.stringify(user));
  }, []);

  const hasRole = useCallback((role: UserRole) => currentUser.roles.includes(role), [currentUser]);
  const hasAnyRole = useCallback((...roles: UserRole[]) => roles.some(r => currentUser.roles.includes(r)), [currentUser]);
  const canAccess = useCallback((module: string) => {
    const allowed = MODULE_ACCESS[module];
    if (!allowed) return true;
    return currentUser.roles.some(r => allowed.includes(r));
  }, [currentUser]);

  return (
    <RoleContext.Provider value={{ currentUser, setCurrentUser, hasRole, hasAnyRole, canAccess }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoles() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRoles must be used within RoleProvider');
  return ctx;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  owner: 'Owner',
  accounting: 'Accounting',
  operations: 'Operations',
  sales_rep: 'Sales Rep',
  freight: 'Freight',
  estimator: 'Estimator',
};

export const ALL_ROLES: UserRole[] = ['admin', 'owner', 'accounting', 'operations', 'sales_rep', 'freight', 'estimator'];
