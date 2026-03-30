import { useState, useEffect } from 'react';
import { useSettings, type DealerProfile } from '@/context/SettingsContext';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Store, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DealerProfileSettings() {
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState<Partial<DealerProfile>>({
    clientId: '',
    contactEmail: user?.email || '',
    contactPhone: '',
    billingInfo: '',
  });

  useEffect(() => {
    if (user?.id) {
      const existing = settings.dealers?.find(d => d.userId === user.id);
      if (existing) {
        setForm({
          clientId: existing.clientId || '',
          contactEmail: existing.contactEmail || user.email || '',
          contactPhone: existing.contactPhone || '',
          billingInfo: existing.billingInfo || '',
        });
      }
    }
  }, [user?.id, settings.dealers, user?.email]);

  const handleSave = () => {
    if (!user?.id) return;
    if (!form.clientId?.trim()) {
      toast.error('Client ID is required');
      return;
    }
    if (!form.contactEmail?.trim()) {
      toast.error('Contact Email is required');
      return;
    }

    const newProfile: DealerProfile = {
      userId: user.id,
      clientId: form.clientId,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone || '',
      billingInfo: form.billingInfo || '',
    };

    const updatedDealers = (settings.dealers || []).filter(d => d.userId !== user.id);
    updatedDealers.push(newProfile);

    updateSettings({ dealers: updatedDealers });
    toast.success('Dealer profile saved consistently');
    
    // Redirect back to dealer-log if they were forced here
    navigate('/dealer-log');
  };

  return (
    <div className="bg-card border rounded-lg p-5 space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Store className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-card-foreground">My Dealer Profile</h3>
      </div>
      <p className="text-xs text-muted-foreground">Setup your default contact information and custom billing references. This information will be used for all your RFQs.</p>

      <div className="space-y-4 mt-4 max-w-xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">Client ID *</Label>
            <Input 
              className="input-blue mt-1 h-9 bg-background" 
              value={form.clientId} 
              onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))} 
              placeholder="e.g. DL-1004"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Your assigned or preferred Client ID</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold">Contact Email *</Label>
            <Input 
              className="input-blue mt-1 h-9 bg-background" 
              type="email"
              value={form.contactEmail} 
              onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} 
            />
          </div>
          <div>
            <Label className="text-xs font-semibold">Contact Phone</Label>
            <Input 
              className="input-blue mt-1 h-9 bg-background" 
              value={form.contactPhone} 
              onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} 
              placeholder="(555) 555-5555"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold">Personal Billing / Account Info</Label>
          <Textarea 
            className="input-blue mt-1 min-h-[100px] bg-background text-sm" 
            value={form.billingInfo} 
            onChange={e => setForm(f => ({ ...f, billingInfo: e.target.value }))} 
            placeholder="Enter your personal billing information, address, or payment references..."
          />
        </div>

        <Button onClick={handleSave} className="w-full sm:w-auto">
          <Save className="h-4 w-4 mr-2" /> Save Profile
        </Button>
      </div>
    </div>
  );
}
