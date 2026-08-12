import mongoose, { Schema, Document } from 'mongoose';

export interface IFilament extends Document {
  id: string; // e.g. pla_black
  material: ('PLA' | 'PETG' | 'TPU')[];
  nameEn: string;
  nameHe: string;
  hex: string;
  stock: boolean;
  active: boolean;
  isDefault: boolean;
}

const FilamentSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  material: { type: [String], enum: ['PLA', 'PETG', 'TPU'], required: true },
  nameEn: { type: String, required: true },
  nameHe: { type: String, required: true },
  hex: { type: String, required: true },
  stock: { type: Boolean, default: true },
  active: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false }
});

export default mongoose.model<IFilament>('Filament', FilamentSchema);
