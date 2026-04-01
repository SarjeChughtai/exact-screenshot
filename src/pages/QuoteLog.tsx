import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DocumentLogTable } from '@/components/DocumentLogTable';
import { RFQWorkflowQueues } from '@/components/RFQWorkflowQueues';
import { useRoles } from '@/context/RoleContext';
import { useSettings } from '@/context/SettingsContext';
import type { DocumentType } from '@/types';

type QuoteLogView = 'log' | 'pipeline';

export default function QuoteLog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, hasAnyRole } = useRoles();
  const { getEstimators } = useSettings();
  const isEstimatorOnly = hasAnyRole('estimator') && !hasAnyRole('admin', 'owner', 'operations', 'sales_rep');
  const canFilterAssignee = hasAnyRole('admin', 'owner', 'operations');
  const [activeTab, setActiveTab] = useState<'rfq' | 'dealer_rfq' | 'external_quote' | 'all'>(isEstimatorOnly ? 'rfq' : 'all');
  const focusedDocumentId = searchParams.get('documentId') || undefined;
  const assigneeParam = searchParams.get('assignee') || 'all';
  const viewParam = searchParams.get('view');
  const estimatorOptions = useMemo(
    () => getEstimators().sort((left, right) => left.name.localeCompare(right.name)),
    [getEstimators],
  );

  const workspaceView: QuoteLogView = viewParam === 'pipeline' || viewParam === 'log'
    ? viewParam
    : focusedDocumentId
    ? 'log'
    : isEstimatorOnly
    ? 'pipeline'
    : 'log';

  const updateSearchParam = (key: string, value?: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!value || value === 'all') {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const filterTypes: DocumentType[] = isEstimatorOnly
    ? ['rfq', 'dealer_rfq']
    : activeTab === 'all'
    ? ['rfq', 'dealer_rfq', 'external_quote']
    : [activeTab];

  const workflowStatuses = isEstimatorOnly
    ? ['estimate_needed', 'estimating', 'estimate_complete', 'internal_quote_in_progress']
    : undefined;

  const rfqAssigneeFilter = useMemo(() => {
    if (isEstimatorOnly) {
      return { userId: currentUser.id, name: currentUser.name };
    }

    if (!canFilterAssignee || assigneeParam === 'all') return undefined;
    if (assigneeParam === 'unassigned') return { mode: 'unassigned' as const };

    const estimator = estimatorOptions.find(item => item.id === assigneeParam);
    if (!estimator) return undefined;

    return {
      userId: estimator.id,
      name: estimator.name,
      mode: 'assigned' as const,
    };
  }, [assigneeParam, canFilterAssignee, currentUser.id, currentUser.name, estimatorOptions, isEstimatorOnly]);

  return (
    <div className="space-y-6" data-testid="quote-log-page" data-workspace-view={workspaceView}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={workspaceView} onValueChange={value => updateSearchParam('view', value)}>
          <TabsList>
            <TabsTrigger value="log">Log</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          </TabsList>
        </Tabs>

        {canFilterAssignee && (
          <Select value={assigneeParam} onValueChange={value => updateSearchParam('assignee', value)}>
            <SelectTrigger className="w-56" data-testid="quote-log-assignee-filter">
              <SelectValue placeholder="All assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned RFQs</SelectItem>
              {estimatorOptions.map(estimator => (
                <SelectItem key={estimator.id} value={estimator.id}>
                  {estimator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {workspaceView === 'pipeline' ? (
        <RFQWorkflowQueues assigneeFilter={rfqAssigneeFilter} />
      ) : (
        <>
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
              ? 'Assigned and submitted RFQs only. External and internal quotes stay outside the estimator workspace.'
              : 'RFQs, dealer RFQs, and external quotes share one RFQ workspace. Switch to pipeline view for role-based queues.'}
            filterDocumentTypes={filterTypes}
            filterWorkflowStatuses={workflowStatuses}
            focusDocumentId={focusedDocumentId}
            rfqAssigneeFilter={rfqAssigneeFilter}
          />
        </>
      )}
    </div>
  );
}
