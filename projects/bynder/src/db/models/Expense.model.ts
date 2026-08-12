import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
    userId: mongoose.Types.ObjectId;
    title: string;
    amount: number;
    category: string;
    date: Date;
    type: 'income' | 'expense';
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const ExpenseSchema: Schema = new Schema(
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
        category: {
            type: String,
            required: true,
            default: 'General',
        },
        date: {
            type: Date,
            required: true,
            default: Date.now,
        },
        type: {
            type: String,
            enum: ['income', 'expense'],
            required: true,
            default: 'expense',
        },
        notes: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
