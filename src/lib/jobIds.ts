const UNICODE_DASH_REGEX = /[\u2010-\u2015\u2212]/g;

export function formatCanonicalJobId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed
    .replace(UNICODE_DASH_REGEX, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, ' ');
}

export function normalizeJobIdKey(value: unknown): string {
  const canonical = formatCanonicalJobId(value);
  if (!canonical) return '';

  return canonical
    .toUpperCase()
    .replace(/\s*[_-]\s*/g, '-')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

export function buildJobIdSearchAlias(value: unknown): string {
  const normalized = normalizeJobIdKey(value);
  if (!normalized) return '';

  return normalized.replace(/[^A-Z0-9]+/g, '');
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
