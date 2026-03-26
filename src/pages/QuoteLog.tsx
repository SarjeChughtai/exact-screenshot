import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '@/context/AppContext';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { QuoteStatus, Deal, Quote } from '@/types';
import { toast } from 'sonner';
import { getProvinceTax } from '@/lib/calculations';
import {
  FileText, Upload, Send, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Download, Mail
} from 'lucide-react';

/** All statuses available for manual change */
const ALL_STATUSES: QuoteStatus[] = [
  'Draft', 'New Request', 'Quote Requested', 'Quote Received',
  'Quote Sent', 'Internal Review', 'Follow Up', 'Won', 'Lost', 'Expired',
];

/** Human-readable labels */
const STATUS_LABELS: Record<string, string> = {
  Draft: 'Draft',
  'New Request': 'New Quote Request',
  Sent: 'Quote Requested',
  'Quote Requested': 'Quote Requested',
  'Quote Received': 'Quote Received',
  'Quote Sent': 'Quote Sent to Sales',
  'Internal Review': 'Internal Review',
  'Follow Up': 'Follow Up',
  Won: 'Won',
  Lost: 'Lost',
  Expired: 'Expired',
};

/** Color mapping per status */
const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700 border-gray-200',
  'New Request': 'bg-blue-100 text-blue-800 border-blue-200',
  Sent: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Quote Requested': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Quote Received': 'bg-amber-100 text-amber-800 border-amber-200',
  'Quote Sent': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Internal Review': 'bg-purple-100 text-purple-800 border-purple-200',
  'Follow Up': 'bg-orange-100 text-orange-700 border-orange-200',
  Won: 'bg-green-100 text-green-800 border-green-200',
  Lost: 'bg-red-100 text-red-700 border-red-200',
  Expired: 'bg-gray-100 text-gray-500 border-gray-200',
};

/** Workflow sections for Ops view */
const WORKFLOW_SECTIONS = [
  { key: 'new', label: 'New Quote Requests', statuses: ['New Request', 'Draft'], icon: AlertTriangle, color: 'text-blue-600' },
  { key: 'requested', label: 'Quote Requested (Sent to Estimator)', statuses: ['Sent', 'Quote Requested'], icon: Send, color: 'text-indigo-600' },
  { key: 'received', label: 'Quote Received (From Estimator)', statuses: ['Quote Received'], icon: Download, color: 'text-amber-600' },
  { key: 'sent', label: 'Quote Sent to Sales', statuses: ['Quote Sent', 'Internal Review'], icon: Mail, color: 'text-emerald-600' },
  { key: 'active', label: 'Active / Follow Up', statuses: ['Follow Up'], icon: Clock, color: 'text-orange-600' },
  { key: 'completed', label: 'Completed', statuses: ['Won', 'Lost', 'Expired'], icon: CheckCircle2, color: 'text-gray-500' },
];

