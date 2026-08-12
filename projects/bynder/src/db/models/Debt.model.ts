import mongoose, { Schema, Document } from 'mongoose';

export interface IDebt extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    amount: number;
    person: string;
    type: 'lent' | 'borrowed'; // lent = someone owes me, borrowed = I owe someone
    status: 'pending' | 'partially_paid' | 'paid';
    dueDate?: Date;
    notes?: string;
    totalPaid: number;
    payments: {
        amount: number;
        date: Date;
        note?: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
}

const DebtSchema: Schema = new Schema(
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
        amount: {
            type: Number,
            required: true,
        },
        person: {
            type: String,
            required: true,
            trim: true,
        },
        type: {
            type: String,
            enum: ['lent', 'borrowed'],
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'partially_paid', 'paid'],
            default: 'pending',
        },
        dueDate: {
            type: Date,
        },
        notes: {
            type: String,
        },
        totalPaid: {
            type: Number,
            default: 0,
        },
        payments: [
            {
                amount: { type: Number, required: true },
                date: { type: Date, default: Date.now },
                note: { type: String },
            },
        ],
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IDebt>('Debt', DebtSchema);
