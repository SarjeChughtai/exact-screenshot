import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

export type UserRole = 'admin' | 'owner' | 'accounting' | 'operations' | 'sales_rep' | 'estimator' | 'freight' | 'dealer' | 'manufacturer' | 'construction';

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
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  isImpersonating: boolean;
  actualRoles: UserRole[];
}

const MODULE_ACCESS: Record<string, UserRole[]> = {
  dashboard: ['admin', 'owner', 'accounting', 'operations', 'sales_rep', 'freight'],
  estimator: ['admin', 'owner', 'sales_rep'],
  'quote-builder': ['admin', 'owner', 'sales_rep'],
  'internal-quote-builder': ['admin', 'owner', 'operations'],
  'quote-log': ['admin', 'owner', 'sales_rep', 'operations', 'estimator', 'dealer'],
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
  rfq: ['admin', 'owner', 'freight', 'operations'],
  settings: ['admin', 'owner', 'accounting', 'operations', 'sales_rep', 'estimator', 'freight', 'manufacturer', 'dealer'],
  'dealer-rfq': ['admin', 'owner', 'dealer'],
  'dealer-log': ['admin', 'owner', 'dealer'],
  'draft-log': ['admin', 'owner'],
  'internal-quote-log': ['admin', 'owner', 'operations', 'sales_rep'],
  'master-data': ['owner'],
  'vendor-board': ['admin', 'owner', 'operations', 'freight', 'manufacturer', 'construction'],
};

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const { user, userRoles } = useAuth();
  const [viewAsRole, setViewAsRole] = useState<UserRole | null>(null);

  const actualRoles = (userRoles as UserRole[]) || [];
  const isOwnerOrAdmin = actualRoles.includes('admin') || actualRoles.includes('owner');

  const effectiveRoles = viewAsRole && isOwnerOrAdmin ? [viewAsRole] : actualRoles;

  const [currentUser, setCurrentUserState] = useState<UserProfile>({
    id: user?.id || '',
    name: user?.user_metadata?.name || user?.email || '',
    email: user?.email || '',
    roles: effectiveRoles,
  });

  useEffect(() => {
    setCurrentUserState({
      id: user?.id || '',
      name: user?.user_metadata?.name || user?.email || '',
      email: user?.email || '',
      roles: effectiveRoles,
    });
  }, [user, userRoles, viewAsRole]);

  const setCurrentUser = useCallback((u: UserProfile) => {
    setCurrentUserState(u);
  }, []);

  const hasRole = useCallback((role: UserRole) => currentUser.roles.includes(role), [currentUser]);
  const hasAnyRole = useCallback((...roles: UserRole[]) => roles.some(r => currentUser.roles.includes(r)), [currentUser]);
  const canAccess = useCallback((module: string) => {
    const allowed = MODULE_ACCESS[module];
    if (!allowed) return true;
    return currentUser.roles.some(r => allowed.includes(r));
  }, [currentUser]);

  const isImpersonating = viewAsRole !== null && isOwnerOrAdmin;

  return (
    <RoleContext.Provider value={{ currentUser, setCurrentUser, hasRole, hasAnyRole, canAccess, viewAsRole, setViewAsRole, isImpersonating, actualRoles }}>
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
  estimator: 'Estimator',
  freight: 'Freight Carrier',
  dealer: 'Dealer',
  manufacturer: 'Steel Manufacturer',
  construction: 'Construction',
};

export const ALL_ROLES: UserRole[] = ['admin', 'owner', 'accounting', 'operations', 'sales_rep', 'estimator', 'freight', 'dealer', 'manufacturer', 'construction'];
