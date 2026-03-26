import {
  Calculator, FileText, ClipboardList, Briefcase, DollarSign,
  BarChart3, CreditCard, Users, Truck, Factory, Award, FileSpreadsheet,
  Receipt, TrendingUp, Building2, ChevronDown, FileInput,
  Shield, User, Settings as SettingsIcon, Send, LogOut, List, Store
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useRoles, ROLE_LABELS, type UserRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      { path: '/quote-rfq', label: 'Quote RFQ', icon: Send, module: 'quote-log' },
      { path: '/estimates-log', label: 'Estimates Log', icon: List, module: 'estimator' },
      { path: '/quote-log', label: 'Quote Log', icon: ClipboardList, module: 'quote-log' },
      { path: '/internal-quote-builder', label: 'Internal Quote Builder', icon: FileInput, module: 'internal-quote-builder' },
      { path: '/quote-builder', label: 'Sales Quote Builder', icon: FileText, module: 'quote-builder' },
    ],
  },
  {
    label: 'Deals',
    items: [
      { path: '/deals', label: 'Master Deals', icon: Briefcase, module: 'deals' },
      { path: '/production', label: 'Production Status', icon: Factory, module: 'production' },
      { path: '/internal-costs', label: 'Internal Costs', icon: DollarSign, module: 'internal-costs' },
      { path: '/commission', label: 'Commission & Profit', icon: Award, module: 'commission' },
      { path: '/deal-pl', label: 'Deal Exposure', icon: BarChart3, module: 'deal-pl' },
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
    label: 'Dealer',
    items: [
      { path: '/dealer-rfq', label: 'Dealer RFQ', icon: Store, module: 'dealer-rfq' },
      { path: '/dealer-log', label: 'My Requests', icon: ClipboardList, module: 'dealer-log' },
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


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { canAccess } = useRoles();
  const { user, userRoles, signOut } = useAuth();

  const filteredGroups = menuGroups
    .map(g => ({ ...g, items: g.items.filter(item => canAccess(item.module)) }))
    .filter(g => g.items.length > 0);

  const isGroupActive = (group: MenuGroup) =>
    group.items.some(item => location.pathname === item.path);

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
            <div className="flex items-center gap-2 text-xs text-sidebar-foreground/70">
              <User className="h-3.5 w-3.5" />
              <span className="truncate">{user?.email || 'Unknown'}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {userRoles.map(r => (
                <Badge key={r} variant="secondary" className="text-[9px] px-1.5 py-0 bg-sidebar-accent text-sidebar-accent-foreground">
                  {ROLE_LABELS[r as UserRole] || r}
                </Badge>
              ))}
              {userRoles.length === 0 && (
                <span className="text-[9px] text-sidebar-muted">No roles assigned</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-3 w-3 mr-1.5" />Sign Out
            </Button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button onClick={() => signOut()} title="Sign Out">
              <LogOut className="h-4 w-4 text-sidebar-muted hover:text-sidebar-foreground" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
