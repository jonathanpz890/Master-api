import mongoose, { Schema, Document } from 'mongoose-bynder';

export interface IDream extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  date: Date;
  clarity: number; // 1-5
  mood: string;
  tags: string[];
  isLucid: boolean;
  isNightmare: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DreamSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    clarity: { type: Number, min: 1, max: 5, default: 3 },
    mood: { type: String },
    tags: [{ type: String }],
    isLucid: { type: Boolean, default: false },
    isNightmare: { type: Boolean, default: false },
  },
  { timestamps: true },
);

DreamSchema.index({ userId: 1 });

export default mongoose.model<IDream>('Dream', DreamSchema);
