import mongoose, { Schema, Document } from 'mongoose';

export interface IModelingRequest extends Document {
  id: string;
  name: string;
  email: string;
  phone?: string;
  projectName: string;
  description: string;
  dimensions: string;
  notes: string;
  status: 'new' | 'reviewing' | 'quoted' | 'in_progress' | 'completed';
  createdAt: Date;
}

const ModelingRequestSchema: Schema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, default: '' },
  projectName: { type: String, required: true },
  description: { type: String, required: true },
  dimensions: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { 
    type: String, 
    enum: ['new', 'reviewing', 'quoted', 'in_progress', 'completed'], 
    default: 'new' 
  },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IModelingRequest>('ModelingRequest', ModelingRequestSchema);
