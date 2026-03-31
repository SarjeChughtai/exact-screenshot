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

export default function DealerProfileSettings() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState({
    businessName: '',
    contactEmail: '',
    contactPhone: '',
    clientId: '',
    billingInfo: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && settings.dealers) {
      const existing = settings.dealers.find(d => d.userId === user.id);
      if (existing) {
        setProfile({
          businessName: existing.businessName || '',
          contactEmail: existing.contactEmail || user.email || '',
          contactPhone: existing.contactPhone || '',
          clientId: existing.clientId || '',
          billingInfo: existing.billingInfo || '',
        });
      } else {
        setProfile(p => ({ ...p, contactEmail: user.email || '' }));
      }
    }
  }, [user, settings.dealers]);

  const handleSave = async () => {
    if (!user) return;
    if (!profile.clientId.trim()) {
      toast.error(t('dealerProfile.toast.clientIdRequired') || 'Client ID is required');
      return;
    }
    
    setLoading(true);

    const updatedDealers = [...(settings.dealers || [])];
    const index = updatedDealers.findIndex(d => d.userId === user.id);
    
    const newProfile = {
      ...profile,
      userId: user.id,
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
    
    // Redirect back to dealer-log if they were forced here
    navigate('/dealer-log');
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
            </Label>
            <Input 
              id="client-id" 
              placeholder="DLR-XXXX"
              value={profile.clientId}
              onChange={e => setProfile({...profile, clientId: e.target.value})}
              className="input-blue"
            />
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
