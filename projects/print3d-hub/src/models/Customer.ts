import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone?: string;
  comments?: string;
  createdAt: Date;
}

const CustomerSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, default: '' },
  comments: { type: String },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ICustomer>('Customer', CustomerSchema);
