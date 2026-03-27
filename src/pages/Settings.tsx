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

export default function Settings() {
  const { settings, updateSettings } = useSettings();
  const appCtx = useAppContext();
  const { hasAnyRole } = useRoles();
  const isAdmin = hasAnyRole('admin', 'owner');

  const [newPerson, setNewPerson] = useState({ name: '', email: '', roles: ['sales_rep'] as PersonnelEntry['roles'] });

  const toggleNewRole = (role: PersonnelEntry['roles'][number]) => {
    setNewPerson(p => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter(r => r !== role) : [...p.roles, role],
    }));
  };

  const addPerson = () => {
    if (!newPerson.name || newPerson.roles.length === 0) { toast.error('Name and at least one role required'); return; }
    const entry: PersonnelEntry = { id: crypto.randomUUID(), name: newPerson.name, email: newPerson.email, role: newPerson.roles[0], roles: newPerson.roles };
    updateSettings({ personnel: [...settings.personnel, entry] });
    setNewPerson({ name: '', email: '', roles: ['sales_rep'] });
    toast.success('Person added');
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
    toast.success('Data exported');
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
        toast.success('Data imported — refreshing...');
        setTimeout(() => window.location.reload(), 500);
      } catch { toast.error('Invalid backup file'); }
    };
    input.click();
  };

  const updateStatusList = (key: string, value: string) => {
    updateSettings({ [key]: value.split(',').map(s => s.trim()).filter(Boolean) });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">Global configuration for markups, statuses, and personnel</p>
      </div>

      <Tabs defaultValue={isAdmin ? "markups" : "statuses"}>
        <TabsList>
          {isAdmin && <TabsTrigger value="markups">Markup & Costs</TabsTrigger>}
          {isAdmin && <TabsTrigger value="estimator">Estimator</TabsTrigger>}
          <TabsTrigger value="statuses">Status Options</TabsTrigger>
          <TabsTrigger value="personnel">Personnel</TabsTrigger>
          {isAdmin && <TabsTrigger value="users">Users & Access</TabsTrigger>}
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent value="markups" className="space-y-4">
            <div className="bg-card border rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-card-foreground">Markup & Cost Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Supplier Increase %</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.supplierIncreasePct} onChange={e => updateSettings({ supplierIncreasePct: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Minimum Margin ($)</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.minimumMargin} onChange={e => updateSettings({ minimumMargin: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Min Margin Threshold ($)</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.minimumMarginThreshold} onChange={e => updateSettings({ minimumMarginThreshold: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Drawings Markup ($)</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.drawingsMarkup} onChange={e => updateSettings({ drawingsMarkup: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Frost Wall Multiplier</Label>
                  <Input className="input-blue mt-1" type="number" step="0.01" value={settings.frostWallMultiplier} onChange={e => updateSettings({ frostWallMultiplier: parseFloat(e.target.value) || 1 })} />
                </div>
                <div>
                  <Label className="text-xs">Gutter $/LF</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.gutterPerLF} onChange={e => updateSettings({ gutterPerLF: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Liner $/sqft</Label>
                  <Input className="input-blue mt-1" type="number" step="0.01" value={settings.linerPerSqft} onChange={e => updateSettings({ linerPerSqft: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Freight Base ($/km)</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.freightBaseRate} onChange={e => updateSettings({ freightBaseRate: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label className="text-xs">Freight Minimum ($)</Label>
                  <Input className="input-blue mt-1" type="number" value={settings.freightMinimum} onChange={e => updateSettings({ freightMinimum: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold">Internal Markup Tiers</Label>
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
              <h3 className="text-sm font-semibold text-card-foreground">Estimator Display</h3>
              <div>
                <Label className="text-xs">Internal Margin on Estimator (%)</Label>
                <Input className="input-blue mt-1 w-32" type="number" value={settings.internalMarginOnEstimator} onChange={e => updateSettings({ internalMarginOnEstimator: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={settings.showMarkupOnEstimator} onCheckedChange={v => updateSettings({ showMarkupOnEstimator: v })} />
                <Label className="text-xs">Show markup details on Quick Estimator</Label>
              </div>
              <p className="text-xs text-muted-foreground">When OFF, the Quick Estimator shows final prices only with no mention of supplier increase %, internal margin %, or any markup labels.</p>
            </div>
          </TabsContent>
        )}

        <TabsContent value="statuses" className="space-y-4">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-card-foreground">Status Options (comma-separated)</h3>
            {[
              { key: 'dealStatuses', label: 'Deal Statuses' },
              { key: 'clientPaymentStatuses', label: 'Client Payment Statuses' },
              { key: 'factoryPaymentStatuses', label: 'Factory Payment Statuses' },
              { key: 'productionStatuses', label: 'Production Statuses' },
              { key: 'insulationStatuses', label: 'Insulation Statuses' },
              { key: 'freightStatuses', label: 'Freight Statuses' },
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
            <h3 className="text-sm font-semibold text-card-foreground">Personnel Database</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium text-xs">Name</th>
                    <th className="pb-2 font-medium text-xs">Email</th>
                    <th className="pb-2 font-medium text-xs">Role</th>
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
                <div><Label className="text-xs">Name</Label><Input className="input-blue mt-1 h-8" value={newPerson.name} onChange={e => setNewPerson(p => ({ ...p, name: e.target.value }))} /></div>
                <div><Label className="text-xs">Email</Label><Input className="input-blue mt-1 h-8" value={newPerson.email} onChange={e => setNewPerson(p => ({ ...p, email: e.target.value }))} /></div>
                <div>
                  <Label className="text-xs">Roles</Label>
                  <div className="flex gap-2 mt-1">
                    {(['sales_rep', 'estimator', 'team_lead'] as const).map(r => (
                      <label key={r} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={newPerson.roles.includes(r)} onChange={() => toggleNewRole(r)} className="rounded" />
                        {r === 'sales_rep' ? 'Sales Rep' : r === 'estimator' ? 'Estimator' : 'Team Lead'}
                      </label>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={addPerson}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
            )}
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users" className="space-y-4">
            <UserManagement />
          </TabsContent>
        )}

        <TabsContent value="data" className="space-y-4">
          <div className="bg-card border rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-card-foreground">Data Management</h3>
            <div className="flex gap-3">
              <Button variant="outline" onClick={exportAllData}>
                <Download className="h-4 w-4 mr-2" />Export All Data
              </Button>
              <Button variant="outline" onClick={importData}>
                <Upload className="h-4 w-4 mr-2" />Import Data
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Export downloads all deals, quotes, payments, costs, and settings as JSON. Import restores from a backup file.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
