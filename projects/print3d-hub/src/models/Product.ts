import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  slug: string;
  nameEn: string;
  nameHe: string;
  descriptionEn: string;
  descriptionHe: string;
  categoryEn: string;
  categoryHe: string;
  imageUrl: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
}

const ProductSchema: Schema = new Schema({
  slug: { type: String, required: true, unique: true, index: true, match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/ },
  nameEn: { type: String, required: true, maxlength: 160 },
  nameHe: { type: String, required: true, maxlength: 160 },
  descriptionEn: { type: String, default: '', maxlength: 2000 },
  descriptionHe: { type: String, default: '', maxlength: 2000 },
  categoryEn: { type: String, default: 'Organization', maxlength: 80 },
  categoryHe: { type: String, default: 'ארגון', maxlength: 80 },
  imageUrl: { type: String, default: '', maxlength: 2048 },
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IProduct>('Product', ProductSchema);
