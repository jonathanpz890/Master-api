import mongoose, { Schema } from 'mongoose';

const ScanResultSchema = new Schema({
    scanId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    candidates: { type: Schema.Types.Mixed, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // auto-delete after 10 minutes
});

export const ScanResult = mongoose.model('ScanResult', ScanResultSchema);
