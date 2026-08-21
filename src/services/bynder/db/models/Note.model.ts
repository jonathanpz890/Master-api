import mongoose from 'mongoose-bynder';

const NoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    title: {
      type: String,
      required: true,
      default: 'Untitled Note',
    },
    content: {
      type: String,
      default: '',
    },
    color: {
      type: String,
      default: '#ffffff',
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    archived: {
      type: Boolean,
      default: false,
    },
    tags: [String],
    images: [
      {
        url: { type: String, required: true },
        caption: { type: String },
        createdAt: { type: Date, default: Date.now },
        x: { type: Number, default: 50 },
        y: { type: Number, default: 50 },
        width: { type: Number, default: 200 },
        height: { type: Number, default: 200 },
        rotation: { type: Number, default: 0 },
      },
    ],
    doodle: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

NoteSchema.index({ userId: 1 });
NoteSchema.index({ userId: 1, pinned: 1, archived: 1 });

export const Note = mongoose.model('Note', NoteSchema);
