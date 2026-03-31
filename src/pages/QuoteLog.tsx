import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentLogTable } from '@/components/DocumentLogTable';
import { RFQWorkflowQueues } from '@/components/RFQWorkflowQueues';
import { useRoles } from '@/context/RoleContext';
import type { DocumentType } from '@/types';

export default function QuoteLog() {
  const { hasAnyRole } = useRoles();
  const isEstimatorOnly = hasAnyRole('estimator') && !hasAnyRole('admin', 'owner', 'operations', 'sales_rep');
  const [activeTab, setActiveTab] = useState<'rfq' | 'dealer_rfq' | 'external_quote' | 'all'>(isEstimatorOnly ? 'rfq' : 'all');

  const filterTypes: DocumentType[] = isEstimatorOnly
    ? ['rfq', 'dealer_rfq']
    : activeTab === 'all'
    ? ['rfq', 'dealer_rfq', 'external_quote']
    : [activeTab];

  const workflowStatuses = isEstimatorOnly
    ? ['estimate_needed', 'estimating', 'estimate_complete', 'internal_quote_in_progress']
    : undefined;

  return (
    <div className="space-y-6">
      <RFQWorkflowQueues />

      {!isEstimatorOnly && (
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)}>
          <TabsList>
            <TabsTrigger value="all">All Documents</TabsTrigger>
            <TabsTrigger value="rfq">RFQs</TabsTrigger>
            <TabsTrigger value="dealer_rfq">Dealer RFQs</TabsTrigger>
            <TabsTrigger value="external_quote">External Quotes</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <DocumentLogTable
        title="RFQ Log"
        subtitle={isEstimatorOnly
          ? 'Submitted RFQs waiting on estimator work only. External and internal quotes are hidden for this role.'
          : 'RFQs, dealer RFQs, and external quotes share the same document lifecycle. Internal quotes stay in their own log and do not count as deals.'}
        filterDocumentTypes={filterTypes}
        filterWorkflowStatuses={workflowStatuses}
      />
    </div>
  );
}
