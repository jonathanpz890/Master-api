import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    color: {
        type: String,
        required: true,
    },
    description: { type: String },
}, { timestamps: true });

export const Category = mongoose.model('Category', CategorySchema);