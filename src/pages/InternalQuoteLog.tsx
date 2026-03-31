import { DocumentLogTable } from '@/components/DocumentLogTable';

export default function InternalQuoteLog() {
  return (
    <DocumentLogTable
      title="Internal Quote Log"
      subtitle="Internal quotes stay separate from deals and recent deal activity until sales explicitly converts an external quote."
      filterDocumentTypes={['internal_quote']}
    />
  );
}
