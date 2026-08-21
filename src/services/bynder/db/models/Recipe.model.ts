import mongoose from 'mongoose-bynder';

const IngredientSchema = new mongoose.Schema({
    ingredient: { type: mongoose.Schema.Types.Mixed },
    unit: { type: String },
    amount: { type: Number }
}, { _id: false });

const InstructionSchema = new mongoose.Schema({
    text: { type: String },
    type: { type: String, default: 'step' },
    ingredients: [IngredientSchema]
}, { _id: false });

const RecipeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    title: { type: String, required: true },
    image: { type: String },
    ingredients: { type: [IngredientSchema], default: [] },
    instructions: { type: [InstructionSchema], default: [] },
    category: { type: String, default: 'Other' },
    servings: { type: Number },
    prepTime: { type: String },
    cookTime: { type: String },
    cookingMethod: { type: String },
    ovenTemp: { type: String },
    airFryTemp: { type: String }
}, { timestamps: true });

// Serves the library query: find a user's recipes newest first.
RecipeSchema.index({ userId: 1, updatedAt: -1 });

export const Recipe = mongoose.model('Recipe', RecipeSchema);
