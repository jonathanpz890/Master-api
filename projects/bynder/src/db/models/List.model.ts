import mongoose from 'mongoose';

const ListSchema = new mongoose.Schema({
    description: { type: String },
    title: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true, // e.g. 'shopping', 'recipe', 'project'
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    },
    icon: { type: String, required: true },
    fields: [{
        name: { type: String, required: true },
        field: { type: String },
        type: {
            type: String,
            enum: ['text', 'long_text', 'checkbox', 'number', 'date', 'select', 'multiselect', 'sublist', 'image'],
            required: true,
        },
        options: [mongoose.Schema.Types.Mixed],
        required: { type: Boolean, default: false },
        defaultValue: mongoose.Schema.Types.Mixed,
    }],
    categories: [{
        name: { type: String, required: true },
        color: { type: String }
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
            enum: ['list', 'checklist', 'table', 'grid', 'board'],
            default: 'list',
        },
        sharingAllowed: { type: Boolean, default: true },
        allowCustomFields: { type: Boolean, default: true },
        pinned: { type: Boolean, default: false },
        isDefault: { type: Boolean, default: false },
        checklist: { type: Boolean, default: false },
        sectionView: {
            type: String,
            enum: ['list', 'grid'],
            default: null
        },
    },
    metadata: {
        category: { type: String },
        tags: [String],
        recommended: { type: Boolean, default: false },
        popularity: { type: Number, default: 0 },
    },
    entries: {
        type: [new mongoose.Schema({}, { _id: true, strict: false })],
        default: [],
    }
}, { timestamps: true });

ListSchema.index({ userId: 1 });
ListSchema.index({ userId: 1, projectId: 1 });

export const List = mongoose.model('List', ListSchema);