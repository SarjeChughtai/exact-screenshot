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
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { UserManagement } from '@/components/UserManagement';
import CRMSettings from '@/components/CRMSettings';
import QBOSettings from '@/components/QBOSettings';
import DataImportSettings from '@/components/DataImportSettings';
import DealerProfileSettings from '@/components/DealerProfileSettings';
import DealerManagement from '@/components/DealerManagement';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { t } = useTranslation();
  const { settings, profile, updateSettings, updateProfile } = useSettings();
  const appCtx = useAppContext();
  const { hasAnyRole } = useRoles();
  const { user } = useAuth();
  const isAdmin = hasAnyRole('admin', 'owner');
  const isDealer = hasAnyRole('dealer');
  const [pendingEmail, setPendingEmail] = useState(user?.email || '');
  const [pendingPassword, setPendingPassword] = useState('');
  const [newExternalPerson, setNewExternalPerson] = useState({
    name: '',
    email: '',
    roles: ['sales_rep'] as PersonnelEntry['roles'],
  });

  const toggleExternalRole = (role: PersonnelEntry['roles'][number]) => {
    setNewExternalPerson(current => ({
      ...current,
      roles: current.roles.includes(role)
        ? current.roles.filter(item => item !== role)
        : [...current.roles, role],
    }));
  };

  const addExternalPerson = async () => {
    if (!newExternalPerson.name.trim() || newExternalPerson.roles.length === 0) {
      toast.error(t('settings.personnel.toast.required'));
      return;
    }

    const nextEntry: PersonnelEntry = {
      id: `manual:${crypto.randomUUID()}`,
      name: newExternalPerson.name.trim(),
      email: newExternalPerson.email.trim(),
      role: newExternalPerson.roles[0],
      roles: newExternalPerson.roles,
    };

    await updateSettings({
      externalPersonnel: [...settings.externalPersonnel, nextEntry],
    });

    setNewExternalPerson({
      name: '',
      email: '',
      roles: ['sales_rep'],
    });
    toast.success(t('settings.personnel.toast.added'));
  };

  const removeExternalPerson = async (id: string) => {
    await updateSettings({
      externalPersonnel: settings.externalPersonnel.filter(person => person.id !== id),
    });
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

  const saveEmail = async () => {
    if (!pendingEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    const { error } = await supabase.auth.updateUser({ email: pendingEmail.trim() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Email update requested');
  };

  const savePassword = async () => {
    if (!pendingPassword.trim()) {
      toast.error('Password is required');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: pendingPassword });
    if (error) {
      toast.error(error.message);
      return;
    }
    setPendingPassword('');
    toast.success('Password updated');
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Profile</h2>
          <p className="text-sm text-muted-foreground mt-1">Personal account settings only.</p>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <div>
            <Label className="text-xs">Email</Label>
            <div className="flex gap-2 mt-1">
              <Input className="input-blue" value={pendingEmail} onChange={e => setPendingEmail(e.target.value)} />
              <Button variant="outline" onClick={() => void saveEmail()}>Update Email</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Password</Label>
            <div className="flex gap-2 mt-1">
              <Input className="input-blue" type="password" value={pendingPassword} onChange={e => setPendingPassword(e.target.value)} placeholder="New password" />
              <Button variant="outline" onClick={() => void savePassword()}>Update Password</Button>
            </div>
          </div>

          <div>
            <Label className="text-xs">Phone</Label>
            <Input className="input-blue mt-1" value={profile.phone} onChange={e => void updateProfile({ phone: e.target.value })} />
          </div>

          <div>
            <Label className="text-xs">Address</Label>
            <Input className="input-blue mt-1" value={profile.address} onChange={e => void updateProfile({ address: e.target.value })} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Receive email notifications</Label>
            <Switch checked={profile.emailNotifications} onCheckedChange={value => void updateProfile({ emailNotifications: value })} />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Receive text notifications</Label>
            <Switch checked={profile.smsNotifications} onCheckedChange={value => void updateProfile({ smsNotifications: value })} />
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label className="text-xs">Messaging Access</Label>
              <p className="text-[11px] text-muted-foreground">Enabled by admin per user.</p>
            </div>
            <span className="text-xs font-medium">{profile.canUseMessaging ? 'Enabled' : 'Disabled'}</span>
          </div>

          {isDealer && <DealerProfileSettings />}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t('settings.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
        <p className="text-xs text-muted-foreground mt-2">Messaging access for your account: <span className="font-medium text-foreground">{profile.canUseMessaging ? 'Enabled' : 'Disabled'}</span></p>
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
            <p className="text-xs text-muted-foreground">
              Personnel is now driven by user access roles. Add or remove `Sales Rep` and `Estimator` access here and the personnel list will update automatically.
            </p>
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
                          {p.id.startsWith('manual:') && (
                            <Button variant="ghost" size="sm" onClick={() => void removeExternalPerson(p.id)}>
                              Remove
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <div className="border rounded-lg p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground">Add External Personnel</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Use this for sales reps or estimators who should appear in the personnel list but do not have a platform account.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <Label className="text-xs">{t('settings.personnel.headers.name')}</Label>
                    <Input
                      className="input-blue mt-1 h-8"
                      value={newExternalPerson.name}
                      onChange={event => setNewExternalPerson(current => ({ ...current, name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('settings.personnel.headers.email')}</Label>
                    <Input
                      className="input-blue mt-1 h-8"
                      value={newExternalPerson.email}
                      onChange={event => setNewExternalPerson(current => ({ ...current, email: event.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">{t('settings.personnel.headers.role')}</Label>
                    <div className="flex gap-2 mt-2">
                      {(['sales_rep', 'estimator', 'team_lead'] as const).map(role => (
                        <label key={role} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newExternalPerson.roles.includes(role)}
                            onChange={() => toggleExternalRole(role)}
                            className="rounded"
                          />
                          {role === 'sales_rep'
                            ? t('auth.salesRep')
                            : role === 'estimator'
                              ? t('settings.tabs.estimator')
                              : t('auth.teamLead') || 'Team Lead'}
                        </label>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => void addExternalPerson()}>
                    Add External Person
                  </Button>
                </div>
              </div>
            )}
            {isAdmin && <UserManagement managedRoles={['sales_rep', 'estimator']} hidePendingRequests />}
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
