export function formatCanonicalJobId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
}

export function normalizeJobIdKey(value: unknown): string {
  const canonical = formatCanonicalJobId(value);
  return canonical ? canonical.toUpperCase() : '';
}

export function resolveCanonicalJobId(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const canonical = formatCanonicalJobId(candidate);
    if (canonical) return canonical;
  }
  return null;
}

export function jobIdsMatch(left: unknown, right: unknown): boolean {
  const leftKey = normalizeJobIdKey(left);
  const rightKey = normalizeJobIdKey(right);
  return Boolean(leftKey) && leftKey === rightKey;
}

export function resolveCanonicalJobIdFromRecord(
  record: Record<string, unknown> | null | undefined,
  options?: { includeSourceJobId?: boolean },
): string | null {
  if (!record) return null;

  return resolveCanonicalJobId(
    record.jobId,
    record.job_id,
    record.projectId,
    record.project_id,
    options?.includeSourceJobId ? record.sourceJobId : null,
    options?.includeSourceJobId ? record.source_job_id : null,
  );
}
