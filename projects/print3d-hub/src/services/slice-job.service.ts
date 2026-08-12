import { randomUUID } from 'crypto';
import type { SlicingResult } from './slicer.service';

interface SliceJob extends SlicingResult {
  expiresAt: number;
}

const JOB_TTL_MS = 30 * 60 * 1000;
const jobs = new Map<string, SliceJob>();

export const createSliceJob = (result: SlicingResult): SlicingResult => {
  const fileKey = `${randomUUID()}.stl`;
  jobs.set(fileKey, { ...result, fileKey, expiresAt: Date.now() + JOB_TTL_MS });
  return { ...result, fileKey };
};

export const getSliceJob = (fileKey: unknown): SliceJob | null => {
  if (typeof fileKey !== 'string' || !/^[0-9a-f-]{36}\.stl$/i.test(fileKey)) return null;
  const job = jobs.get(fileKey);
  if (!job || job.expiresAt < Date.now()) {
    jobs.delete(fileKey);
    return null;
  }
  return job;
};

export const deleteSliceJob = (fileKey: string): void => { jobs.delete(fileKey); };
