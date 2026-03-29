import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/context/AppContext';
import { PROVINCES } from '@/lib/calculations';
import { PersonnelSelect } from '@/components/PersonnelSelect';
import { ClientSelect } from '@/components/ClientSelect';
import type { Deal } from '@/types';
import { toast } from 'sonner';

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobCreated: (jobId: string) => void;
}

const generateJobId = () => `CSB-${Date.now().toString(36).toUpperCase()}`;

const INITIAL_FORM = {
  jobId: '',
  jobName: '',
  clientName: '',
  clientId: '',
  salesRep: '',
  estimator: '',
  teamLead: '',
  province: 'ON',
  city: '',
  address: '',
  postalCode: '',
  width: '',
  length: '',
  height: '14',
};

export function CreateJobDialog({ open, onOpenChange, onJobCreated }: CreateJobDialogProps) {
  const { addDeal } = useAppContext();
  const [form, setForm] = useState({ ...INITIAL_FORM });

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleCreate = () => {
    const jobId = form.jobId.trim() || generateJobId();
    if (!form.clientName.trim()) {
      toast.error('Client Name is required');
      return;
    }

    const w = parseFloat(form.width) || 0;
    const l = parseFloat(form.length) || 0;
    const h = parseFloat(form.height) || 14;

    const deal: Deal = {
      jobId,
      jobName: form.jobName,
      clientName: form.clientName,
      clientId: form.clientId,
      salesRep: form.salesRep,
      estimator: form.estimator,
      teamLead: form.teamLead,
      province: form.province,
      city: form.city,
      address: form.address,
      postalCode: form.postalCode,
      width: w,
      length: l,
      height: h,
      sqft: w * l,
      weight: 0,
      taxRate: 0,
      taxType: '',
      orderType: '',
      dateSigned: new Date().toISOString().split('T')[0],
      dealStatus: 'Lead',
      paymentStatus: 'UNPAID',
      productionStatus: 'Submitted',
      freightStatus: 'Pending',
      insulationStatus: '',
      deliveryDate: '',
      pickupDate: '',
      notes: '',
    };

    addDeal(deal);
    toast.success(`Job ${jobId} created`);
    onJobCreated(jobId);
    setForm({ ...INITIAL_FORM });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>Create a new deal/job ID. It will be automatically selected.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Job ID <span className="text-muted-foreground">(auto if empty)</span></Label>
              <Input className="input-blue mt-1" value={form.jobId} onChange={e => set('jobId', e.target.value)} placeholder="Auto-generated" />
            </div>
            <div>
              <Label className="text-xs">Job Name</Label>
              <Input className="input-blue mt-1" value={form.jobName} onChange={e => set('jobName', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client Name <span className="text-destructive">*</span></Label>
              <ClientSelect
                mode="name"
                valueId={form.clientId}
                valueName={form.clientName}
                onSelect={({ clientId, clientName }) => setForm(f => ({ ...f, clientId, clientName }))}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Client ID</Label>
              <ClientSelect
                mode="id"
                valueId={form.clientId}
                valueName={form.clientName}
                onSelect={({ clientId, clientName }) => setForm(f => ({ ...f, clientId, clientName }))}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sales Rep</Label>
              <PersonnelSelect value={form.salesRep} onValueChange={v => set('salesRep', v)} role="sales_rep" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Estimator</Label>
              <PersonnelSelect value={form.estimator} onValueChange={v => set('estimator', v)} role="estimator" className="mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Province</Label>
              <Select value={form.province} onValueChange={v => set('province', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p.code} value={p.code}>{p.code}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">City</Label>
              <Input className="input-blue mt-1" value={form.city} onChange={e => set('city', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Postal Code</Label>
              <Input className="input-blue mt-1" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Width (ft)</Label>
              <Input className="input-blue mt-1" type="number" value={form.width} onChange={e => set('width', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Length (ft)</Label>
              <Input className="input-blue mt-1" type="number" value={form.length} onChange={e => set('length', e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Height (ft)</Label>
              <Input className="input-blue mt-1" type="number" value={form.height} onChange={e => set('height', e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create Job</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