export default function QuoteLog() {
  const navigate = useNavigate();
  const { quotes, updateQuote, addDeal, updateDeal, deals } = useAppContext();
  const { currentUser, hasAnyRole } = useRoles();
  const { settings, getEstimators } = useSettings();

  const isEstimator = hasAnyRole('estimator') && !hasAnyRole('admin', 'owner', 'operations');
  const isOps = hasAnyRole('admin', 'owner', 'operations');
  const isSalesOnly = hasAnyRole('sales_rep') && !hasAnyRole('admin', 'owner', 'operations', 'estimator');

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    new: true, requested: true, received: true, sent: true, active: true, completed: false,
  });
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [assignDialog, setAssignDialog] = useState<{ quoteId: string; open: boolean }>({ quoteId: '', open: false });
  const [assignEstimator, setAssignEstimator] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const estimators = getEstimators();

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  /** Normalize legacy 'Sent' status to 'Quote Requested' for display */
  const normalizeStatus = (status: string): string => {
    if (status === 'Sent') return 'Quote Requested';
    return status;
  };

  const filteredQuotes = useMemo(() => {
    let qs = [...quotes];

    // Estimator view: only see quotes assigned to them or submitted by them
    if (isEstimator) {
      qs = qs.filter(q =>
        q.assignedEstimator === currentUser.name ||
        q.estimator === currentUser.name
      );
    }

    // Sales view: only their quotes
    if (isSalesOnly) {
      qs = qs.filter(q =>
        q.salesRep === currentUser.name ||
        q.salesRep.toLowerCase().includes(currentUser.name.toLowerCase())
      );
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      qs = qs.filter(q =>
        q.jobId.toLowerCase().includes(term) ||
        q.clientName.toLowerCase().includes(term) ||
        q.salesRep.toLowerCase().includes(term) ||
        (q.assignedEstimator || '').toLowerCase().includes(term)
      );
    }

    return qs;
  }, [quotes, isEstimator, isSalesOnly, currentUser, searchTerm]);

  const changeStatus = (id: string, status: QuoteStatus) => {
    updateQuote(id, { status });
    toast.success(`Status updated to ${STATUS_LABELS[status] || status}`);
  };

  const handleAssignEstimator = () => {
    if (!assignEstimator) {
      toast.error('Select an estimator');
      return;
    }
    updateQuote(assignDialog.quoteId, {
      assignedEstimator: assignEstimator,
      status: 'Quote Requested',
    });
    setAssignDialog({ quoteId: '', open: false });
    setAssignEstimator('');
    toast.success(`Quote assigned to ${assignEstimator} — status: Quote Requested`);
  };

  const handleEstimatorSubmit = (quoteId: string, notes: string) => {
    updateQuote(quoteId, {
      status: 'Quote Received',
      estimatorNotes: notes,
      estimatorSubmittedAt: new Date().toISOString(),
    });
    toast.success('Quote submitted back to Ops — status: Quote Received');
  };

  const convertToDeal = (q: Quote) => {
    const prov = getProvinceTax(q.province);
    const existing = deals.find(d => d.jobId === q.jobId);

    const dealData: Deal = {
      jobId: q.jobId,
      jobName: q.jobName,
      clientName: q.clientName,
      clientId: q.clientId,
      salesRep: q.salesRep,
      estimator: q.estimator,
      teamLead: '',
      province: q.province,
      city: q.city,
      address: q.address,
      postalCode: q.postalCode,
      width: q.width,
      length: q.length,
      height: q.height,
      sqft: q.sqft,
      weight: q.weight,
      taxRate: prov.order_rate,
      taxType: prov.type,
      orderType: '',
      dateSigned: new Date().toISOString().split('T')[0],
      dealStatus: 'Quoted',
      paymentStatus: 'UNPAID',
      productionStatus: 'Submitted',
      freightStatus: 'Pending',
      insulationStatus: 'Pending',
      deliveryDate: '',
      pickupDate: '',
      notes: '',
    };

    if (existing) {
      updateDeal(q.jobId, dealData);
      toast.success(`Deal updated for ${q.jobId}`);
    } else {
      addDeal(dealData);
      toast.success(`Deal created for ${q.jobId}`);
    }
  };

  const printRfqPdf = (q: Quote) => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      `<html><head><title>RFQ - ${q.jobId}</title>` +
      `<style>body{font-family:monospace;font-size:12px;padding:20px;max-width:700px;margin:0 auto;}` +
      `.header{text-align:center;margin-bottom:16px;border-bottom:2px solid #000;padding-bottom:10px;}` +
      `.row{display:flex;justify-content:space-between;gap:10px;margin:3px 0;}.label{color:#444;}</style></head><body>`
    );
    win.document.write(`<div class="header"><h2>REQUEST FOR QUOTE — ${q.jobId}</h2><div>${q.clientName}</div><div>${q.date}</div></div>`);
    win.document.write(`<div class="row"><span class="label">Building</span><span>${q.width}' × ${q.length}' × ${q.height}' (${formatNumber(q.sqft)} sqft)</span></div>`);
    win.document.write(`<div class="row"><span class="label">Weight</span><span>${formatNumber(q.weight)} lbs</span></div>`);
    win.document.write(`<div class="row"><span class="label">Province</span><span>${q.province}</span></div>`);
    win.document.write(`<div class="row"><span class="label">City</span><span>${q.city || '—'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Sales Rep</span><span>${q.salesRep}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Foundation</span><span>${q.foundationType}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Insulation Grade</span><span>${q.insulationGrade || 'N/A'}</span></div>`);
    win.document.write(`<div class="row"><span class="label">Estimator</span><span>${q.assignedEstimator || q.estimator || '—'}</span></div>`);
    if (q.estimatorNotes) {
      win.document.write(`<br/><div><strong>Estimator Notes:</strong><br/>${q.estimatorNotes}</div>`);
    }
    win.document.write('</body></html>');
    win.document.close();
    win.print();
  };

  const openInternalQuoteBuilder = (q: Quote) => {
    navigate(`/internal-quote-builder?jobId=${encodeURIComponent(q.jobId)}`);
  };

  // Estimator-specific view
  if (isEstimator) {
    const assignedToMe = filteredQuotes.filter(q =>
      ['Quote Requested', 'Sent'].includes(q.status)
    );
    const submittedByMe = filteredQuotes.filter(q =>
      ['Quote Received', 'Quote Sent', 'Internal Review', 'Won'].includes(q.status)
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Quote Log — Estimator View</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Quotes assigned to you and your submissions
          </p>
        </div>

        <QuoteSection
          title="Assigned to Me"
          quotes={assignedToMe}
          icon={<Clock className="h-4 w-4 text-indigo-600" />}
          expandedQuote={expandedQuote}
          setExpandedQuote={setExpandedQuote}
          onStatusChange={changeStatus}
          statuses={ALL_STATUSES}
          isEstimatorView
          onEstimatorSubmit={handleEstimatorSubmit}
          onPrintPdf={printRfqPdf}
        />

        <QuoteSection
          title="My Submissions"
          quotes={submittedByMe}
          icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
          expandedQuote={expandedQuote}
          setExpandedQuote={setExpandedQuote}
          onStatusChange={changeStatus}
          statuses={ALL_STATUSES}
          onPrintPdf={printRfqPdf}
        />
      </div>
    );
  }

  // Main Ops/Admin/Sales view with workflow sections
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quote Log</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredQuotes.length} quotes total
            {isSalesOnly && ' (your quotes)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-56 h-8 text-xs"
            placeholder="Search job, client, rep..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {hasAnyRole('admin', 'owner', 'sales_rep') && (
            <Button size="sm" onClick={() => navigate('/rfq-builder')}>
              + New RFQ
            </Button>
          )}
        </div>
      </div>

      {WORKFLOW_SECTIONS.map(section => {
        const sectionQuotes = filteredQuotes.filter(q =>
          section.statuses.includes(normalizeStatus(q.status))
        );
        if (sectionQuotes.length === 0 && section.key === 'completed') return null;

        const isOpen = expandedSections[section.key] ?? true;
        const Icon = section.icon;

        return (
          <div key={section.key} className="bg-card border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              onClick={() => toggleSection(section.key)}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${section.color}`} />
                <span className="font-semibold text-sm">{section.label}</span>
                <Badge variant="secondary" className="text-xs ml-1">
                  {sectionQuotes.length}
                </Badge>
              </div>
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>

            {isOpen && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-xs">
                      {['Job ID', 'Date', 'Client', 'Sales Rep', 'Estimator', 'Dimensions', 'Sq Ft', 'Combined', '$/sqft', 'Status', 'Actions'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sectionQuotes.length === 0 ? (
                      <tr><td colSpan={11} className="px-3 py-6 text-center text-muted-foreground text-xs">No quotes in this section</td></tr>
                    ) : sectionQuotes.map(q => {
                      const isExpanded = expandedQuote === q.id;
                      return (
                        <>
                          <tr
                            key={q.id}
                            className={`border-b hover:bg-muted/50 cursor-pointer ${
                              q.status === 'Lost' || q.status === 'Expired' ? 'opacity-60' : ''
                            }`}
                            onClick={() => setExpandedQuote(isExpanded ? null : q.id)}
                          >
                            <td className="px-3 py-2 font-mono text-xs">{q.jobId}</td>
                            <td className="px-3 py-2 text-xs">{q.date}</td>
                            <td className="px-3 py-2">{q.clientName}</td>
                            <td className="px-3 py-2 text-xs">{q.salesRep}</td>
                            <td className="px-3 py-2 text-xs">{q.assignedEstimator || q.estimator || '—'}</td>
                            <td className="px-3 py-2 text-xs">{q.width}×{q.length}×{q.height}</td>
                            <td className="px-3 py-2 font-mono">{formatNumber(q.sqft)}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(q.combinedTotal)}</td>
                            <td className="px-3 py-2 font-mono">{formatCurrency(q.perSqft)}</td>
                            <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                              <Select value={normalizeStatus(q.status) as QuoteStatus} onValueChange={v => changeStatus(q.id, v as QuoteStatus)}>
                                <SelectTrigger className="h-7 text-xs w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ALL_STATUSES.map(s => (
                                    <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                              <div className="flex gap-1">
                                {/* Ops: assign estimator for new requests */}
                                {isOps && ['Draft', 'New Request'].includes(normalizeStatus(q.status)) && (
                                  <Button
                                    size="sm" variant="outline" className="text-xs h-7"
                                    onClick={() => {
                                      setAssignDialog({ quoteId: q.id, open: true });
                                      setAssignEstimator(q.assignedEstimator || '');
                                    }}
                                  >
                                    Assign
                                  </Button>
                                )}
                                {/* Ops: download RFQ PDF */}
                                <Button
                                  size="sm" variant="ghost" className="text-xs h-7"
                                  onClick={() => printRfqPdf(q)}
                                  title="Download RFQ PDF"
                                >
                                  <FileText className="h-3 w-3" />
                                </Button>
                                {/* Ops: bring received quote into Internal Quote Builder */}
                                {isOps && normalizeStatus(q.status) === 'Quote Received' && (
                                  <Button
                                    size="sm" variant="outline" className="text-xs h-7"
                                    onClick={() => openInternalQuoteBuilder(q)}
                                  >
                                    → Builder
                                  </Button>
                                )}
                                {/* Won: convert to deal */}
                                {q.status === 'Won' && (
                                  <Button
                                    size="sm" variant="outline" className="text-xs h-7"
                                    onClick={() => convertToDeal(q)}
                                  >
                                    → Deal
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${q.id}-detail`} className="bg-muted/20 border-b">
                              <td colSpan={11} className="p-4">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                  <div>
                                    <p className="font-semibold text-muted-foreground mb-1">Project</p>
                                    <p>Province: {q.province}</p>
                                    <p>City: {q.city || '—'}</p>
                                    <p>Foundation: {q.foundationType}</p>
                                    <p>Insulation: {q.insulationGrade || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-muted-foreground mb-1">Pricing</p>
                                    <p>Steel: {formatCurrency(q.steelAfter12)}</p>
                                    <p>Engineering: {formatCurrency(q.engineering)}</p>
                                    <p>Foundation: {formatCurrency(q.foundation)}</p>
                                    <p>Freight: {formatCurrency(q.freight)}</p>
                                    <p>Grand Total: {formatCurrency(q.grandTotal)}</p>
                                  </div>
                                  <div>
                                    <p className="font-semibold text-muted-foreground mb-1">Assignment</p>
                                    <p>Assigned Estimator: {q.assignedEstimator || '—'}</p>
                                    {q.costDocumentName && <p>Cost Doc: {q.costDocumentName}</p>}
                                    {q.estimatorSubmittedAt && (
                                      <p>Submitted: {new Date(q.estimatorSubmittedAt).toLocaleDateString()}</p>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-muted-foreground mb-1">Estimator Notes</p>
                                    <p className="whitespace-pre-wrap">{q.estimatorNotes || 'None'}</p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Assign Estimator Dialog */}
      <Dialog open={assignDialog.open} onOpenChange={open => setAssignDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Estimator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Estimator</Label>
              {estimators.length > 0 ? (
                <Select value={assignEstimator} onValueChange={setAssignEstimator}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select estimator..." /></SelectTrigger>
                  <SelectContent>
                    {estimators.map(e => (
                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="mt-1"
                  value={assignEstimator}
                  onChange={e => setAssignEstimator(e.target.value)}
                  placeholder="Type estimator name..."
                />
              )}
              {estimators.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Add estimators in Settings → Personnel to use the dropdown.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ quoteId: '', open: false })}>Cancel</Button>
            <Button onClick={handleAssignEstimator}>Assign & Send to Estimator</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Reusable section for estimator view */
function QuoteSection({
  title, quotes, icon, expandedQuote, setExpandedQuote,
  onStatusChange, statuses, isEstimatorView, onEstimatorSubmit, onPrintPdf,
}: {
  title: string;
  quotes: Quote[];
  icon: React.ReactNode;
  expandedQuote: string | null;
  setExpandedQuote: (id: string | null) => void;
  onStatusChange: (id: string, status: QuoteStatus) => void;
  statuses: QuoteStatus[];
  isEstimatorView?: boolean;
  onEstimatorSubmit?: (quoteId: string, notes: string) => void;
  onPrintPdf?: (q: Quote) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="text-xs ml-1">{quotes.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-xs">
              {['Job ID', 'Date', 'Client', 'Building', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground text-xs">No quotes here</td></tr>
            ) : quotes.map(q => {
              const isExp = expandedQuote === q.id;
              return (
                <>
                  <tr
                    key={q.id}
                    className="border-b hover:bg-muted/50 cursor-pointer"
                    onClick={() => setExpandedQuote(isExp ? null : q.id)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{q.jobId}</td>
                    <td className="px-3 py-2 text-xs">{q.date}</td>
                    <td className="px-3 py-2">{q.clientName}</td>
                    <td className="px-3 py-2 text-xs">{q.width}×{q.length}×{q.height} ({formatNumber(q.sqft)} sqft)</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[q.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[q.status] || q.status}
                      </span>
                    </td>
                    <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {onPrintPdf && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onPrintPdf(q)}>
                            <FileText className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExp && (
                    <tr key={`${q.id}-detail`} className="bg-muted/20 border-b">
                      <td colSpan={6} className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Building Details</p>
                            <p>Province: {q.province} | City: {q.city || '—'}</p>
                            <p>Dimensions: {q.width}×{q.length}×{q.height}</p>
                            <p>Weight: {formatNumber(q.weight)} lbs</p>
                            <p>Foundation: {q.foundationType}</p>
                            <p>Insulation: {q.insulationGrade || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-muted-foreground mb-1">Pricing</p>
                            <p>Combined Total: {formatCurrency(q.combinedTotal)}</p>
                            <p>$/sqft: {formatCurrency(q.perSqft)}</p>
                            <p>Grand Total: {formatCurrency(q.grandTotal)}</p>
                          </div>
                        </div>

                        {/* Estimator submit form */}
                        {isEstimatorView && onEstimatorSubmit && ['Quote Requested', 'Sent'].includes(q.status) && (
                          <div className="mt-4 space-y-2 bg-card border rounded-lg p-3">
                            <Label className="text-xs font-semibold">Submit Quote Back to Ops</Label>
                            <Textarea
                              className="text-xs"
                              placeholder="Add your notes, cost summary, or attach reference..."
                              value={notes[q.id] || ''}
                              onChange={e => setNotes(prev => ({ ...prev, [q.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                onEstimatorSubmit(q.id, notes[q.id] || '');
                                setNotes(prev => ({ ...prev, [q.id]: '' }));
                              }}
                            >
                              <Upload className="h-3 w-3 mr-1" /> Submit to Ops
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
