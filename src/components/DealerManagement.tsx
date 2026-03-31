import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/context/SettingsContext';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Search, Store, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DealerProfileSettings from './DealerProfileSettings';
import { Input } from '@/components/ui/input';

export default function DealerManagement() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const [dealers, setDealers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Get all users with 'dealer' role
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'dealer');

    if (rolesData) {
      const dealerIds = rolesData.map(r => r.user_id);
      
      // 2. Get display info for these users
      const { data: displayInfo } = await supabase.rpc('get_user_display_info', {
        user_ids: dealerIds,
      });

      if (displayInfo) {
        // 3. Merge with dealer settings from Context
        const merged = (displayInfo as any[]).map(u => {
          const profile = settings.dealers?.find(d => d.userId === u.id);
          return {
            id: u.id,
            email: u.email,
            name: u.display_name || u.email,
            businessName: profile?.businessName || '—',
            clientId: profile?.clientId || 'PENDING',
            profile: profile
          };
        });
        setDealers(merged);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [settings.dealers]);

  const filteredDealers = dealers.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.email.toLowerCase().includes(search.toLowerCase()) ||
    d.businessName.toLowerCase().includes(search.toLowerCase()) ||
    d.clientId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-semibold text-card-foreground">
              {t('dealerManagement.title')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t('dealerManagement.subtitle')}
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search dealers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground uppercase tracking-wider">
                <th className="pb-2 font-medium px-2">{t('dealerManagement.headers.business')}</th>
                <th className="pb-2 font-medium px-2">{t('dealerManagement.headers.clientId')}</th>
                <th className="pb-2 font-medium px-2">Account</th>
                <th className="pb-2 font-medium px-2 text-right">{t('dealerManagement.headers.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground italic">Loading dealers...</td></tr>
              ) : filteredDealers.length === 0 ? (
                <tr><td colSpan={4} className="py-8 text-center text-muted-foreground italic">{t('dealerManagement.noDealers')}</td></tr>
              ) : filteredDealers.map(d => (
                <tr key={d.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <Store className="h-3.5 w-3.5 text-primary" />
                      <span className="font-semibold">{d.businessName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Badge variant={d.clientId === 'PENDING' ? 'outline' : 'secondary'} className="font-mono text-[10px]">
                      <Hash className="h-2.5 w-2.5 mr-1 opacity-50" />
                      {d.clientId}
                    </Badge>
                  </td>
                  <td className="py-3 px-2">
                    <p className="font-medium">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">{d.email}</p>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-1.5"
                      onClick={() => setEditingUserId(d.id)}
                    >
                      <Edit2 className="h-3 w-3" />
                      {t('common.edit') || 'Edit'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editingUserId} onOpenChange={open => !open && setEditingUserId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
               <Edit2 className="h-5 w-5 text-primary" />
               {t('dealerManagement.editDealer')}
            </DialogTitle>
          </DialogHeader>
          {editingUserId && (
             <div className="pt-2">
                <DealerProfileSettings userId={editingUserId} />
             </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
