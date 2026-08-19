import mongoose from 'mongoose-bynder';

const ProjectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    category: { type: String, default: 'General' },
    status: {
      type: String,
      enum: ['Not Started', 'In Progress', 'On Hold', 'Completed'],
      default: 'Not Started',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    startDate: { type: Date },
    dueDate: { type: Date },
    tags: [{ type: String }],
    budget: { type: Number, default: 0 },
    owner: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    color: { type: String, default: '#8b5cf6' },
    icon: { type: String, default: 'Work' },
    progress: { type: Number, default: 0 },
    activeTabs: [
      {
        tabId: { type: String, required: true },
        label: { type: String, required: true },
        type: { type: String, enum: ['dashboard', 'phase'], default: 'phase' },
        refId: { type: String }, // phaseId for phase tabs
      },
    ],
    phases: [
      {
        title: { type: String, required: true },
        type: { type: String, default: 'General' },
        status: {
          type: String,
          enum: ['Not Started', 'In Progress', 'Completed'],
          default: 'Not Started',
        },
        color: { type: String, default: '#8b5cf6' },
        progress: { type: Number, default: 0 },
        startDate: { type: Date },
        endDate: { type: Date },
        landmarks: [
          {
            title: { type: String, required: true },
            completed: { type: Boolean, default: false },
            type: { type: String, enum: ['text', 'checklist'], default: 'text' },
            content: { type: String },
            tasks: [
              {
                title: { type: String, required: true },
                completed: { type: Boolean, default: false },
                priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
              },
            ],
          },
        ],
        notes: { type: String, default: '' },
      },
    ],
    files: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        fileType: { type: String },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    moodboard: {
      doodles: { type: String },
      elements: [
        {
          id: { type: String },
          type: { type: String, enum: ['text', 'image'] },
          content: { type: String },
          x: { type: Number },
          y: { type: Number },
          width: { type: Number },
          height: { type: Number },
          rotation: { type: Number, default: 0 },
          scale: { type: Number, default: 1 },
        },
      ],
    },
    tasks: [
      {
        title: { type: String, required: true },
        completed: { type: Boolean, default: false },
        dueDate: { type: Date },
        priority: { type: String, enum: ['Low', 'Medium', 'High'] },
      },
    ],
    events: [
      {
        title: { type: String, required: true },
        description: { type: String },
        location: { type: String },
        date: { type: Date, required: true },
        time: { type: String },
      },
    ],
    notes: [
      {
        title: { type: String, required: true },
        content: { type: String, default: '' },
        color: { type: String, default: '#ffffff' },
        pinned: { type: Boolean, default: false },
        tags: [String],
        images: [
          {
            url: { type: String, required: true },
            caption: { type: String },
            x: { type: Number, default: 50 },
            y: { type: Number, default: 50 },
            width: { type: Number, default: 200 },
            height: { type: Number, default: 200 },
            rotation: { type: Number, default: 0 },
          },
        ],
        doodle: { type: String },
        metadata: { type: mongoose.Schema.Types.Mixed },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    intelligenceNotes: [
      {
        title: { type: String, default: '' },
        content: { type: String, default: '' },
        color: { type: String, default: '#ffffff' },
        pinned: { type: Boolean, default: false },
        tags: [String],
        phaseId: { type: String, default: null },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    lists: [
      {
        title: { type: String, required: true },
        description: { type: String },
        type: { type: String, required: true },
        icon: { type: String, required: true },
        phaseId: { type: String, default: null },
        fields: [
          {
            name: { type: String, required: true },
            field: { type: String },
            type: { type: String, required: true },
            options: [mongoose.Schema.Types.Mixed],
            required: { type: Boolean, default: false },
            defaultValue: mongoose.Schema.Types.Mixed,
          },
        ],
        settings: {
          viewType: { type: String, default: 'list' },
          pinned: { type: Boolean, default: false },
          colorTheme: { type: String },
        },
        entries: {
          type: [new mongoose.Schema({}, { _id: true, strict: false })],
          default: [],
        },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    // taskLists: array of { phaseId (null = general), listId ref }
    taskLists: [
      {
        phaseId: { type: String, default: null },
        listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
      },
    ],
    // Keep old taskList for backward compat during migration
    taskList: { type: mongoose.Schema.Types.ObjectId, ref: 'List' },
  },
  { timestamps: true },
);

ProjectSchema.index({ userId: 1 });

export const Project = mongoose.model('Project', ProjectSchema);
