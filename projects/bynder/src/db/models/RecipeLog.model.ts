import mongoose from 'mongoose';

const RecipeLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    recipeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe',
        required: true,
    },
    image: { type: String },
    notes: { type: String },
    rating: { type: Number, min: 1, max: 5 },
    date: { type: Date, default: Date.now }
}, { timestamps: true });

export const RecipeLog = mongoose.model('RecipeLog', RecipeLogSchema);
