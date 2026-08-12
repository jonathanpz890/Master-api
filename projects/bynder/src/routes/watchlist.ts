import express from 'express';
import * as WatchlistServices from '../services/WatchlistServices.js';

const watchlistRouter = express.Router();

watchlistRouter.get('/', WatchlistServices.getWatchlist);
watchlistRouter.get('/search', WatchlistServices.searchTMDB);
watchlistRouter.get('/explore', WatchlistServices.getExploreContent);
watchlistRouter.post('/', WatchlistServices.addToWatchlist);
watchlistRouter.put('/:id', WatchlistServices.updateWatchlistItem);
watchlistRouter.delete('/:id', WatchlistServices.deleteFromWatchlist);

export default watchlistRouter;
