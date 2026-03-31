import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentLogTable } from '@/components/DocumentLogTable';
import type { DocumentType } from '@/types';

export default function QuoteLog() {
  const [activeTab, setActiveTab] = useState<'rfq' | 'dealer_rfq' | 'external_quote' | 'all'>('all');

  const filterTypes: DocumentType[] = activeTab === 'all'
    ? ['rfq', 'dealer_rfq', 'external_quote']
    : [activeTab];

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="all">All Documents</TabsTrigger>
          <TabsTrigger value="rfq">RFQs</TabsTrigger>
          <TabsTrigger value="dealer_rfq">Dealer RFQs</TabsTrigger>
          <TabsTrigger value="external_quote">External Quotes</TabsTrigger>
        </TabsList>
      </Tabs>

      <DocumentLogTable
        title="RFQ Log"
        subtitle="RFQs, dealer RFQs, and external quotes share the same document lifecycle. Internal quotes stay in their own log and do not count as deals."
        filterDocumentTypes={filterTypes}
      />
    </div>
  );
}
