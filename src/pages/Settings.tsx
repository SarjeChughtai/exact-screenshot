import { useState } from 'react';
import { useSettings, type PersonnelEntry } from '@/context/SettingsContext';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Download, Upload, Plus, Trash2 } from 'lucide-react';
import { UserManagement } from '@/components/UserManagement';
import CRMSettings from '@/components/CRMSettings';
import QBOSettings from '@/components/QBOSettings';
import DataImportSettings from '@/components/DataImportSettings';
import DealerProfileSettings from '@/components/DealerProfileSettings';
import DealerManagement from '@/components/DealerManagement';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const appCtx = useAppContext();
  const { hasAnyRole } = useRoles();
  const isAdmin = hasAnyRole('admin', 'owner');
  const isDealer = hasAnyRole('dealer');

  const [newPerson, setNewPerson] = useState({ name: '', email: '', roles: ['sales_rep'] as PersonnelEntry['roles'] });

  const toggleNewRole = (role: PersonnelEntry['roles'][number]) => {
    setNewPerson(p => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter(r => r !== role) : [...p.roles, role],
    }));
  };

  const addPerson = () => {
    if (!newPerson.name || newPerson.roles.length === 0) { 
      toast.error(t('settings.personnel.toast.required')); 
      return; 
    }
    const entry: PersonnelEntry = { id: crypto.randomUUID(), name: newPerson.name, email: newPerson.email, role: newPerson.roles[0], roles: newPerson.roles };
    updateSettings({ personnel: [...settings.personnel, entry] });
    setNewPerson({ name: '', email: '', roles: ['sales_rep'] });
    toast.success(t('settings.personnel.toast.added'));
  };

  const removePerson = (id: string) => {
    updateSettings({ personnel: settings.personnel.filter(p => p.id !== id) });
  };

  const exportAllData = () => {
    const data = {
      state: localStorage.getItem('canada_steel_state'),
      settings: localStorage.getItem('canada_steel_settings'),
      user: localStorage.getItem('canada_steel_user'),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `canada_steel_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(t('settings.data.toast.exported'));
  };

  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.state) localStorage.setItem('canada_steel_state', data.state);
        if (data.settings) localStorage.setItem('canada_steel_settings', data.settings);
        if (data.user) localStorage.setItem('canada_steel_user', data.user);
        toast.success(t('settings.data.toast.imported'));
        setTimeout(() => window.location.reload(), 500);
      } catch { toast.error(t('settings.data.toast.invalid')); }
    };
    input.click();
  };

  const updateStatusList = (key: string, value: string) => {
    updateSettings({ [key]: value.split(',').map(s => s.trim()).filter(Boolean) });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('settings.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <Tabs defaultValue={isAdmin ? "markups" : isDealer ? "dealer-profile" : "statuses"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="markups">{t('settings.tabs.markups')}</TabsTrigger>}
          {isAdmin && <TabsTrigger value="estimator">{t('settings.tabs.estimator')}</TabsTrigger>}
          {isDealer && <TabsTrigger value="dealer-profile">{t('settings.tabs.dealerProfile')}</TabsTrigger>}
          {!isDealer && <TabsTrigger value="statuses">{t('settings.tabs.statuses')}</TabsTrigger>}
          {!isDealer && <TabsTrigger value="personnel">{t('settings.tabs.personnel')}</TabsTrigger>}
           {isAdmin && <TabsTrigger value="users">{t('settings.tabs.users')}</TabsTrigger>}
           {isAdmin && <TabsTrigger value="crm">{t('settings.tabs.crm')}</TabsTrigger>}
           {isAdmin && <TabsTrigger value="quickbooks">{t('settings.tabs.quickbooks')}</TabsTrigger>}
           {isAdmin && <TabsTrigger value="dealer-management">{t('dealerManagement.title')}</TabsTrigger>}
           {!isDealer && <TabsTrigger value="data">{t('settings.tabs.data')}</TabsTrigger>}
        </TabsList>

        {isAdmin && (
          <TabsContent value="markups" className="space-y-4">
            <div className="bg-card border rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-card-foreground">{t('settings.markups.title')}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">{t('settings.markups.supplierIncrease')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.supplierIncreasePct} onChange={e => updateSettings({ supplierIncreasePct: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.minMargin')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.minimumMargin} onChange={e => updateSettings({ minimumMargin: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.minMarginThreshold')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.minimumMarginThreshold} onChange={e => updateSettings({ minimumMarginThreshold: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.drawingsMarkup')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.drawingsMarkup} onChange={e => updateSettings({ drawingsMarkup: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.frostWallMultiplier')}</Label>
                  <Input className="input-blue mt-1" type="number" step="0.01" value={settings.frostWallMultiplier} onChange={e => updateSettings({ frostWallMultiplier: parseFloat(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.gutterPerLF')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.gutterPerLF} onChange={e => updateSettings({ gutterPerLF: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.linerPerSqft')}</Label>
                  <Input className="input-blue mt-1" type="number" step="0.01" value={settings.linerPerSqft} onChange={e => updateSettings({ linerPerSqft: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.freightBaseRate')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.freightBaseRate} onChange={e => updateSettings({ freightBaseRate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">{t('settings.markups.freightMinimum')}</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.freightMinimum} onChange={e => updateSettings({ freightMinimum: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">{t('settings.markups.internalMarkupTiers')}</Label>
                <div className="mt-2 space-y-1">
                  {settings.internalMarkupTiers.map((tier, i) => (
                    <div key={i} className="flex gap-2 items-center text-xs">
                      <span className="text-muted-foreground w-12">≤</span>
                      <Input className="input-blue h-7 w-28" type="number" value={tier.threshold === Infinity ? '' : tier.threshold} placeholder="∞"
                        onChange={e => {
                          const tiers = [...settings.internalMarkupTiers];
                          tiers[i] = { ...tiers[i], threshold: parseFloat(e.target.value) || Infinity };
                          updateSettings({ internalMarkupTiers: tiers });
                        }} />
                      <span className="text-muted-foreground">→</span>
                      <Input className="input-blue h-7 w-20" type="number" step="0.01" value={(tier.rate * 100).toFixed(1)}
                        onChange={e => {
                          const tiers = [...settings.internalMarkupTiers];
                          tiers[i] = { ...tiers[i], rate: (parseFloat(e.target.value) || 0) / 100 };
                          updateSettings({ internalMarkupTiers: tiers });
                        }} />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="estimator" className="space-y-4">
            <div className="bg-card border rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-card-foreground">{t('settings.estimator.title')}</h3>
              <div>
                <Label className="text-xs">{t('settings.estimator.internalMargin')}</Label>
                <Input className="input-blue mt-1 w-32" type="number" value={settings.internalMarginOnEstimator} onChange={e => updateSettings({ internalMarginOnEstimator: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={settings.showMarkupOnEstimator} onCheckedChange={v => updateSettings({ showMarkupOnEstimator: v })} />
                <Label className="text-xs">{t('settings.estimator.showMarkup')}</Label>
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.estimator.showMarkupNote')}</p>
            </div>
          </TabsContent>
        )}

        {isDealer && (
          <TabsContent value="dealer-profile" className="space-y-4">
            <DealerProfileSettings />
          </TabsContent>
        )}

        <TabsContent value="statuses" className="space-y-4">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-card-foreground">{t('settings.statuses.title')}</h3>
            {[
              { key: 'dealStatuses', label: t('settings.statuses.deal') },
              { key: 'clientPaymentStatuses', label: t('settings.statuses.clientPayment') },
              { key: 'factoryPaymentStatuses', label: t('settings.statuses.factoryPayment') },
              { key: 'productionStatuses', label: t('settings.statuses.production') },
              { key: 'insulationStatuses', label: t('settings.statuses.insulation') },
              { key: 'freightStatuses', label: t('settings.statuses.freight') },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label className="text-xs">{label}</Label>
                <Input className="input-blue mt-1" value={(settings as any)[key].join(', ')}
                  onChange={e => updateStatusList(key, e.target.value)}
                  disabled={!isAdmin} />
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="personnel" className="space-y-4">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-card-foreground">{t('settings.personnel.title')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium text-xs">{t('settings.personnel.headers.name')}</th>
                    <th className="pb-2 font-medium text-xs">{t('settings.personnel.headers.email')}</th>
                    <th className="pb-2 font-medium text-xs">{t('settings.personnel.headers.role')}</th>
                    {isAdmin && <th className="pb-2 font-medium text-xs w-10"></th>}
                  </tr>
                </thead>
                <tbody>
                  {settings.personnel.map(p => (
                    <tr key={p.id} className="border-b">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{p.email}</td>
                      <td className="py-2 text-xs capitalize">{(p.roles || [p.role]).map(r => r.replace('_', ' ')).join(', ')}</td>
                      {isAdmin && (
                        <td className="py-2">
                          <Button variant="ghost" size="sm" onClick={() => removePerson(p.id)}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2 items-end">
                <div><Label className="text-xs">{t('settings.personnel.headers.name')}</Label><Input className="input-blue mt-1 h-8" value={newPerson.name} onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label className="text-xs">{t('settings.personnel.headers.email')}</Label><Input className="input-blue mt-1 h-8" value={newPerson.email} onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))} /></div>
                <div>
                  <Label className="text-xs">{t('settings.personnel.headers.role')}</Label>
                  <div className="flex gap-2 mt-1">
                    {(['sales_rep', 'estimator', 'team_lead'] as const).map(r => (
                      <label key={r} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={newPerson.roles.includes(r)} onChange={() => toggleNewRole(r)} className="rounded" />
                        {r === 'sales_rep' ? t('auth.salesRep') : r === 'estimator' ? t('settings.tabs.estimator') : t('auth.teamLead') || 'Team Lead'}
                      </label>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={addPerson}><Plus className="h-3 w-3 mr-1" />{t('settings.personnel.addPerson')}</Button>
              </div>
            )}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <UserManagement />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="crm" className="space-y-4">
            <CRMSettings />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="quickbooks" className="space-y-4">
            <QBOSettings />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="dealer-management" className="space-y-4">
            <DealerManagement />
          </TabsContent>
        )}

        <TabsContent value="data" className="space-y-4">
          <DataImportSettings />
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-card-foreground">{t('settings.data.backup')}</h3>
            <div className="flex gap-3">
              <Button variant="outline" onClick={exportAllData}>
                <Download className="h-4 w-4 mr-2" />{t('settings.data.export')}
              </Button>
              <Button variant="outline" onClick={importData}>
                <Upload className="h-4 w-4 mr-2" />{t('settings.data.import')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.data.note')}</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
