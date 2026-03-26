import { Download, Printer } from 'lucide-react';

interface PageActionsProps {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  onPrint?: () => void;
  exportLabel?: string;
}

/**
 * Page header with optional Print and Export buttons.
 * Print/Export buttons are hidden during printing via the `no-print` class.
 */
export function PageActions({ title, subtitle, onExport, onPrint, exportLabel = 'Export CSV' }: PageActionsProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 no-print">
        {onExport && (
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border bg-card hover:bg-muted text-foreground transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            {exportLabel}
          </button>
        )}
        {onPrint && (
          <button
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border bg-card hover:bg-muted text-foreground transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
        )}
      </div>
    </div>
  );
}
