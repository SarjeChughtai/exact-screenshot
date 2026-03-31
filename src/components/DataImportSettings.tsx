import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useAppContext } from '@/context/AppContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Eye, EyeOff, Loader2, FileText, X, Plus, Trash2, RotateCcw, Check } from 'lucide-react';
import {
  type AIExtractionResult,
  type CostLineItem,
  processDocumentWithAI,
  extractFileContent,
} from '@/lib/aiDocumentService';
import { upsertStoredDocument } from '@/lib/costDataWarehouse';

type ImportStep = 'idle' | 'extracting' | 'processing' | 'review' | 'saving';

const CATEGORIES = ['materials', 'labor', 'subcontractor', 'freight', 'engineering', 'insulation', 'drawings', 'equipment', 'other'];

export default function DataImportSettings() {
  const { user } = useAuth();
  const { deals } = useAppContext();

  // AI Provider state
  const [provider, setProvider] = useState('openrouter');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Processing state
  const [step, setStep] = useState<ImportStep>('idle');
  const [error, setError] = useState<string | null>(null);

  // Review state
  const [extractionResult, setExtractionResult] = useState<AIExtractionResult | null>(null);
  const [editableItems, setEditableItems] = useState<CostLineItem[]>([]);
  const [projectName, setProjectName] = useState('');
  const [documentType, setDocumentType] = useState('');

  // Load existing AI config
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('ai_provider_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setProvider(data.provider);
        setApiKey(data.api_key);
        setBaseUrl(data.base_url || '');
      }
      setConfigLoaded(true);
    })();
  }, [user]);

  // Save AI config
  const saveConfig = async () => {
    if (!user) return;
    if (!apiKey.trim()) {
      toast.error('API key is required');
      return;
    }
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('ai_provider_settings')
        .upsert({
          user_id: user.id,
          provider,
          api_key: apiKey.trim(),
          base_url: provider === 'custom' ? baseUrl.trim() || null : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      if (error) throw error;
      toast.success('AI provider settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSavingConfig(false);
    }
  };

  // File handling
  const handleFileSelect = useCallback((file: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 10MB.');
      return;
    }
    const ext = file.name.toLowerCase().split('.').pop();
    if (!['pdf', 'csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Unsupported file type. Please upload PDF, CSV, or XLSX.');
      return;
    }
    setSelectedFile(file);
    setError(null);
    setExtractionResult(null);
    setStep('idle');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  // Process file with AI
  const processFile = async () => {
    if (!selectedFile) return;
    if (!apiKey.trim()) {
      toast.error('Please configure your AI API key first');
      return;
    }

    setError(null);
    setStep('extracting');

    try {
      const content = await extractFileContent(selectedFile);
      setStep('processing');

      const result = await processDocumentWithAI(content, {
        provider,
        apiKey: apiKey.trim(),
        baseUrl: baseUrl.trim() || null,
      });

      setExtractionResult(result);
      setEditableItems(result.line_items.map(item => ({ ...item })));
      setProjectName(result.project_name || '');
      setDocumentType(result.document_type || 'other');
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Processing failed');
      setStep('idle');
      toast.error('Failed to process document');
    }
  };

  // Editable item handlers
  const updateItem = (index: number, field: keyof CostLineItem, value: string | number) => {
    setEditableItems(items => {
      const updated = [...items];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate total if quantity or unit_price changed
      if (field === 'quantity' || field === 'unit_price') {
        updated[index].total = Number(updated[index].quantity) * Number(updated[index].unit_price);
      }
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setEditableItems(items => items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setEditableItems(items => [...items, {
      description: '',
      category: 'other',
      quantity: 1,
      unit_price: 0,
      total: 0,
      vendor: '',
      date: '',
    }]);
  };

  const calculatedTotal = editableItems.reduce((sum, item) => sum + Number(item.total), 0);

  // Save confirmed data
  const confirmImport = async () => {
    if (!user || editableItems.length === 0) return;
    setStep('saving');

    try {
      // Find matching project_id from deals
      let projectId: string | null = null;
      if (projectName) {
        const deal = deals.find(d =>
          d.jobName.toLowerCase().includes(projectName.toLowerCase()) ||
          d.jobId.toLowerCase().includes(projectName.toLowerCase()) ||
          projectName.toLowerCase().includes(d.jobName.toLowerCase())
        );
        if (deal) projectId = deal.jobId;
      }

      // Insert cost data rows
      const costRows = editableItems.map(item => ({
        project_id: projectId,
        description: item.description,
        category: item.category,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        total: Number(item.total),
        vendor: item.vendor,
        date: item.date || null,
        source_document: selectedFile?.name || '',
        imported_by: user.id,
      }));

      const { error: costError } = await supabase
        .from('cost_data')
        .insert(costRows);
      if (costError) throw costError;

      // Record import history
      const { error: historyError } = await supabase
        .from('import_history')
        .insert({
          user_id: user.id,
          filename: selectedFile?.name || '',
          provider_used: provider,
          items_imported: editableItems.length,
          total_amount: calculatedTotal,
          status: 'completed',
        });
      if (historyError) throw historyError;

      await upsertStoredDocument({
        fileName: selectedFile?.name || '',
        fileSize: selectedFile?.size || 0,
        fileType: documentType || selectedFile?.type || 'unknown',
        storagePath: '',
        uploadedBy: user.id,
        sourceType: 'uploaded',
        reviewStatus: 'approved',
        parserName: 'ai-line-item-import',
      }, null);

      toast.success(`Successfully imported ${editableItems.length} cost items ($${calculatedTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })})`);

      // Reset state
      setSelectedFile(null);
      setExtractionResult(null);
      setEditableItems([]);
      setStep('idle');
      setProjectName('');
      setDocumentType('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save imported data');
      setStep('review');
    }
  };

  const cancelReview = () => {
    setStep('idle');
    setExtractionResult(null);
    setEditableItems([]);
  };

  const reprocess = () => {
    setExtractionResult(null);
    setEditableItems([]);
    processFile();
  };

  return (
    <div className="space-y-6">
      {/* AI Provider Configuration */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground">AI Provider Configuration</h3>
        <p className="text-xs text-muted-foreground">
          Configure an AI provider to analyze uploaded documents and extract cost data.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">AI Provider</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openrouter">OpenRouter API</SelectItem>
                <SelectItem value="perplexity">Perplexity API</SelectItem>
                <SelectItem value="custom">Custom API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">API Key</Label>
            <div className="relative mt-1">
              <Input
                className="input-blue pr-10"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={provider === 'perplexity' ? 'pplx-...' : provider === 'openrouter' ? 'sk-or-...' : 'API key'}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {provider === 'custom' && (
            <div className="md:col-span-2">
              <Label className="text-xs">Base URL</Label>
              <Input
                className="input-blue mt-1"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://your-api.example.com/v1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                The endpoint will be: {baseUrl || 'https://...'}/chat/completions
              </p>
            </div>
          )}
        </div>

        <Button size="sm" onClick={saveConfig} disabled={savingConfig || !apiKey.trim()}>
          {savingConfig ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Save API Settings
        </Button>
      </div>

      {/* Import Cost Data */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h3 className="text-sm font-semibold text-card-foreground">Import Cost Data</h3>
        <p className="text-xs text-muted-foreground">
          Upload a PDF, CSV, or XLSX file containing cost data. AI will extract and structure the data for your review.
        </p>

        {/* File Upload Area */}
        {step !== 'review' && step !== 'saving' && (
          <>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-muted-foreground/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag & drop a file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PDF, CSV, XLSX (max 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  e.target.value = '';
                }}
              />
            </div>

            {selectedFile && (
              <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-4 py-3">
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setSelectedFile(null); setError(null); }}>
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={processFile}
                  disabled={step === 'extracting' || step === 'processing' || !apiKey.trim()}
                >
                  {step === 'extracting' || step === 'processing' ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  {step === 'extracting'
                    ? 'Extracting text...'
                    : step === 'processing'
                    ? 'Analyzing with AI...'
                    : 'Process with AI'}
                </Button>
              </div>
            )}

            {!apiKey.trim() && configLoaded && (
              <p className="text-xs text-amber-600">
                Configure your AI API key above before processing documents.
              </p>
            )}

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </>
        )}

        {/* Review / Confirmation UI */}
        {step === 'review' && extractionResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold">Review Extracted Data</h4>
                <p className="text-xs text-muted-foreground">
                  From: {selectedFile?.name} — Detected as: {documentType}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={reprocess}>
                <RotateCcw className="h-3 w-3 mr-1" /> Re-process
              </Button>
            </div>

            {/* Project Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Project / Job Name</Label>
                <Input
                  className="input-blue mt-1"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Enter or select project name"
                  list="project-suggestions"
                />
                <datalist id="project-suggestions">
                  {state.deals.map(d => (
                    <option key={d.jobId} value={d.jobName}>
                      {d.jobId}
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <Label className="text-xs">Document Type</Label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="estimate">Estimate</SelectItem>
                    <SelectItem value="purchase_order">Purchase Order</SelectItem>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Editable Line Items Table */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium text-xs">Description</th>
                    <th className="px-3 py-2 font-medium text-xs w-28">Category</th>
                    <th className="px-3 py-2 font-medium text-xs w-20">Qty</th>
                    <th className="px-3 py-2 font-medium text-xs w-24">Unit Price</th>
                    <th className="px-3 py-2 font-medium text-xs w-24">Total</th>
                    <th className="px-3 py-2 font-medium text-xs w-28">Vendor</th>
                    <th className="px-3 py-2 font-medium text-xs w-28">Date</th>
                    <th className="px-3 py-2 font-medium text-xs w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {editableItems.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={item.description}
                          onChange={e => updateItem(i, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Select value={item.category} onValueChange={v => updateItem(i, 'category', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c} value={c}>
                                {c.charAt(0).toUpperCase() + c.slice(1)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-xs"
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(i, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-xs font-medium"
                          type="number"
                          step="0.01"
                          value={item.total}
                          onChange={e => updateItem(i, 'total', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-xs"
                          value={item.vendor}
                          onChange={e => updateItem(i, 'vendor', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          className="h-8 text-xs"
                          type="date"
                          value={item.date}
                          onChange={e => updateItem(i, 'date', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(i)} className="h-8 w-8 p-0">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-3 w-3 mr-1" /> Add Line Item
              </Button>
              <div className="text-sm font-semibold">
                Total: ${calculatedTotal.toLocaleString('en-CA', { minimumFractionDigits: 2 })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button onClick={confirmImport} disabled={editableItems.length === 0}>
                <Check className="h-4 w-4 mr-2" /> Confirm & Import
              </Button>
              <Button variant="outline" onClick={cancelReview}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Saving state */}
        {step === 'saving' && (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Saving imported data...</span>
          </div>
        )}
      </div>
    </div>
  );
}
