import { Request, Response } from 'express';
import Watchlist from '../db/models/Watchlist.model.js';
import axios from 'axios';
import { logger } from '../logger.js';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.BYNDER_TMDB_API_KEY;

export const searchTMDB = async (req: Request, res: Response) => {
  try {
    const { query, type } = req.query;
    if (!TMDB_API_KEY || TMDB_API_KEY === 'undefined') {
      res
        .status(400)
        .json({ error: 'TMDB API Key is missing. Please add TMDB_API_KEY to your .env file.' });
      return;
    }
    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    const endpoint = type === 'tv' ? '/search/tv' : '/search/movie';
    const response = await axios.get(`${TMDB_BASE_URL}${endpoint}`, {
      params: {
        api_key: TMDB_API_KEY,
        query,
        language: 'en-US',
        page: 1,
        include_adult: false,
      },
    });

    res.json(response.data);
  } catch (error: any) {
    logger.error('TMDB search failed', error);
    res.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
};

export const getExploreContent = async (req: Request, res: Response) => {
  try {
    const { type } = req.query; // 'movie' or 'tv'
    if (!TMDB_API_KEY || TMDB_API_KEY === 'undefined') {
      res.status(400).json({ error: 'TMDB API Key is missing.' });
      return;
    }

    const t = type === 'tv' ? 'tv' : 'movie';

    const [trending, popular, topRated] = await Promise.all([
      axios.get(`${TMDB_BASE_URL}/trending/${t}/week`, { params: { api_key: TMDB_API_KEY } }),
      axios.get(`${TMDB_BASE_URL}/${t}/popular`, { params: { api_key: TMDB_API_KEY } }),
      axios.get(`${TMDB_BASE_URL}/${t}/top_rated`, { params: { api_key: TMDB_API_KEY } }),
    ]);

    res.json({
      sections: [
        { title: `Trending ${t === 'tv' ? 'Shows' : 'Movies'}`, items: trending.data.results },
        { title: `Popular Right Now`, items: popular.data.results },
        { title: `Top Rated`, items: topRated.data.results },
      ],
    });
  } catch (error: any) {
    logger.error('TMDB explore failed', error);
    res.status(500).json({ error: 'Failed to fetch explore content' });
  }
};

export const getWatchlist = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const items = await Watchlist.find({ userId }).sort({ updatedAt: -1 });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
};

export const addToWatchlist = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const itemData = { ...req.body, userId };

    // Check if already exists
    const existing = await Watchlist.findOne({
      userId,
      tmdbId: itemData.tmdbId,
      type: itemData.type,
    });

    if (existing) {
      res.status(400).json({ error: 'Item already in watchlist' });
      return;
    }

    const newItem = new Watchlist(itemData);
    await newItem.save();
    res.status(201).json({ item: newItem });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateWatchlistItem = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const updates = req.body;

    const item = await Watchlist.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true },
    );

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({ item });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update item' });
  }
};

export const deleteFromWatchlist = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const item = await Watchlist.findOneAndDelete({ _id: id, userId });

    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    res.json({ message: 'Item removed from watchlist' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete item' });
  }
};
