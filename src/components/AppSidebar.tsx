import {
  Calculator, FileText, ClipboardList, Briefcase, DollarSign,
  BarChart3, CreditCard, Users, Truck, Factory, Award, FileSpreadsheet,
  Receipt, TrendingUp, Building2, ChevronDown, FileInput,
  Shield, User, Settings as SettingsIcon, Send, LogOut, List, Store, Eye, EyeOff, Database, UserCircle, Package, MessageSquare
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useRoles, ROLE_LABELS, ALL_ROLES, type UserRole } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { useTranslation } from 'react-i18next';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

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
    label: 'sidebar.overview',
    items: [
      { path: '/', label: 'sidebar.dashboard', icon: BarChart3, module: 'dashboard' },
      { path: '/messages', label: 'sidebar.messages', icon: MessageSquare, module: 'messages' },
    ],
  },
  {
    label: 'sidebar.quotes',
    items: [
      { path: '/estimator', label: 'sidebar.quickEstimator', icon: Calculator, module: 'estimator' },
      { path: '/estimates-log', label: 'sidebar.estimatesLog', icon: List, module: 'estimator' },
      { path: '/quote-rfq', label: 'sidebar.quoteRfq', icon: Send, module: 'quote-log' },
      { path: '/quote-log', label: 'sidebar.quoteLog', icon: ClipboardList, module: 'quote-log' },
      { path: '/internal-quote-log', label: 'sidebar.internalQuoteLog', icon: List, module: 'internal-quote-log' },
      { path: '/internal-quote-builder', label: 'sidebar.internalQuoteBuilder', icon: FileInput, module: 'internal-quote-builder' },
      { path: '/import-review', label: 'sidebar.importReview', icon: Eye, module: 'internal-quote-builder' },
      { path: '/draft-log', label: 'sidebar.draftLog', icon: FileText, module: 'draft-log' },
      { path: '/quote-builder', label: 'sidebar.salesQuoteBuilder', icon: FileText, module: 'quote-builder' },
    ],
  },
  {
    label: 'sidebar.deals',
    items: [
      { path: '/deals', label: 'sidebar.masterDeals', icon: Briefcase, module: 'deals' },
      { path: '/production', label: 'sidebar.productionStatus', icon: Factory, module: 'production' },
      { path: '/internal-costs', label: 'sidebar.internalCosts', icon: DollarSign, module: 'internal-costs' },
      { path: '/commission', label: 'sidebar.commissionProfit', icon: Award, module: 'commission' },
      { path: '/deal-pl', label: 'sidebar.dealExposure', icon: BarChart3, module: 'deal-pl' },
    ],
  },
  {
    label: 'sidebar.financials',
    items: [
      { path: '/payment-ledger', label: 'sidebar.paymentLedger', icon: CreditCard, module: 'payment-ledger' },
      { path: '/clients', label: 'sidebar.clients', icon: UserCircle, module: 'payment-ledger' },
      { path: '/vendors', label: 'sidebar.vendors', icon: Package, module: 'payment-ledger' },
      { path: '/client-payments', label: 'sidebar.clientPayments', icon: Users, module: 'client-payments' },
      { path: '/vendor-payments', label: 'sidebar.vendorPayments', icon: Receipt, module: 'vendor-payments' },
      { path: '/financials', label: 'sidebar.projectedFinancials', icon: TrendingUp, module: 'financials' },
      { path: '/monthly-hst', label: 'sidebar.monthlyHst', icon: FileSpreadsheet, module: 'monthly-hst' },
      { path: '/commission-statement', label: 'sidebar.commissionStatement', icon: FileSpreadsheet, module: 'commission-statement' },
    ],
  },
  {
    label: 'sidebar.freight',
    items: [
      { path: '/rfq', label: 'sidebar.rfqBoard', icon: Send, module: 'rfq' },
      { path: '/freight', label: 'sidebar.freightBoard', icon: Truck, module: 'freight' },
    ],
  },
  {
    label: 'sidebar.dealer',
    items: [
      { path: '/dealer-log', label: 'sidebar.myRequests', icon: ClipboardList, module: 'dealer-log' },
      { path: '/dealer-rfq', label: 'sidebar.dealerRfq', icon: Store, module: 'dealer-rfq' },
    ],
  },
  {
    label: 'sidebar.vendorPortal',
    items: [
      { path: '/vendor-board', label: 'sidebar.quoteBoard', icon: Factory, module: 'vendor-board' },
    ],
  },
  {
    label: 'sidebar.system',
    items: [
      { path: '/cost-data', label: 'sidebar.costData', icon: Database, module: 'cost-data' },
      { path: '/settings', label: 'sidebar.settings', icon: SettingsIcon, module: 'settings' },
      { path: '/audit-log', label: 'sidebar.auditLog', icon: ClipboardList, module: 'settings' },
      { path: '/master-data', label: 'sidebar.masterData', icon: Database, module: 'master-data' },
    ],
  },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { canAccess, viewAsRole, setViewAsRole, isImpersonating, actualRoles } = useRoles();
  const { user, userRoles, signOut } = useAuth();
  const { profile } = useSettings();
  const { t } = useTranslation();
  const canImpersonate = actualRoles.includes('admin') || actualRoles.includes('owner');

  const filteredGroups = menuGroups
    .map(g => ({
      ...g,
      items: g.items.filter(item => canAccess(item.module) && (item.module !== 'messages' || profile.canUseMessaging)),
    }))
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
              <p className="text-[9px] tracking-widest uppercase text-sidebar-muted">{t('sidebar.buildingsPlatform')}</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filteredGroups.map(group => (
          <Collapsible key={group.label} defaultOpen={isGroupActive(group) || group.label === 'sidebar.overview'}>
            <SidebarGroup>
              <CollapsibleTrigger className="w-full">
                <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:text-sidebar-foreground transition-colors">
                  {!collapsed && <span>{t(group.label)}</span>}
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
                            {!collapsed && <span className="truncate">{t(item.label)}</span>}
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
            {canImpersonate && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[9px] font-medium text-sidebar-foreground/50 uppercase tracking-wider">
                  <Eye className="h-3 w-3" />
                  {t('sidebar.viewAs')}
                </div>
                <Select
                  value={viewAsRole || '_none'}
                  onValueChange={(v) => setViewAsRole(v === '_none' ? null : v as UserRole)}
                >
                  <SelectTrigger className="h-7 text-xs bg-sidebar-accent/30 border-sidebar-border">
                    <SelectValue placeholder="Your roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">My View (Owner)</SelectItem>
                    {ALL_ROLES.filter(r => r !== 'owner' && r !== 'admin').map(role => (
                      <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isImpersonating && (
                  <p className="text-[9px] text-amber-400 flex items-center gap-1">
                    <EyeOff className="h-2.5 w-2.5" />
                    Viewing as {ROLE_LABELS[viewAsRole!]}
                  </p>
                )}
              </div>
            )}
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
              <LogOut className="h-3 w-3 mr-1.5" />{t('sidebar.signOut')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {canImpersonate && (
              <button onClick={() => setViewAsRole(viewAsRole ? null : 'sales_rep')} title="Toggle View As">
                <Eye className={cn("h-4 w-4", isImpersonating ? "text-amber-400" : "text-sidebar-muted hover:text-sidebar-foreground")} />
              </button>
            )}
            <button onClick={() => signOut()} title="Sign Out">
              <LogOut className="h-4 w-4 text-sidebar-muted hover:text-sidebar-foreground" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
