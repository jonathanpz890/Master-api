import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    icon: { type: String, required: true },
    description: { type: String },

    fields: [{
        name: { type: String, required: true },
        field: { type: String, required: true },
        type: {
            type: String,
            enum: ['text', 'checkbox', 'number', 'date', 'select', 'multiselect', 'sublist', 'image'],
            required: true,
        },
        options: [mongoose.Schema.Types.Mixed],
        required: { type: Boolean, default: false },
        defaultValue: mongoose.Schema.Types.Mixed,
    }],
    categories: [{
        name: { type: String, required: true },
    }],
    settings: {
        sectioned: { type: Boolean, default: false },
        sortable: { type: Boolean, default: true },
        checkable: { type: Boolean, default: false },
        allowMultipleSections: { type: Boolean, default: false },
        groupBy: { type: String, default: null },
        colorTheme: { type: String, default: null },
        viewType: {
            type: String,
            enum: ['list', 'grid', 'board'],
            default: 'list',
        },
        sharingAllowed: { type: Boolean, default: true },
        allowCustomFields: { type: Boolean, default: true },
    },

    metadata: {
        category: { type: String },
        tags: [String],
        recommended: { type: Boolean, default: false },
        popularity: { type: Number, default: 0 },
    }
}, { timestamps: true });

export const Template = mongoose.model('Template', TemplateSchema);