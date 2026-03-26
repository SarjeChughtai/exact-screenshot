import {
  Calculator, FileText, ClipboardList, Briefcase, DollarSign,
  BarChart3, CreditCard, Users, Truck, Factory, Award, FileSpreadsheet,
  Receipt, TrendingUp, Building2, ChevronDown, FileInput,
  Shield, User, Settings as SettingsIcon, Send
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useRoles, ROLE_LABELS, ALL_ROLES, type UserRole } from '@/context/RoleContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface MenuItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', icon: BarChart3, module: 'dashboard' },
    ],
  },
  {
    label: 'Quotes',
    items: [
      { path: '/estimator', label: 'Quick Estimator', icon: Calculator, module: 'estimator' },
      { path: '/internal-quote-builder', label: 'Internal Quote Builder', icon: FileInput, module: 'internal-quote-builder' },
      { path: '/quote-builder', label: 'Sales Quote Builder', icon: FileText, module: 'quote-builder' },
      { path: '/quote-log', label: 'Quote Log', icon: ClipboardList, module: 'quote-log' },
    ],
  },
  {
    label: 'Deals',
    items: [
      { path: '/deals', label: 'Master Deals', icon: Briefcase, module: 'deals' },
      { path: '/deal-pl', label: 'Deal P&L', icon: BarChart3, module: 'deal-pl' },
      { path: '/commission', label: 'Commission & Profit', icon: Award, module: 'commission' },
      { path: '/production', label: 'Production Status', icon: Factory, module: 'production' },
      { path: '/internal-costs', label: 'Internal Costs', icon: DollarSign, module: 'internal-costs' },
    ],
  },
  {
    label: 'Financials',
    items: [
      { path: '/payment-ledger', label: 'Payment Ledger', icon: CreditCard, module: 'payment-ledger' },
      { path: '/client-payments', label: 'Client Payments', icon: Users, module: 'client-payments' },
      { path: '/vendor-payments', label: 'Vendor Payments', icon: Receipt, module: 'vendor-payments' },
      { path: '/financials', label: 'Projected Financials', icon: TrendingUp, module: 'financials' },
      { path: '/monthly-hst', label: 'Monthly HST', icon: FileSpreadsheet, module: 'monthly-hst' },
      { path: '/commission-statement', label: 'Commission Statement', icon: FileSpreadsheet, module: 'commission-statement' },
    ],
  },
  {
    label: 'Freight',
    items: [
      { path: '/rfq', label: 'RFQ Board', icon: Send, module: 'rfq' },
      { path: '/freight', label: 'Freight Board', icon: Truck, module: 'freight' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/settings', label: 'Settings', icon: SettingsIcon, module: 'settings' },
      { path: '/audit-log', label: 'Audit Log', icon: ClipboardList, module: 'settings' },
    ],
  },
];

const DEMO_USERS: { label: string; roles: UserRole[] }[] = [
  { label: 'Admin', roles: ['admin'] },
  { label: 'Owner', roles: ['owner'] },
  { label: 'Accounting', roles: ['accounting'] },
  { label: 'Operations', roles: ['operations'] },
  { label: 'Sales Rep', roles: ['sales_rep'] },
  { label: 'Freight', roles: ['freight'] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { currentUser, setCurrentUser, canAccess } = useRoles();
  const [showRolePicker, setShowRolePicker] = useState(false);

  const filteredGroups = menuGroups
    .map(g => ({ ...g, items: g.items.filter(item => canAccess(item.module)) }))
    .filter(g => g.items.length > 0);

  const isGroupActive = (group: MenuGroup) =>
    group.items.some(item => location.pathname === item.path);

  const toggleRole = (role: UserRole) => {
    const newRoles = currentUser.roles.includes(role)
      ? currentUser.roles.filter(r => r !== role)
      : [...currentUser.roles, role];
    if (newRoles.length === 0) return;
    setCurrentUser({ ...currentUser, roles: newRoles });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 shrink-0 text-sidebar-primary" />
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-xs font-bold tracking-wide text-sidebar-primary-foreground">CANADA STEEL</h1>
              <p className="text-[9px] tracking-widest uppercase text-sidebar-muted">Buildings Platform</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filteredGroups.map(group => (
          <Collapsible key={group.label} defaultOpen={isGroupActive(group) || group.label === 'Overview'}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-foreground transition-colors">
                  {!collapsed && <span>{group.label}</span>}
                  {!collapsed && <ChevronDown className="h-3 w-3 transition-transform duration-200" />}
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(item => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.path} end={item.path === '/'} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary-foreground font-medium">
                            <item.icon className="h-4 w-4 shrink-0" />
                            {!collapsed && <span className="truncate">{item.label}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="space-y-2">
            <button onClick={() => setShowRolePicker(!showRolePicker)} className="flex items-center gap-2 w-full text-left text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
              <User className="h-3.5 w-3.5" /><span className="truncate">{currentUser.name}</span>
            </button>
            <div className="flex flex-wrap gap-1">
              {currentUser.roles.map(r => (
                <Badge key={r} variant="secondary" className="text-[9px] px-1.5 py-0 bg-sidebar-accent text-sidebar-accent-foreground">{ROLE_LABELS[r]}</Badge>
              ))}
            </div>
            {showRolePicker && (
              <div className="space-y-1.5 pt-1 border-t border-sidebar-border">
                <p className="text-[9px] uppercase tracking-wider text-sidebar-muted font-semibold">Switch Roles</p>
                {ALL_ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2 text-[11px] text-sidebar-foreground/80 cursor-pointer">
                    <Checkbox checked={currentUser.roles.includes(role)} onCheckedChange={() => toggleRole(role)} className="h-3 w-3 border-sidebar-border" />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
                <div className="pt-1 space-y-1">
                  <p className="text-[9px] uppercase tracking-wider text-sidebar-muted font-semibold">Quick Switch</p>
                  {DEMO_USERS.map(u => (
                    <button key={u.label} onClick={() => setCurrentUser({ ...currentUser, name: `${u.label} User`, roles: u.roles })}
                      className={cn("block w-full text-left text-[10px] px-2 py-0.5 rounded text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        JSON.stringify(currentUser.roles) === JSON.stringify(u.roles) && "bg-sidebar-accent text-sidebar-primary-foreground")}>
                      View as {u.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex justify-center"><Shield className="h-4 w-4 text-sidebar-muted" /></div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
