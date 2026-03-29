import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { Vendor } from '@/types';
import { toast } from 'sonner';
import { Pencil, Trash2, Plus } from 'lucide-react';

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
const BLANK_FORM = { name: '', province: 'ON', contactEmail: '', contactPhone: '', notes: '' };

export default function Vendors() {
  const { vendors, addVendor, updateVendor, deleteVendor } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);

  // Edit state
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [editAuditNote, setEditAuditNote] = useState('');
  const [pendingEditSave, setPendingEditSave] = useState(false);

  // Delete state
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteAuditNote, setDeleteAuditNote] = useState('');

  // Sort
  type SortCol = 'name' | 'province' | 'contactEmail' | 'contactPhone';
  const [sortCol, setSortCol] = useState<SortCol>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEdit = (k: string, v: string) => setEditForm(f => ({ ...f, [k]: v }));

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sorted = [...vendors].sort((a, b) => {
    const av = a[sortCol] ?? '';
    const bv = b[sortCol] ?? '';
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const save = () => {
    if (!form.name.trim()) { toast.error('Vendor name is required'); return; }
    const vendor: Vendor = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      province: form.province,
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      notes: form.notes.trim(),
      createdAt: new Date().toISOString(),
    };
    addVendor(vendor);
    setForm(BLANK_FORM);
    setShowForm(false);
    toast.success('Vendor added');
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setEditForm({ name: v.name, province: v.province, contactEmail: v.contactEmail, contactPhone: v.contactPhone, notes: v.notes });
    setEditAuditNote('');
    setPendingEditSave(false);
  };

  const requestSaveEdit = () => {
    if (!editForm.name.trim()) { toast.error('Vendor name is required'); return; }
    setPendingEditSave(true);
  };

  const confirmSaveEdit = () => {
    if (!editingVendor) return;
    if (!editAuditNote.trim()) { toast.error('Audit note is required for changes'); return; }
    updateVendor(editingVendor.id, {
      name: editForm.name.trim(),
      province: editForm.province,
      contactEmail: editForm.contactEmail.trim(),
      contactPhone: editForm.contactPhone.trim(),
      notes: editForm.notes.trim() + (editAuditNote ? `\n[Change note: ${editAuditNote}]` : ''),
    });
    setEditingVendor(null);
    setPendingEditSave(false);
    toast.success('Vendor updated');
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    if (!deleteAuditNote.trim()) { toast.error('Audit note is required for deletion'); return; }
    deleteVendor(pendingDeleteId);
    setPendingDeleteId(null);
    setDeleteAuditNote('');
    toast.success('Vendor deleted');
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendors</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage vendor records with province-based tax rules</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" />{showForm ? 'Cancel' : 'Add Vendor'}
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border rounded-lg p-5 space-y-4">
          <h3 className="font-semibold text-sm">New Vendor</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><Label className="text-xs">Name *</Label><Input className="input-blue mt-1" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div>
              <Label className="text-xs">Province *</Label>
              <Select value={form.province} onValueChange={v => set('province', v)}>
                <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Email</Label><Input className="input-blue mt-1" type="email" value={form.contactEmail} onChange={e => set('contactEmail', e.target.value)} /></div>
            <div><Label className="text-xs">Phone</Label><Input className="input-blue mt-1" value={form.contactPhone} onChange={e => set('contactPhone', e.target.value)} /></div>
            <div className="col-span-2 md:col-span-4"><Label className="text-xs">Notes</Label><Input className="input-blue mt-1" value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
          </div>
          <Button onClick={save}>Save Vendor</Button>
        </div>
      )}

      <div className="bg-card border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-primary text-primary-foreground text-xs">
              {([['name', 'Name'], ['province', 'Province'], ['contactEmail', 'Email'], ['contactPhone', 'Phone']] as [SortCol, string][]).map(([col, label]) => (
                <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap cursor-pointer select-none" onClick={() => handleSort(col)}>
                  {label}<SortIcon col={col} />
                </th>
              ))}
              <th className="px-3 py-2 text-left font-medium">Notes</th>
              <th className="px-3 py-2 text-left font-medium">Added</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No vendors yet</td></tr>
            ) : sorted.map(v => (
              <tr key={v.id} className="border-b hover:bg-muted/50">
                <td className="px-3 py-2 font-medium">{v.name}</td>
                <td className="px-3 py-2 text-xs"><span className="bg-muted rounded px-1.5 py-0.5">{v.province}</span></td>
                <td className="px-3 py-2 text-xs">{v.contactEmail || '—'}</td>
                <td className="px-3 py-2 text-xs">{v.contactPhone || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">{v.notes || '—'}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{v.createdAt ? v.createdAt.split('T')[0] : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(v)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => { setPendingDeleteId(v.id); setDeleteAuditNote(''); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingVendor} onOpenChange={open => { if (!open) { setEditingVendor(null); setPendingEditSave(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Vendor</DialogTitle></DialogHeader>
          {editingVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Name *</Label><Input className="input-blue mt-1" value={editForm.name} onChange={e => setEdit('name', e.target.value)} /></div>
                <div>
                  <Label className="text-xs">Province *</Label>
                  <Select value={editForm.province} onValueChange={v => setEdit('province', v)}>
                    <SelectTrigger className="input-blue mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>{PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Email</Label><Input className="input-blue mt-1" type="email" value={editForm.contactEmail} onChange={e => setEdit('contactEmail', e.target.value)} /></div>
                <div><Label className="text-xs">Phone</Label><Input className="input-blue mt-1" value={editForm.contactPhone} onChange={e => setEdit('contactPhone', e.target.value)} /></div>
                <div className="col-span-2"><Label className="text-xs">Notes</Label><Input className="input-blue mt-1" value={editForm.notes} onChange={e => setEdit('notes', e.target.value)} /></div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={requestSaveEdit}>Save Changes</Button>
                <Button variant="outline" onClick={() => { setEditingVendor(null); setPendingEditSave(false); }}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Confirmation with Audit Note */}
      <AlertDialog open={pendingEditSave} onOpenChange={open => { if (!open) setPendingEditSave(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Vendor Edit</AlertDialogTitle>
            <AlertDialogDescription>Please provide a reason for this change (required for audit trail).</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="mt-2"
            placeholder="Reason for change..."
            value={editAuditNote}
            onChange={e => setEditAuditNote(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingEditSave(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveEdit}>Confirm & Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation with Audit Note */}
      <AlertDialog open={!!pendingDeleteId} onOpenChange={open => { if (!open) { setPendingDeleteId(null); setDeleteAuditNote(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vendor</AlertDialogTitle>
            <AlertDialogDescription>This will remove the vendor record. Please provide a reason for deletion.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            className="mt-2"
            placeholder="Reason for deletion..."
            value={deleteAuditNote}
            onChange={e => setDeleteAuditNote(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className={buttonVariants({ variant: 'destructive' })} onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
