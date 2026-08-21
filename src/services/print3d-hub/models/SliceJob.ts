import mongoose, { Document, Schema } from 'mongoose-print3d';

export interface ISliceJob extends Document {
  fileKey: string;
  weightg: number;
  timeSeconds: number;
  layerHeight: number;
  infillDensity: number;
  material: string;
  expiresAt: Date;
}

const SliceJobSchema = new Schema<ISliceJob>(
  {
    fileKey: { type: String, required: true, unique: true, index: true },
    weightg: { type: Number, required: true },
    timeSeconds: { type: Number, required: true },
    layerHeight: { type: Number, required: true },
    infillDensity: { type: Number, required: true },
    material: { type: String, required: true, enum: ['PLA', 'PETG', 'TPU'] },
    // MongoDB removes unclaimed slice records automatically after their short
    // validity window. Unlike an in-memory Map, this survives a restart.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false },
);

export default mongoose.model<ISliceJob>('SliceJob', SliceJobSchema);
