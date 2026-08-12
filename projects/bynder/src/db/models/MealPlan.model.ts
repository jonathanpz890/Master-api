import mongoose from 'mongoose';

const MealPlanSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    meals: [{
        type: {
            type: String,
            enum: ['Breakfast', 'Lunch', 'Dinner', 'Snack'],
            required: true
        },
        recipeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe' },
        customName: { type: String },
        notes: { type: String },
        checked: { type: Boolean, default: false }
    }]
}, { timestamps: true });

// Ensure one entry per user per day
MealPlanSchema.index({ userId: 1, date: 1 }, { unique: true });

export const MealPlan = mongoose.model('MealPlan', MealPlanSchema);
