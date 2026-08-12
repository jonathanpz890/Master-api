import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'USD'
    },
    cycle: {
        type: String,
        enum: ['Monthly', 'Yearly', 'Weekly', 'Daily'],
        default: 'Monthly'
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    nextPaymentDate: {
        type: Date
    },
    category: {
        type: String,
        default: 'Other'
    },
    logo: {
        type: String // Optional: could be a URL or icon identifier
    },
    notes: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export const Subscription = mongoose.model('Subscription', SubscriptionSchema);
