import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderModel {
  name: string;
  size: number;
  material: string;
  color: string;
  infill: number;
  layerHeight: number;
  quantity: number;
  weightg: number;
  timeSeconds: number;
  price: number;
  fileKey?: string;
}

export interface IOrder extends Document {
  id: string; // e.g. P3D-123456
  customer: mongoose.Types.ObjectId; // Reference to Customer document
  comments?: string;
  models: IOrderModel[];
  subtotal: number;
  vatAmount: number;
  totalWithVat: number;
  status: 'pending' | 'slicing' | 'printing' | 'completed' | 'shipped';
  createdAt: Date;
  thingiverseUrl?: string;
  thingiverseName?: string;
}

const OrderModelSchema = new Schema({
  name: { type: String, required: true },
  size: { type: Number, required: true },
  material: { type: String, required: true },
  color: { type: String, required: true },
  infill: { type: Number, required: true },
  layerHeight: { type: Number, required: true },
  quantity: { type: Number, required: true },
  weightg: { type: Number, required: true },
  timeSeconds: { type: Number, required: true },
  price: { type: Number, required: true },
  fileKey: { type: String }
});

const OrderSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  comments: { type: String, default: '' },
  models: [OrderModelSchema],
  subtotal: { type: Number, required: true },
  vatAmount: { type: Number, required: true },
  totalWithVat: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'slicing', 'printing', 'completed', 'shipped'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
  thingiverseUrl: { type: String, default: '' },
  thingiverseName: { type: String, default: '' }
});

export default mongoose.model<IOrder>('Order', OrderSchema);
