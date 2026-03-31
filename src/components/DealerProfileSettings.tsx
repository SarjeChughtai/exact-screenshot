import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, Store, Mail, Phone, Hash } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRoles } from '@/context/RoleContext';

export default function DealerProfileSettings({ userId: targetUserId }: { userId?: string }) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { user: authUser } = useAuth();
  const { hasAnyRole } = useRoles();
  const navigate = useNavigate();
  
  const effectiveUserId = targetUserId || authUser?.id;
  const isAdminEdit = !!targetUserId;
  const canEditClientId = hasAnyRole('admin', 'owner');

  const [profile, setProfile] = useState({
    businessName: '',
    contactEmail: '',
    contactPhone: '',
    clientId: '',
    billingInfo: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (effectiveUserId && settings.dealers) {
      const existing = settings.dealers.find(d => d.userId === effectiveUserId);
      if (existing) {
        setProfile({
          businessName: existing.businessName || '',
          contactEmail: existing.contactEmail || (isAdminEdit ? '' : authUser?.email || ''),
          contactPhone: existing.contactPhone || '',
          clientId: existing.clientId || '',
          billingInfo: existing.billingInfo || '',
        });
      } else if (!isAdminEdit && authUser) {
        setProfile(p => ({ ...p, contactEmail: authUser.email || '' }));
      }
    }
  }, [effectiveUserId, settings.dealers, isAdminEdit, authUser]);

  const handleSave = async () => {
    if (!effectiveUserId) return;
    
    setLoading(true);

    const updatedDealers = [...(settings.dealers || [])];
    const index = updatedDealers.findIndex(d => d.userId === effectiveUserId);
    
    // Auto-generate Client ID if missing and not provided
    let finalClientId = profile.clientId.trim();
    if (!finalClientId) {
       finalClientId = `DLR-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }

    const newProfile = {
      ...profile,
      clientId: finalClientId,
      userId: effectiveUserId,
      updatedAt: new Date().toISOString(),
    };

    if (index >= 0) {
      updatedDealers[index] = newProfile as any;
    } else {
      updatedDealers.push(newProfile as any);
    }

    updateSettings({ dealers: updatedDealers });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoading(false);
    toast.success(t('dealerProfile.toast.success'));
    
    // Redirect if it's the dealer editing their own profile
    if (!isAdminEdit) {
      navigate('/dealer-log');
    }
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Store className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">{t('dealerProfile.title')}</CardTitle>
        </div>
        <CardDescription>
          {t('dealerProfile.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="biz-name" className="flex items-center gap-2">
              <Store className="h-3.5 w-3.5" /> {t('dealerProfile.businessName')}
            </Label>
            <Input 
              id="biz-name" 
              placeholder={t('dealerProfile.businessNamePlaceholder')}
              value={profile.businessName}
              onChange={e => setProfile({...profile, businessName: e.target.value})}
              className="input-blue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-id" className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5" /> {t('dealerProfile.clientId')}
              {!canEditClientId && profile.clientId && (
                <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase">Read Only</span>
              )}
            </Label>
            <Input 
              id="client-id" 
              placeholder={profile.clientId ? "" : "Auto-generated on save"}
              value={profile.clientId}
              onChange={e => setProfile({...profile, clientId: e.target.value})}
              className="input-blue"
              disabled={!canEditClientId}
            />
            {!canEditClientId && !profile.clientId && (
              <p className="text-[10px] text-muted-foreground">{t('dealerRfq.clientIdNote')} (Pending Save)</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-email" className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> {t('dealerProfile.contactEmail')}
            </Label>
            <Input 
              id="contact-email" 
              type="email"
              placeholder="sales@yourcompany.com"
              value={profile.contactEmail}
              onChange={e => setProfile({...profile, contactEmail: e.target.value})}
              className="input-blue"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-phone" className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5" /> {t('dealerProfile.contactPhone')}
            </Label>
            <Input 
              id="contact-phone" 
              placeholder="(555) 000-0000"
              value={profile.contactPhone}
              onChange={e => setProfile({...profile, contactPhone: e.target.value})}
              className="input-blue"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="billing-info" className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5" /> {t('dealerProfile.billingInfo') || 'Personal Billing / Account Info'}
          </Label>
          <Textarea 
            id="billing-info"
            className="input-blue mt-1 min-h-[100px] bg-background text-sm" 
            value={profile.billingInfo} 
            onChange={e => setProfile({...profile, billingInfo: e.target.value})} 
            placeholder={t('dealerProfile.billingInfoPlaceholder') || "Enter your personal billing information, address, or payment references..."}
          />
        </div>

        <div className="pt-4 flex justify-end">
          <Button onClick={handleSave} disabled={loading} className="px-8">
            <Save className="h-4 w-4 mr-2" />
            {loading ? t('common.saving') : t('dealerProfile.saveProfile')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
