import mongoose, { Schema, Document } from 'mongoose';

export interface IHabit extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    type: 'good' | 'bad';
    category: string;
    frequency: 'daily' | 'weekly';
    color: string;
    icon?: string;
    logs: {
        date: string; // YYYY-MM-DD
        status: 'completed' | 'failed' | 'skipped';
        notes?: string;
        mood?: number;
    }[];
    updates: {
        date: Date;
        text: string;
    }[];
    streak: number;
    createdAt: Date;
    updatedAt: Date;
}

const HabitSchema: Schema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
        },
        type: {
            type: String,
            enum: ['good', 'bad'],
            required: true,
            default: 'good',
        },
        category: {
            type: String,
            required: true,
            default: 'Health',
        },
        frequency: {
            type: String,
            enum: ['daily', 'weekly'],
            default: 'daily',
        },
        color: {
            type: String,
            default: '#3b82f6',
        },
        icon: {
            type: String,
        },
        logs: [
            {
                date: { type: String, required: true },
                status: { type: String, enum: ['completed', 'failed', 'skipped'], default: 'completed' },
                notes: { type: String },
                mood: { type: Number, min: 1, max: 5 }, // 1-5 scale
            }
        ],
        updates: [
            {
                date: { type: Date, default: Date.now },
                text: { type: String, required: true }
            }
        ],
        streak: {
            type: Number,
            default: 0,
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IHabit>('Habit', HabitSchema);
