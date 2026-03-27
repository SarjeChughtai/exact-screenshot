import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Send, Store } from 'lucide-react';
import { PROVINCES } from '@/lib/calculations';
import { useAuth } from '@/context/AuthContext';
import { useRoles } from '@/context/RoleContext';

export default function DealerRFQ() {
  const { user } = useAuth();
  const { hasRole } = useRoles();
  const isOwner = hasRole('owner');

  const [form, setForm] = useState({
    clientName: '', clientId: '', contactEmail: '', contactPhone: '',
    province: 'ON', city: '', address: '', postalCode: '',
    width: '', length: '', height: '14', roofPitch: '1:12',
    gutters: false, liners: '', insulationRequired: false,
    insulationRoofGrade: '', insulationWallGrade: '',
    notes: '',
  });

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = () => {
    if (!form.clientName.trim()) { toast.error('Client name is required'); return; }
    if (!form.width || !form.length) { toast.error('Building dimensions are required'); return; }

    // Save to localStorage dealer requests
    const requests = JSON.parse(localStorage.getItem('csb_dealer_requests') || '[]');
    requests.push({
      id: crypto.randomUUID(),
      ...form,
      status: 'Submitted',
      createdAt: new Date().toISOString(),
      submittedBy: user?.email || 'unknown',
      submittedByRole: isOwner ? 'owner' : 'dealer',
    });
    localStorage.setItem('csb_dealer_requests', JSON.stringify(requests));

    toast.success('RFQ submitted successfully');
    setForm({
      clientName: '', clientId: '', contactEmail: '', contactPhone: '',
      province: 'ON', city: '', address: '', postalCode: '',
      width: '', length: '', height: '14', roofPitch: '1:12',
      gutters: false, liners: '', insulationRequired: false,
      insulationRoofGrade: '', insulationWallGrade: '', notes: '',
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2"><Store className="h-6 w-6" /> {isOwner ? 'Dealer RFQ (Owner View)' : 'Dealer RFQ'}</h2>
        <p className="text-sm text-muted-foreground mt-1">{isOwner ? 'Submit RFQs on behalf of dealers and review submissions in Dealer Log.' : 'Submit a request for quotation for your client.'}</p>
      </div>

      <div className="space-y-5">
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Client Information</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Client Name *</Label><Input className="input-blue mt-1" value={form.clientName} onChange={e => set('clientName', e.target.value)} /></div>
            <div><Label className="text-xs">Client ID</Label><Input className="input-blue mt-1" value={form.clientId} onChange={e => set('clientId', e.target.value)} /></div>
            <div><Label className="text-xs">Contact Email</Label><Input className="input-blue mt-1" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
            <div><Label className="text-xs">Contact Phone</Label><Input className="input-blue mt-1" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={form.province} onValueChange={v => set('province', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code} — {p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">City</Label><Input className="input-blue mt-1" value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div className="col-span-2"><Label className="text-xs">Address</Label><Input className="input-blue mt-1" value={form.address} onChange={e => set('address', e.target.value)} /></div>
            <div><Label className="text-xs">Postal Code</Label><Input className="input-blue mt-1" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} /></div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Building Details</h3>
          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs">Width (ft) *</Label><Input className="input-blue mt-1" type="number" value={form.width} onChange={e => set('width', e.target.value)} /></div>
            <div><Label className="text-xs">Length (ft) *</Label><Input className="input-blue mt-1" type="number" value={form.length} onChange={e => set('length', e.target.value)} /></div>
            <div><Label className="text-xs">Height (ft)</Label><Input className="input-blue mt-1" type="number" value={form.height} onChange={e => set('height', e.target.value)} /></div>
            <div><Label className="text-xs">Roof Pitch</Label><Input className="input-blue mt-1" value={form.roofPitch} onChange={e => set('roofPitch', e.target.value)} placeholder="1:12" /></div>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accessories</h3>
          <div>
            <Label className="text-xs">Liners</Label>
            <Select value={form.liners} onValueChange={v => set('liners', v)}>
              <SelectTrigger className="input-blue mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="roof">Roof</SelectItem>
                <SelectItem value="walls">Walls</SelectItem>
                <SelectItem value="roof_walls">Roof & Walls</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Notes</h3>
          <Textarea className="text-xs min-h-[100px]" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Special requirements, openings, additional details..." />
        </div>

        <Button onClick={handleSubmit} className="w-full" size="lg">
          <Send className="h-4 w-4 mr-2" />Submit RFQ
        </Button>
      </div>
    </div>
  );
}
