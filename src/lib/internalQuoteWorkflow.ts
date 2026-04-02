function clean(value?: string | null) {
  return typeof value === 'string' ? value.trim() : '';
}

export function buildInternalQuoteAutoJobName(jobId?: string | null, clientName?: string | null) {
  return [clean(jobId), clean(clientName)].filter(Boolean).join(' - ');
}

export function resolveInternalQuoteJobName(input: {
  currentJobName?: string | null;
  storedJobName?: string | null;
  jobId?: string | null;
  clientName?: string | null;
  preserveManual?: boolean;
}) {
  const currentJobName = clean(input.currentJobName);
  const storedJobName = clean(input.storedJobName);
  const autoJobName = buildInternalQuoteAutoJobName(input.jobId, input.clientName);

  if (input.preserveManual && currentJobName) {
    return { jobName: currentJobName, isManual: true };
  }

  if (storedJobName && (!autoJobName || storedJobName !== autoJobName)) {
    return { jobName: storedJobName, isManual: true };
  }

  return {
    jobName: autoJobName || storedJobName || currentJobName,
    isManual: false,
  };
}

export function canUploadInternalQuoteDocuments(input: {
  jobId?: string | null;
  clientId?: string | null;
  clientName?: string | null;
}) {
  return Boolean(clean(input.jobId) && clean(input.clientId) && clean(input.clientName));
}
