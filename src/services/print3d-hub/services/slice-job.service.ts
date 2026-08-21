import { randomUUID } from 'crypto';

import SliceJobModel from '../models/SliceJob';
import type { SlicingResult } from './slicer.service';

interface SliceJob extends Required<Omit<SlicingResult, 'fileKey'>> {
  fileKey: string;
  expiresAt: number;
}

const JOB_TTL_MS = 30 * 60 * 1000;

export const createSliceJob = async (result: SlicingResult): Promise<SlicingResult> => {
  const fileKey = `${randomUUID()}.stl`;
  await SliceJobModel.create({
    fileKey,
    weightg: result.weightg,
    timeSeconds: result.timeSeconds,
    layerHeight: result.layerHeight,
    infillDensity: result.infillDensity,
    material: result.material,
    expiresAt: new Date(Date.now() + JOB_TTL_MS),
  });
  return { ...result, fileKey };
};

export const getSliceJob = async (fileKey: unknown): Promise<SliceJob | null> => {
  if (typeof fileKey !== 'string' || !/^[0-9a-f-]{36}\.stl$/i.test(fileKey)) return null;
  const job = await SliceJobModel.findOne({ fileKey, expiresAt: { $gt: new Date() } }).lean();
  if (!job) return null;

  return {
    fileKey: job.fileKey,
    weightg: job.weightg,
    timeSeconds: job.timeSeconds,
    layerHeight: job.layerHeight,
    infillDensity: job.infillDensity,
    material: job.material,
    expiresAt: job.expiresAt.getTime(),
  };
};

export const deleteSliceJob = async (fileKey: string): Promise<void> => {
  await SliceJobModel.deleteOne({ fileKey });
};
