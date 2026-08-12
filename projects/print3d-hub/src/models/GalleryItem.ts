import mongoose, { Schema, Document } from 'mongoose';

export interface IGalleryItem extends Document {
  titleEn: string;
  titleHe: string;
  descEn: string;
  descHe: string;
  material: string;
  layerHeight: string;
  infill: string;
  weight: string;
  time: string;
  imageUrl: string;
  category: 'fdm' | 'flexible' | 'mechanical' | 'artistic';
  createdAt: Date;
}

const GalleryItemSchema: Schema = new Schema({
  titleEn: { type: String, required: true },
  titleHe: { type: String, required: true },
  descEn: { type: String, default: '' },
  descHe: { type: String, default: '' },
  material: { type: String, default: '' },
  layerHeight: { type: String, default: '' },
  infill: { type: String, default: '' },
  weight: { type: String, default: '' },
  time: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  category: { type: String, enum: ['fdm', 'flexible', 'mechanical', 'artistic'], required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IGalleryItem>('GalleryItem', GalleryItemSchema);
