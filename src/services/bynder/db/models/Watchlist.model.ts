import mongoose, { Schema, Document } from 'mongoose-bynder';

export interface IWatchlistItem extends Document {
    userId: mongoose.Types.ObjectId;
    tmdbId: number;
    title: string;
    type: 'movie' | 'tv';
    posterPath?: string;
    releaseDate?: string;
    rating?: number;
    overview?: string;
    status: 'planning' | 'watching' | 'completed' | 'dropped';
    progress?: number;
    totalEpisodes?: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const WatchlistSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    tmdbId: { type: Number, required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['movie', 'tv'], required: true },
    posterPath: { type: String },
    releaseDate: { type: String },
    rating: { type: Number },
    overview: { type: String },
    status: {
        type: String,
        enum: ['planning', 'watching', 'completed', 'dropped'],
        default: 'planning'
    },
    progress: { type: Number, default: 0 },
    totalEpisodes: { type: Number },
    notes: { type: String },
}, { timestamps: true });

// Ensure a user doesn't add the same movie/show twice
WatchlistSchema.index({ userId: 1, tmdbId: 1, type: 1 }, { unique: true });

export default mongoose.model<IWatchlistItem>('Watchlist', WatchlistSchema);
