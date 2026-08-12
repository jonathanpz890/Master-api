import mongoose, { Schema, Document } from 'mongoose';

export interface IAchievement extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    icon?: string;
    color?: string;
    steps: {
        title: string;
        completed: boolean;
    }[];
    status: 'in_progress' | 'completed';
    createdAt: Date;
    updatedAt: Date;
}

const AchievementSchema: Schema = new Schema(
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
        icon: {
            type: String,
        },
        color: {
            type: String,
            default: '#10b981',
        },
        steps: [
            {
                title: { type: String, required: true },
                completed: { type: Boolean, default: false },
            }
        ],
        status: {
            type: String,
            enum: ['in_progress', 'completed'],
            default: 'in_progress',
        }
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IAchievement>('Achievement', AchievementSchema);
