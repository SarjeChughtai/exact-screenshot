import { useMemo, useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { importStructuredDataFile, parseUploadedCostFile, persistParsedCostDocument } from '@/lib/costDataWarehouse';
import { Upload, Database, FileText, Package } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/calculations';

export default function CostData() {
  const { steelCostData, insulationCostData, storedDocuments, refreshData } = useAppContext();
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const filteredSteel = useMemo(() => {
    const query = search.toLowerCase();
    return steelCostData.filter((row) =>
      !query
      || row.projectId?.toLowerCase().includes(query)
      || row.jobId?.toLowerCase().includes(query)
      || row.sourceFileName?.toLowerCase().includes(query),
    );
  }, [search, steelCostData]);

  const filteredInsulation = useMemo(() => {
    const query = search.toLowerCase();
    return insulationCostData.filter((row) =>
      !query
      || row.projectId?.toLowerCase().includes(query)
      || row.jobId?.toLowerCase().includes(query)
      || row.quoteNumber?.toLowerCase().includes(query)
      || row.sourceFileName?.toLowerCase().includes(query),
    );
  }, [search, insulationCostData]);

  const filteredDocuments = useMemo(() => {
    const query = search.toLowerCase();
    return storedDocuments.filter((row) =>
      !query
      || row.fileName.toLowerCase().includes(query)
      || row.jobId?.toLowerCase().includes(query)
      || row.projectId?.toLowerCase().includes(query),
    );
  }, [search, storedDocuments]);

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      let totalStored = 0;
      let totalSteel = 0;
      let totalInsulation = 0;
      const skipped: string[] = [];

      for (const file of Array.from(files)) {
        const extension = file.name.split('.').pop()?.toLowerCase();
        if (extension === 'pdf') {
          const parsed = await parseUploadedCostFile(file);
          const persisted = await persistParsedCostDocument({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/pdf',
            sourceType: 'uploaded',
            reviewStatus: parsed.type === 'unknown' ? 'needs_review' : 'pending',
            parseError: parsed.type === 'unknown' ? parsed.parseError : null,
            parserName: 'regex-pdf-parser',
          }, parsed);
          totalStored += persisted.storedDocumentId ? 1 : 0;
          totalSteel += persisted.steelId ? 1 : 0;
          totalInsulation += persisted.insulationId ? 1 : 0;
          if (parsed.type === 'unknown') skipped.push(file.name);
        } else {
          const summary = await importStructuredDataFile(file);
          totalStored += summary.storedDocuments;
          totalSteel += summary.steelRows;
          totalInsulation += summary.insulationRows;
          skipped.push(...summary.skippedFiles);
        }
      }

      await refreshData();
      toast.success(`Imported ${totalSteel} steel rows, ${totalInsulation} insulation rows, ${totalStored} stored documents`);
      if (skipped.length) {
        toast.info(`Skipped ${skipped.length} unsupported or derived files`);
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Cost data import failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Cost Data</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Warehouse for steel, insulation, and uploaded source documents used by the estimator.
          </p>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <Label className="text-xs">Search</Label>
            <Input className="mt-1 w-64" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job, project, file..." />
          </div>
          <div>
            <Label className="text-xs">Import Files</Label>
            <Input
              className="mt-1"
              type="file"
              multiple
              accept=".pdf,.json,.csv,.xlsx,.xls,.zip"
              disabled={uploading}
              onChange={(event) => {
                void handleUpload(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Database className="h-4 w-4" />Steel Records</div>
          <div className="text-2xl font-bold mt-2">{steelCostData.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Package className="h-4 w-4" />Insulation Records</div>
          <div className="text-2xl font-bold mt-2">{insulationCostData.length}</div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" />Stored Documents</div>
          <div className="text-2xl font-bold mt-2">{storedDocuments.length}</div>
        </div>
      </div>

      <Tabs defaultValue="steel" className="space-y-4">
        <TabsList>
          <TabsTrigger value="steel">Steel</TabsTrigger>
          <TabsTrigger value="insulation">Insulation</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="steel" className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Size</th>
                <th className="text-left p-3">Weight</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">$ / sqft</th>
                <th className="text-left p-3">$ / lb</th>
                <th className="text-left p-3">Source</th>
              </tr>
            </thead>
            <tbody>
              {filteredSteel.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-medium">{row.projectId || row.jobId || '-'}</td>
                  <td className="p-3">{row.widthFt || 0} x {row.lengthFt || 0} x {row.eaveHeightFt || 0}</td>
                  <td className="p-3">{formatNumber(row.totalWeightLb || 0)} lb</td>
                  <td className="p-3">{formatCurrency(row.totalCost || 0)}</td>
                  <td className="p-3">{row.costPerSqft?.toFixed(2) || '-'}</td>
                  <td className="p-3">{row.pricePerLb?.toFixed(2) || '-'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.sourceFileName || row.dataSource || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="insulation" className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Grade</th>
                <th className="text-left p-3">Coverage</th>
                <th className="text-left p-3">Material</th>
                <th className="text-left p-3">Delivery</th>
                <th className="text-left p-3">Total</th>
                <th className="text-left p-3">Quote</th>
              </tr>
            </thead>
            <tbody>
              {filteredInsulation.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-medium">{row.projectId || row.jobId || '-'}</td>
                  <td className="p-3">{row.grade || '-'}</td>
                  <td className="p-3">{formatNumber(row.totalInsulatedSqft || 0)} sqft</td>
                  <td className="p-3">{formatCurrency(row.materialCost || 0)}</td>
                  <td className="p-3">{formatCurrency(row.totalDelivery || 0)}</td>
                  <td className="p-3">{formatCurrency(row.totalCost || 0)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.quoteNumber || row.sourceFileName || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>

        <TabsContent value="documents" className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">File</th>
                <th className="text-left p-3">Job / Project</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Review</th>
                <th className="text-left p-3">Parser</th>
                <th className="text-left p-3">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocuments.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-3 font-medium">{row.fileName}</td>
                  <td className="p-3">{row.jobId || row.projectId || '-'}</td>
                  <td className="p-3 capitalize">{row.extractedDocumentType || row.fileType}</td>
                  <td className="p-3 capitalize">{row.reviewStatus}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.parserName || '-'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{row.uploadedAt ? new Date(row.uploadedAt).toLocaleDateString('en-CA') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TabsContent>
      </Tabs>

      <Button variant="outline" onClick={() => void refreshData()} disabled={uploading}>
        <Upload className="h-4 w-4 mr-2" />
        {uploading ? 'Importing...' : 'Refresh Cost Data'}
      </Button>
    </div>
  );
}
