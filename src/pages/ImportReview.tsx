import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { saveSteelCostEntry } from '@/lib/quoteFileStorage';
import { quoteFileFromRow } from '@/lib/supabaseMappers';
import { formatCurrency, formatNumber } from '@/lib/calculations';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, AlertTriangle, Pencil, Download, ChevronDown, ChevronUp, Clock, FileText } from 'lucide-react';
import type { QuoteFileRecord, ImportReviewStatus } from '@/types';

const STATUS_OPTIONS: { value: ImportReviewStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'rejected', label: 'Rejected' },
];

const STATUS_BADGE: Record<ImportReviewStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' },
  needs_review: { bg: 'bg-red-100', text: 'text-red-800', label: 'Needs Review' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  corrected: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Corrected' },
  rejected: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Rejected' },
};

const SOURCE_BADGE: Record<string, { bg: string; text: string }> = {
  ai: { bg: 'bg-purple-100', text: 'text-purple-800' },
  regex: { bg: 'bg-cyan-100', text: 'text-cyan-800' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

interface EditFormState {
  weightLbs: string;
  costPerLb: string;
  totalCost: string;
  width: string;
  length: string;
  height: string;
  roofPitch: string;
  province: string;
  city: string;
  insulationTotal: string;
  insulationGrade: string;
}

export default function ImportReview() {
  const [files, setFiles] = useState<(QuoteFileRecord & { steelCostEntries?: any[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ImportReviewStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<QuoteFileRecord | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    weightLbs: '0', costPerLb: '0', totalCost: '0',
    width: '', length: '', height: '', roofPitch: '',
    province: '', city: '', insulationTotal: '0', insulationGrade: '',
  });

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('quote_files')
      .select('*, steel_cost_entries(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching import files:', error);
      toast.error('Failed to load import data');
      setLoading(false);
      return;
    }

    const mapped = (data || []).map((row: any) => ({
      ...quoteFileFromRow(row),
      steelCostEntries: row.steel_cost_entries || [],
    }));
    setFiles(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  const filtered = files.filter(f => {
    if (statusFilter !== 'all' && f.reviewStatus !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return f.fileName.toLowerCase().includes(q) ||
        f.jobId.toLowerCase().includes(q) ||
        f.clientName.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    total: files.length,
    pending: files.filter(f => f.reviewStatus === 'pending').length,
    needsReview: files.filter(f => f.reviewStatus === 'needs_review').length,
    approved: files.filter(f => f.reviewStatus === 'approved').length,
  };

  const updateReviewStatus = async (id: string, status: ImportReviewStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('quote_files')
      .update({
        review_status: status,
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update status');
      return;
    }
    toast.success(`Status updated to ${STATUS_BADGE[status].label}`);
    fetchFiles();
  };

  const openEditDialog = (file: QuoteFileRecord) => {
    const ai = (file.correctedData || file.aiOutput || {}) as any;
    setEditForm({
      weightLbs: String(ai.weight || ai.weight_lbs || 0),
      costPerLb: String(ai.cost_per_lb || 0),
      totalCost: String(ai.total_cost || 0),
      width: String(ai.width || ''),
      length: String(ai.length || ''),
      height: String(ai.height || ''),
      roofPitch: String(ai.roof_pitch || ''),
      province: ai.province || '',
      city: ai.city || '',
      insulationTotal: String(ai.insulation_total || 0),
      insulationGrade: ai.insulation_grade || '',
    });
    setEditingFile(file);
  };

  const saveCorrection = async () => {
    if (!editingFile) return;
    const { data: { user } } = await supabase.auth.getUser();

    const correctedData = {
      weight: parseFloat(editForm.weightLbs) || 0,
      cost_per_lb: parseFloat(editForm.costPerLb) || 0,
      total_cost: parseFloat(editForm.totalCost) || 0,
      width: editForm.width ? parseFloat(editForm.width) : null,
      length: editForm.length ? parseFloat(editForm.length) : null,
      height: editForm.height ? parseFloat(editForm.height) : null,
      roof_pitch: editForm.roofPitch ? parseFloat(editForm.roofPitch) : null,
      province: editForm.province || null,
      city: editForm.city || null,
      insulation_total: parseFloat(editForm.insulationTotal) || 0,
      insulation_grade: editForm.insulationGrade || null,
    };

    // Update quote_files with corrected data
    const { error: updateError } = await supabase
      .from('quote_files')
      .update({
        corrected_data: correctedData,
        review_status: 'corrected',
        reviewed_by: user?.id || null,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq('id', editingFile.id);

    if (updateError) {
      toast.error('Failed to save correction');
      return;
    }

    // Create/update steel_cost_entries row with corrected values
    const docType = editingFile.fileType === 'insulation' ? 'insulation' : 'mbs';
    await saveSteelCostEntry({
      quoteFileId: editingFile.id,
      jobId: editingFile.jobId,
      clientName: editingFile.clientName,
      clientId: editingFile.clientId,
      buildingLabel: editingFile.buildingLabel || 'Building 1',
      documentType: docType,
      fileName: editingFile.fileName,
      weightLbs: correctedData.weight,
      costPerLb: correctedData.cost_per_lb,
      totalCost: correctedData.total_cost,
      width: correctedData.width || undefined,
      length: correctedData.length || undefined,
      height: correctedData.height || undefined,
      roofPitch: correctedData.roof_pitch || undefined,
      province: correctedData.province || undefined,
      city: correctedData.city || undefined,
      insulationTotal: correctedData.insulation_total,
      insulationGrade: correctedData.insulation_grade || undefined,
      extractionSource: 'regex',
      aiRawOutput: editingFile.aiOutput,
    });

    toast.success('Correction saved and data entry created');
    setEditingFile(null);
    fetchFiles();
  };

  const downloadFile = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('quote-files')
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      toast.error('Could not generate download link');
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('en-CA');
  };

  const renderAIOutput = (output: any) => {
    if (!output) return <span className="text-muted-foreground text-sm">No AI output stored</span>;
    try {
      const json = typeof output === 'string' ? JSON.parse(output) : output;
      return (
        <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64 whitespace-pre-wrap">
          {JSON.stringify(json, null, 2)}
        </pre>
      );
    } catch {
      return <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-64">{String(output)}</pre>;
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Loading import data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Imports</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Pending Review</div>
          <div className="text-2xl font-bold text-amber-600">{counts.pending}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Needs Review</div>
          <div className="text-2xl font-bold text-red-600">{counts.needsReview}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Approved</div>
          <div className="text-2xl font-bold text-green-600">{counts.approved}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="w-48">
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Search by file name, job ID, or client..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={fetchFiles}>Refresh</Button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="mx-auto h-12 w-12 mb-3 opacity-40" />
          <p>No imports found{statusFilter !== 'all' ? ` with status "${STATUS_BADGE[statusFilter as ImportReviewStatus]?.label}"` : ''}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">File</th>
                <th className="text-left p-3 font-medium">Job ID</th>
                <th className="text-left p-3 font-medium">Client</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Source</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(file => {
                const isExpanded = expandedId === file.id;
                const badge = STATUS_BADGE[file.reviewStatus] || STATUS_BADGE.pending;
                const srcBadge = SOURCE_BADGE[file.extractionSource] || SOURCE_BADGE.unknown;
                const entry = file.steelCostEntries?.[0];

                return (
                  <React.Fragment key={file.id}>
                  <tr className="border-t group">
                    <td className="p-3 align-top">
                      <div>{formatDate(file.createdAt)}</div>
                    </td>
                    <td className="p-3 align-top">
                      <div className="font-medium truncate max-w-48" title={file.fileName}>{file.fileName}</div>
                      <div className="text-xs text-muted-foreground">{(file.fileSize / 1024).toFixed(0)} KB</div>
                    </td>
                    <td className="p-3 align-top font-mono text-xs">{file.jobId || '-'}</td>
                    <td className="p-3 align-top">{file.clientName || '-'}</td>
                    <td className="p-3 align-top">
                      <span className="capitalize">{file.fileType}</span>
                    </td>
                    <td className="p-3 align-top">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${srcBadge.bg} ${srcBadge.text}`}>
                        {file.extractionSource === 'ai' ? 'AI' : file.extractionSource === 'regex' ? 'Regex' : 'Unknown'}
                      </span>
                    </td>
                    <td className="p-3 align-top">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3 align-top text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setExpandedId(isExpanded ? null : file.id)}
                          title="View details">
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        {file.reviewStatus !== 'approved' && (
                          <Button size="sm" variant="ghost" onClick={() => updateReviewStatus(file.id, 'approved')}
                            title="Approve" className="text-green-600 hover:text-green-700">
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openEditDialog(file)}
                          title="Edit & Correct" className="text-blue-600 hover:text-blue-700">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {file.reviewStatus !== 'rejected' && (
                          <Button size="sm" variant="ghost" onClick={() => updateReviewStatus(file.id, 'rejected')}
                            title="Reject" className="text-red-600 hover:text-red-700">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => downloadFile(file.storagePath, file.fileName)}
                          title="Download original">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                    {isExpanded && (
                      <tr className="border-t"><td colSpan={8} className="p-0">
                        <div className="bg-muted/30 p-4 border-t space-y-4">
                          {/* Parse error banner */}
                          {file.parseError && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-md p-3">
                              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                              <div>
                                <div className="font-medium text-red-800 text-sm">Parse Error</div>
                                <div className="text-red-700 text-xs">{file.parseError}</div>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-4">
                            {/* Parsed values */}
                            <div>
                              <h4 className="font-medium mb-2 text-sm">Extracted Values</h4>
                              {entry ? (
                                <div className="space-y-1 text-sm">
                                  <div className="flex justify-between"><span className="text-muted-foreground">Weight:</span><span>{formatNumber(entry.weight_lbs || 0)} lbs</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Cost/lb:</span><span>${(entry.cost_per_lb || 0).toFixed(2)}</span></div>
                                  <div className="flex justify-between"><span className="text-muted-foreground">Total Cost:</span><span>{formatCurrency(entry.total_cost || 0)}</span></div>
                                  {entry.width && <div className="flex justify-between"><span className="text-muted-foreground">Width:</span><span>{entry.width} ft</span></div>}
                                  {entry.length && <div className="flex justify-between"><span className="text-muted-foreground">Length:</span><span>{entry.length} ft</span></div>}
                                  {entry.height && <div className="flex justify-between"><span className="text-muted-foreground">Height:</span><span>{entry.height} ft</span></div>}
                                  {entry.roof_pitch && <div className="flex justify-between"><span className="text-muted-foreground">Roof Pitch:</span><span>{entry.roof_pitch}:12</span></div>}
                                  {entry.province && <div className="flex justify-between"><span className="text-muted-foreground">Province:</span><span>{entry.province}</span></div>}
                                  {entry.insulation_total > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Insulation:</span><span>{formatCurrency(entry.insulation_total)}</span></div>}
                                </div>
                              ) : (
                                <p className="text-muted-foreground text-sm">No extracted data — {file.reviewStatus === 'needs_review' ? 'use Edit to manually enter values' : 'parsing failed'}</p>
                              )}

                              {/* Corrected data */}
                              {file.correctedData && (
                                <div className="mt-3">
                                  <h4 className="font-medium mb-1 text-sm text-blue-700">Corrected Values</h4>
                                  <div className="space-y-1 text-sm">
                                    {(file.correctedData as any).weight > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Weight:</span><span>{formatNumber((file.correctedData as any).weight)} lbs</span></div>}
                                    {(file.correctedData as any).cost_per_lb > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Cost/lb:</span><span>${(file.correctedData as any).cost_per_lb.toFixed(2)}</span></div>}
                                    {(file.correctedData as any).total_cost > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Total Cost:</span><span>{formatCurrency((file.correctedData as any).total_cost)}</span></div>}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Raw AI output */}
                            <div>
                              <h4 className="font-medium mb-2 text-sm">Raw AI Output</h4>
                              {renderAIOutput(file.aiOutput)}
                            </div>
                          </div>

                          {/* Review info */}
                          {file.reviewedAt && (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
                              <Clock className="h-3 w-3" />
                              Reviewed {formatDate(file.reviewedAt)}
                            </div>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Correct Dialog */}
      <Dialog open={!!editingFile} onOpenChange={(open) => { if (!open) setEditingFile(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit & Correct Import</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              File: <span className="font-medium text-foreground">{editingFile?.fileName}</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Weight (lbs)</Label>
                <Input type="number" value={editForm.weightLbs}
                  onChange={e => setEditForm(f => ({ ...f, weightLbs: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Cost/lb ($)</Label>
                <Input type="number" step="0.01" value={editForm.costPerLb}
                  onChange={e => setEditForm(f => ({ ...f, costPerLb: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Total Cost ($)</Label>
                <Input type="number" step="0.01" value={editForm.totalCost}
                  onChange={e => setEditForm(f => ({ ...f, totalCost: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Width (ft)</Label>
                <Input type="number" value={editForm.width}
                  onChange={e => setEditForm(f => ({ ...f, width: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Length (ft)</Label>
                <Input type="number" value={editForm.length}
                  onChange={e => setEditForm(f => ({ ...f, length: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Height (ft)</Label>
                <Input type="number" value={editForm.height}
                  onChange={e => setEditForm(f => ({ ...f, height: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Pitch (:12)</Label>
                <Input type="number" value={editForm.roofPitch}
                  onChange={e => setEditForm(f => ({ ...f, roofPitch: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Province</Label>
                <Input value={editForm.province}
                  onChange={e => setEditForm(f => ({ ...f, province: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input value={editForm.city}
                  onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Insulation Total ($)</Label>
                <Input type="number" step="0.01" value={editForm.insulationTotal}
                  onChange={e => setEditForm(f => ({ ...f, insulationTotal: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Insulation Grade</Label>
                <Input value={editForm.insulationGrade}
                  onChange={e => setEditForm(f => ({ ...f, insulationGrade: e.target.value }))} />
              </div>
            </div>

            {editingFile?.aiOutput && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View original AI output</summary>
                <pre className="mt-2 bg-muted p-2 rounded-md overflow-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify(editingFile.aiOutput, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>Cancel</Button>
            <Button onClick={saveCorrection}>Save & Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
