import type { ConstructionRFQ, Deal, Estimate, FreightRecord, JobProfile, Quote, StructureType } from '@/types';
import { jobIdsMatch, resolveCanonicalJobId } from '@/lib/jobIds';

type JobProfileSeed = Partial<JobProfile> & { jobId: string };

export function createEmptyJobProfile(jobId: string): JobProfile {
  return {
    jobId,
    jobName: '',
    clientId: '',
    clientName: '',
    salesRep: '',
    estimator: '',
    teamLead: '',
    province: '',
    city: '',
    address: '',
    postalCode: '',
    width: 0,
    length: 0,
    height: 0,
    structureType: null,
    lastSource: null,
  };
}

export function mergeJobProfile(existing: JobProfile | null | undefined, updates: JobProfileSeed): JobProfile {
  const canonicalJobId = resolveCanonicalJobId(updates.jobId) || updates.jobId.trim();
  const base = existing || createEmptyJobProfile(canonicalJobId);

  return {
    ...base,
    jobId: canonicalJobId,
    jobName: updates.jobName ?? base.jobName,
    clientId: updates.clientId ?? base.clientId,
    clientName: updates.clientName ?? base.clientName,
    salesRep: updates.salesRep ?? base.salesRep,
    estimator: updates.estimator ?? base.estimator,
    teamLead: updates.teamLead ?? base.teamLead,
    province: updates.province ?? base.province,
    city: updates.city ?? base.city,
    address: updates.address ?? base.address,
    postalCode: updates.postalCode ?? base.postalCode,
    width: updates.width ?? base.width,
    length: updates.length ?? base.length,
    height: updates.height ?? base.height,
    leftEaveHeight: updates.leftEaveHeight ?? base.leftEaveHeight,
    rightEaveHeight: updates.rightEaveHeight ?? base.rightEaveHeight,
    isSingleSlope: updates.isSingleSlope ?? base.isSingleSlope,
    pitch: updates.pitch ?? base.pitch,
    structureType: updates.structureType ?? base.structureType ?? null,
    lastSource: updates.lastSource ?? base.lastSource ?? null,
    updatedAt: new Date().toISOString(),
    createdAt: base.createdAt || new Date().toISOString(),
  };
}

export function findJobProfile(jobProfiles: JobProfile[], jobId?: string | null) {
  if (!jobId) return null;
  return jobProfiles.find(profile => jobIdsMatch(profile.jobId, jobId)) || null;
}

export function buildJobProfileFromDeal(deal: Partial<Deal>, structureType?: StructureType | null): JobProfileSeed | null {
  const jobId = resolveCanonicalJobId(deal.jobId || '');
  if (!jobId) return null;
  return {
    jobId,
    jobName: deal.jobName || '',
    clientId: deal.clientId || '',
    clientName: deal.clientName || '',
    salesRep: deal.salesRep || '',
    estimator: deal.estimator || '',
    teamLead: deal.teamLead || '',
    province: deal.province || '',
    city: deal.city || '',
    address: deal.address || '',
    postalCode: deal.postalCode || '',
    width: deal.width ?? 0,
    length: deal.length ?? 0,
    height: deal.height ?? 0,
    leftEaveHeight: deal.leftEaveHeight,
    rightEaveHeight: deal.rightEaveHeight,
    isSingleSlope: deal.isSingleSlope,
    structureType: structureType ?? null,
    lastSource: 'deal',
  };
}

export function buildJobProfileFromQuote(quote: Partial<Quote>, structureType?: StructureType | null): JobProfileSeed | null {
  const jobId = resolveCanonicalJobId(quote.jobId || '');
  if (!jobId) return null;
  return {
    jobId,
    jobName: quote.jobName || '',
    clientId: quote.clientId || '',
    clientName: quote.clientName || '',
    salesRep: quote.salesRep || '',
    estimator: quote.estimator || '',
    province: quote.province || '',
    city: quote.city || '',
    address: quote.address || '',
    postalCode: quote.postalCode || '',
    width: quote.width ?? 0,
    length: quote.length ?? 0,
    height: quote.height ?? 0,
    leftEaveHeight: quote.leftEaveHeight,
    rightEaveHeight: quote.rightEaveHeight,
    isSingleSlope: quote.isSingleSlope,
    pitch: quote.pitch,
    structureType: structureType ?? null,
    lastSource: 'quote',
  };
}

export function buildJobProfileFromEstimate(estimate: Partial<Estimate>): JobProfileSeed | null {
  const jobId = resolveCanonicalJobId(estimate.jobId || '');
  if (!jobId) return null;
  return {
    jobId,
    clientId: estimate.clientId || '',
    clientName: estimate.clientName || '',
    salesRep: estimate.salesRep || '',
    province: estimate.province || '',
    city: estimate.city || '',
    postalCode: estimate.postalCode || '',
    width: estimate.width ?? 0,
    length: estimate.length ?? 0,
    height: estimate.height ?? 0,
    pitch: estimate.pitch,
    lastSource: 'estimate',
  };
}

export function buildJobProfileFromFreight(record: Partial<FreightRecord>): JobProfileSeed | null {
  const jobId = resolveCanonicalJobId(record.jobId || '');
  if (!jobId) return null;
  return {
    jobId,
    clientName: record.clientName || '',
    address: record.deliveryAddress || '',
    lastSource: 'freight',
  };
}

export function buildJobProfileFromConstructionRFQ(rfq: Partial<ConstructionRFQ>): JobProfileSeed | null {
  const jobId = resolveCanonicalJobId(rfq.jobId || '');
  if (!jobId) return null;
  return {
    jobId,
    jobName: rfq.jobName || '',
    province: rfq.province || '',
    city: rfq.city || '',
    address: rfq.address || '',
    postalCode: rfq.postalCode || '',
    width: rfq.width ?? 0,
    length: rfq.length ?? 0,
    height: rfq.height ?? 0,
    lastSource: 'construction_rfq',
  };
}

export function applyJobProfileToDealDraft(profile: JobProfile | null, current: Partial<Deal>) {
  if (!profile) return current;
  return {
    ...current,
    jobId: profile.jobId,
    jobName: current.jobName || profile.jobName,
    clientId: current.clientId || profile.clientId,
    clientName: current.clientName || profile.clientName,
    salesRep: current.salesRep || profile.salesRep,
    estimator: current.estimator || profile.estimator,
    teamLead: current.teamLead || profile.teamLead,
    province: current.province || profile.province,
    city: current.city || profile.city,
    address: current.address || profile.address,
    postalCode: current.postalCode || profile.postalCode,
    width: current.width || profile.width,
    length: current.length || profile.length,
    height: current.height || profile.height,
    leftEaveHeight: current.leftEaveHeight ?? profile.leftEaveHeight,
    rightEaveHeight: current.rightEaveHeight ?? profile.rightEaveHeight,
    isSingleSlope: current.isSingleSlope ?? profile.isSingleSlope,
  };
}
