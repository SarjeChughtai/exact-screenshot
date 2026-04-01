import { useEffect, useMemo, useState } from 'react';
import { Edit, Plus, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { JobIdSelect } from '@/components/JobIdSelect';
import { useAppContext } from '@/context/AppContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { useSharedJobs } from '@/lib/sharedJobs';
import { supabase } from '@/integrations/supabase/client';
import { buildFreightBuildingSize, buildFreightExecutionRows, buildPreSaleFreightRows } from '@/lib/freightWorkflow';
import type { FreightRecord, FreightStatus, Quote } from '@/types';

type FreightMode = 'pre_sale' | 'execution';

interface FreightFormState {
  jobId: string;
  mode: FreightMode;
  carrier: string;
  status: FreightStatus;
  pickupDate: string;
  deliveryDate: string;
  dropOffLocation: string;
  estDistance: string;
  estFreight: string;
  actualFreight: string;
  paid: boolean;
  assignToCurrentUser: boolean;
}

const EMPTY_FORM: FreightFormState = {
  jobId: '',
  mode: 'pre_sale',
  carrier: '',
  status: 'Pending',
  pickupDate: '',
  deliveryDate: '',
  dropOffLocation: '',
  estDistance: '',
  estFreight: '',
  actualFreight: '',
  paid: false,
  assignToCurrentUser: false,
};

const FREIGHT_STATUS_OPTIONS: FreightStatus[] = ['Pending', 'Booked', 'In Transit', 'Delivered'];

export default function FreightBoard() {
  const {
    deals,
    quotes,
    freight,
    dealMilestones,
    internalCosts,
    payments,
    addFreight,
    updateFreight,
  } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { profile } = useSettings();
  const { visibleJobIds: executionVisibleJobIds } = useSharedJobs({ allowedStates: ['deal'] });
  const { visibleJobs: postableJobs } = useSharedJobs({ allowedStates: ['external_quote', 'deal'] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FreightFormState>(EMPTY_FORM);
  const [assigneeNames, setAssigneeNames] = useState<Record<string, string>>({});

  const isRestrictedFreightUser = hasAnyRole('freight') && !hasAnyRole('admin', 'owner', 'operations') && !profile.canViewAllFreightBoard;
  const canManageAllFreight = hasAnyRole('admin', 'owner', 'operations');
  const canCreateFreight = canManageAllFreight;

  const freightByJobId = useMemo(
    () => freight.reduce<Record<string, FreightRecord>>((accumulator, record) => {
      accumulator[record.jobId] = record;
      return accumulator;
    }, {}),
    [freight],
  );

  const quoteByJobId = useMemo(
    () => quotes.reduce<Record<string, Quote>>((accumulator, quote) => {
      if (!quote.jobId || quote.isDeleted) return accumulator;
      const existing = accumulator[quote.jobId];
      if (!existing || new Date(quote.date).getTime() > new Date(existing.date).getTime()) {
        accumulator[quote.jobId] = quote;
      }
      return accumulator;
    }, {}),
    [quotes],
  );

  const jobSourceById = useMemo(() => {
    return postableJobs.reduce<Record<string, {
      jobId: string;
      state: 'external_quote' | 'deal';
      clientName: string;
      province: string;
      city: string;
      address: string;
      postalCode: string;
      width: number;
      length: number;
      height: number;
      weight: number;
      opportunityId?: string | null;
      dealExists: boolean;
    }>>((accumulator, job) => {
      const deal = deals.find(item => item.jobId === job.jobId);
      const quote = quoteByJobId[job.jobId];

      accumulator[job.jobId] = {
        jobId: job.jobId,
        state: job.state === 'deal' ? 'deal' : 'external_quote',
        clientName: deal?.clientName || quote?.clientName || job.clientName || '',
        province: deal?.province || quote?.province || '',
        city: deal?.city || quote?.city || '',
        address: deal?.address || quote?.address || '',
        postalCode: deal?.postalCode || quote?.postalCode || '',
        width: deal?.width || quote?.width || 0,
        length: deal?.length || quote?.length || 0,
        height: deal?.height || quote?.height || 0,
        weight: deal?.weight || quote?.weight || 0,
        opportunityId: deal?.opportunityId || quote?.opportunityId || null,
        dealExists: Boolean(deal),
      };

      return accumulator;
    }, {});
  }, [deals, postableJobs, quoteByJobId]);

  const executionRows = useMemo(() => {
    return buildFreightExecutionRows({
      deals,
      freight,
      dealMilestones,
      internalCosts,
      payments,
      visibleJobIds: executionVisibleJobIds,
    }).filter(row => {
      if (!isRestrictedFreightUser) return true;
      return row.assignedFreightUserId === currentUser.id;
    });
  }, [currentUser.id, dealMilestones, deals, executionVisibleJobIds, freight, internalCosts, isRestrictedFreightUser, payments]);

  const preSaleRows = useMemo(() => {
    return buildPreSaleFreightRows({
      freight,
      quotes,
      visibleJobIds: canManageAllFreight ? undefined : executionVisibleJobIds,
    }).filter(row => {
      if (!isRestrictedFreightUser) return true;
      return row.assignedFreightUserId === currentUser.id;
    });
  }, [canManageAllFreight, currentUser.id, executionVisibleJobIds, freight, isRestrictedFreightUser, quotes]);

  useEffect(() => {
    const assignedIds = Array.from(new Set([
      ...executionRows.map(row => row.assignedFreightUserId).filter(Boolean),
      ...preSaleRows.map(row => row.assignedFreightUserId).filter(Boolean),
    ]));

    if (assignedIds.length === 0) {
      setAssigneeNames({});
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await (supabase.rpc as any)('get_user_directory', { user_ids: assignedIds });
      if (cancelled || error) return;
      const nextNames = (data || []).reduce<Record<string, string>>((accumulator: Record<string, string>, entry: any) => {
        accumulator[entry.id] = entry.display_name || entry.email || entry.id;
        return accumulator;
      }, {});
      setAssigneeNames(nextNames);
    })();

    return () => {
      cancelled = true;
    };
  }, [executionRows, preSaleRows]);

  const getAssigneeLabel = (assignedFreightUserId?: string | null) => {
    if (!assignedFreightUserId) return 'Unassigned';
    if (assignedFreightUserId === currentUser.id) return 'Assigned to you';
    return assigneeNames[assignedFreightUserId] || 'Assigned';
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingJobId(null);
    setForm(EMPTY_FORM);
  };

  const openCreateDialog = (mode: FreightMode) => {
    setEditingJobId(null);
    setForm({
      ...EMPTY_FORM,
      mode,
      assignToCurrentUser: hasAnyRole('freight') || mode === 'execution',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (record: FreightRecord) => {
    setEditingJobId(record.jobId);
    setForm({
      jobId: record.jobId,
      mode: record.mode || 'execution',
      carrier: record.carrier || '',
      status: record.status || 'Pending',
      pickupDate: record.pickupDate || '',
      deliveryDate: record.deliveryDate || '',
      dropOffLocation: record.dropOffLocation || record.deliveryAddress || '',
      estDistance: String(record.estDistance || ''),
      estFreight: String(record.estFreight || ''),
      actualFreight: String(record.actualFreight || ''),
      paid: record.paid || false,
      assignToCurrentUser: record.assignedFreightUserId === currentUser.id,
    });
    setDialogOpen(true);
  };

  const handleJobChange = (jobId: string) => {
    const source = jobSourceById[jobId];
    const existing = freightByJobId[jobId];

    setForm(current => ({
      ...current,
      jobId,
      dropOffLocation: existing?.dropOffLocation || existing?.deliveryAddress || [source?.address, source?.city, source?.province, source?.postalCode].filter(Boolean).join(', '),
      estFreight: existing?.estFreight ? String(existing.estFreight) : current.estFreight,
      estDistance: existing?.estDistance ? String(existing.estDistance) : current.estDistance,
      actualFreight: existing?.actualFreight ? String(existing.actualFreight) : current.actualFreight,
      carrier: existing?.carrier || current.carrier,
      pickupDate: existing?.pickupDate || current.pickupDate,
      deliveryDate: existing?.deliveryDate || current.deliveryDate,
      status: existing?.status || current.status,
      paid: existing?.paid || current.paid,
      assignToCurrentUser: existing ? existing.assignedFreightUserId === currentUser.id : current.assignToCurrentUser,
    }));
  };

  const handleSaveFreight = async () => {
    if (!form.jobId) {
      toast.error('Job ID is required.');
      return;
    }

    const source = jobSourceById[form.jobId];
    const existing = freightByJobId[form.jobId];

    if (form.mode === 'execution' && !source?.dealExists) {
      toast.error('Execution freight can only be posted for deal-stage jobs.');
      return;
    }

    if (!source && !existing) {
      toast.error('Could not resolve the selected job.');
      return;
    }

    const resolvedLocation = [source?.address, source?.city, source?.province, source?.postalCode]
      .filter(Boolean)
      .join(', ');

    const nextRecord: FreightRecord = {
      jobId: form.jobId,
      clientName: source?.clientName || existing?.clientName || '',
      buildingSize: existing?.buildingSize || buildFreightBuildingSize({
        width: source?.width,
        length: source?.length,
        height: source?.height,
      }),
      opportunityId: source?.opportunityId || existing?.opportunityId || null,
      province: source?.province || existing?.province || '',
      weight: source?.weight || existing?.weight || 0,
      pickupAddress: existing?.pickupAddress || '',
      deliveryAddress: existing?.deliveryAddress || resolvedLocation,
      dropOffLocation: form.dropOffLocation || resolvedLocation,
      pickupDate: form.pickupDate,
      deliveryDate: form.deliveryDate,
      mode: form.mode,
      estDistance: Number(form.estDistance) || 0,
      estFreight: Number(form.estFreight) || 0,
      actualFreight: Number(form.actualFreight) || 0,
      paid: form.paid,
      carrier: form.carrier,
      assignedFreightUserId: form.assignToCurrentUser ? currentUser.id : existing?.assignedFreightUserId || null,
      status: form.status,
    };

    if (existing) {
      await updateFreight(form.jobId, nextRecord);
      toast.success('Freight record updated.');
    } else {
      await addFreight(nextRecord);
      toast.success(form.mode === 'pre_sale' ? 'Pre-sale freight estimate posted.' : 'Execution freight record created.');
    }

    resetDialog();
  };

  const sourcePreview = form.jobId ? jobSourceById[form.jobId] : null;
  const canEditRecord = (assignedFreightUserId?: string | null) => canManageAllFreight || assignedFreightUserId === currentUser.id;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="h-6 w-6" />
            Freight Board
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Execution freight is tracked from deal-stage jobs. Pre-sale estimates stay separate until the job converts.
          </p>
        </div>
        {canCreateFreight && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openCreateDialog('pre_sale')}>
              <Plus className="h-4 w-4 mr-2" />
              Pre-Sale Estimate
            </Button>
            <Button onClick={() => openCreateDialog('execution')}>
              <Plus className="h-4 w-4 mr-2" />
              Execution Freight
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Execution Jobs</p>
          <p className="mt-2 text-2xl font-semibold">{executionRows.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Deal-stage freight rows visible to this user.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Pre-Sale Estimates</p>
          <p className="mt-2 text-2xl font-semibold">{preSaleRows.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Manual freight estimates attached before conversion to a deal.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ready For Freight</p>
          <p className="mt-2 text-2xl font-semibold">{executionRows.filter(row => row.freightReady).length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Derived from required post-sale milestone completion.</p>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Pre-Sale Freight Estimates</h3>
          <p className="text-xs text-muted-foreground">
            Use this for commercial freight estimating before a job is officially won. These rows do not enter execution readiness.
          </p>
        </div>
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground text-xs">
                {['Job ID', 'Client', 'Building', 'Province', 'Est Distance', 'Est Freight', 'Pickup', 'Delivery', 'Drop-Off', 'Assigned', 'Status', 'Actions'].map(header => (
                  <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preSaleRows.length === 0 ? (
                <tr><td colSpan={12} className="px-3 py-8 text-center text-muted-foreground">No pre-sale freight estimates.</td></tr>
              ) : preSaleRows.map(row => (
                <tr key={`pre-sale-${row.jobId}`} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{row.jobId}</td>
                  <td className="px-3 py-2">{row.clientName}</td>
                  <td className="px-3 py-2 text-xs">{row.buildingSize || '-'}</td>
                  <td className="px-3 py-2 text-xs">{row.province || '-'}</td>
                  <td className="px-3 py-2 font-mono">{row.estDistance ? `${formatNumber(row.estDistance)} km` : '-'}</td>
                  <td className="px-3 py-2 font-mono">{row.estFreight ? formatCurrency(row.estFreight) : '-'}</td>
                  <td className="px-3 py-2 text-xs">{row.pickupDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{row.deliveryDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{row.dropOffLocation || '-'}</td>
                  <td className="px-3 py-2 text-xs">{getAssigneeLabel(row.assignedFreightUserId)}</td>
                  <td className="px-3 py-2 text-xs">{row.status}</td>
                  <td className="px-3 py-2">
                    {canEditRecord(row.assignedFreightUserId) && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openEditDialog(freightByJobId[row.jobId])}>
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Execution Freight</h3>
          <p className="text-xs text-muted-foreground">
            Deal-stage freight board with pickup, delivery, destination, assignee, and milestone-derived readiness.
          </p>
        </div>
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary text-primary-foreground text-xs">
                {['Job ID', 'Client', 'Building', 'Weight', 'Province', 'Pickup', 'Delivery', 'Drop-Off', 'Assigned', 'Ready', 'Est Freight', 'Actual', 'Variance', 'Paid', 'Status', 'Actions'].map(header => (
                  <th key={header} className="px-3 py-2 text-left font-medium whitespace-nowrap">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {executionRows.length === 0 ? (
                <tr><td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">No deal-stage freight rows.</td></tr>
              ) : executionRows.map(row => (
                <tr key={row.jobId} className="border-b hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-xs">{row.jobId}</td>
                  <td className="px-3 py-2">{row.clientName}</td>
                  <td className="px-3 py-2 text-xs">{row.buildingSize}</td>
                  <td className="px-3 py-2 font-mono">{formatNumber(row.weight)} lbs</td>
                  <td className="px-3 py-2 text-xs">{row.province}</td>
                  <td className="px-3 py-2 text-xs">{row.pickupDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{row.deliveryDate || '-'}</td>
                  <td className="px-3 py-2 text-xs">{row.dropOffLocation || '-'}</td>
                  <td className="px-3 py-2 text-xs">{getAssigneeLabel(row.assignedFreightUserId)}</td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.freightReady ? 'status-paid' : 'status-partial'}`}>
                      {row.freightReady ? 'Ready' : 'Blocked'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono">{formatCurrency(row.estFreight)}</td>
                  <td className="px-3 py-2 font-mono">{row.actualFreight ? formatCurrency(row.actualFreight) : '-'}</td>
                  <td className={`px-3 py-2 font-mono ${row.variance > 0 ? 'text-destructive' : row.variance < 0 ? 'text-success' : ''}`}>
                    {row.actualFreight ? formatCurrency(row.variance) : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${row.paid ? 'status-paid' : 'status-unpaid'}`}>{row.paid ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-3 py-2 text-xs">{row.status}</td>
                  <td className="px-3 py-2">
                    {canEditRecord(row.assignedFreightUserId) && (
                      <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => openEditDialog(freightByJobId[row.jobId] || {
                        jobId: row.jobId,
                        clientName: row.clientName,
                        buildingSize: row.buildingSize,
                        province: row.province,
                        weight: row.weight,
                        pickupAddress: '',
                        deliveryAddress: row.dropOffLocation,
                        dropOffLocation: row.dropOffLocation,
                        pickupDate: row.pickupDate,
                        deliveryDate: row.deliveryDate,
                        mode: 'execution',
                        estDistance: 0,
                        estFreight: row.estFreight,
                        actualFreight: row.actualFreight,
                        paid: row.paid,
                        carrier: row.carrier,
                        assignedFreightUserId: row.assignedFreightUserId,
                        status: row.status,
                      })}>
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : resetDialog())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingJobId ? 'Update Freight Record' : 'Create Freight Record'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Mode</Label>
              <Select
                value={form.mode}
                onValueChange={(value: FreightMode) => setForm(current => ({ ...current, mode: value }))}
                disabled={Boolean(editingJobId)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pre_sale">Pre-Sale Estimate</SelectItem>
                  <SelectItem value="execution">Execution Freight</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Job ID</Label>
              <JobIdSelect
                value={form.jobId}
                onValueChange={handleJobChange}
                allowedStates={form.mode === 'execution' ? ['deal'] : ['external_quote', 'deal']}
                includeCreateNew={false}
                placeholder="Select job..."
                searchPlaceholder="Search job, client, or state..."
                triggerClassName="w-full justify-between font-normal"
              />
            </div>
            {sourcePreview && (
              <div className="md:col-span-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                <p className="font-medium">{sourcePreview.clientName || 'Unassigned client'}</p>
                <p className="text-muted-foreground">
                  {buildFreightBuildingSize(sourcePreview)} | {sourcePreview.city}, {sourcePreview.province} | {formatNumber(sourcePreview.weight)} lbs
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Carrier</Label>
              <Input value={form.carrier} onChange={event => setForm(current => ({ ...current, carrier: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(value: FreightStatus) => setForm(current => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREIGHT_STATUS_OPTIONS.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pickup Date</Label>
              <Input type="date" value={form.pickupDate} onChange={event => setForm(current => ({ ...current, pickupDate: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Delivery Date</Label>
              <Input type="date" value={form.deliveryDate} onChange={event => setForm(current => ({ ...current, deliveryDate: event.target.value }))} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Drop-Off Location</Label>
              <Input value={form.dropOffLocation} onChange={event => setForm(current => ({ ...current, dropOffLocation: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Estimated Distance (km)</Label>
              <Input value={form.estDistance} onChange={event => setForm(current => ({ ...current, estDistance: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Estimated Freight</Label>
              <Input value={form.estFreight} onChange={event => setForm(current => ({ ...current, estFreight: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Actual Freight</Label>
              <Input value={form.actualFreight} onChange={event => setForm(current => ({ ...current, actualFreight: event.target.value }))} />
            </div>
            <div className="flex items-center gap-3 pt-7">
              <Checkbox
                checked={form.paid}
                onCheckedChange={checked => setForm(current => ({ ...current, paid: checked === true }))}
              />
              <Label>Freight vendor has been paid</Label>
            </div>
            <div className="flex items-center gap-3 pt-7 md:col-span-2">
              <Checkbox
                checked={form.assignToCurrentUser}
                onCheckedChange={checked => setForm(current => ({ ...current, assignToCurrentUser: checked === true }))}
              />
              <Label>Assign this freight record to me</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Cancel</Button>
            <Button onClick={() => void handleSaveFreight()}>
              {editingJobId ? 'Save Changes' : 'Create Freight Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
