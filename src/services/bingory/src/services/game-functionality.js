const BingoSession = require('../entities/models/BingoSession');
const User = require('../entities/models/user');
const { logger } = require('../logger');

module.exports = {
  createGame: async (req, res) => {
    try {
      const game = await BingoSession.create({
        title: req.body.title.trim(),
        creator: req.body.creator?.trim(),
        about: req.body.about?.trim(),
        properties: req.body.properties.map(({ title }) => ({ title: title.trim() })),
        users: [req.user._id],
      });

      const properties = game.properties
        .sort(() => Math.random() - 0.5)
        .slice(0, 25)
        .map((property) => ({ _id: property._id, title: property.title, marked: false }));
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $push: { games: { _id: game._id, properties } } },
        { new: true },
      ).select('-password');

      logger.info('Game created', { gameId: game._id.toString(), userId: req.user._id.toString() });
      return res.status(201).json({ success: true, game, user });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ errors: [{ msg: 'כבר קיים משחק עם השם הזה' }] });
      }
      logger.error('Creating game failed', error);
      return res.status(400).json({ errors: [{ msg: 'לא ניתן ליצור את המשחק' }] });
    }
  },
  getGame: async (req, res) => {
    try {
      const query = BingoSession.findById(req.params.gameId);
      if (req.query.populateUsers === 'true') query.populate('users', 'name email');
      const game = await query;
      if (!game) return res.status(404).json({ error: 'Game not found' });
      return res.status(200).json({
        success: true,
        game,
      });
    } catch (error) {
      logger.error('Fetching game failed', error);
      return res.status(400).json({ error: 'Invalid game id' });
    }
  },
  userJoinGame: async (req, res) => {
    try {
      const userId = req.user._id.toString();
      const { gameId } = req.body;
      const game = await BingoSession.findById(gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const properties = [...game.properties]
        .sort(() => Math.random() - 0.5)
        .slice(0, 25)
        .map((property) => ({ _id: property._id, title: property.title, marked: false }));
      const hasJoined = (game.users || []).some((id) => id.toString() === userId);
      if (!hasJoined) {
        await BingoSession.findByIdAndUpdate(gameId, { $push: { users: userId } });
        await User.findByIdAndUpdate(userId, {
          $push: {
            games: { _id: gameId, properties },
          },
        });
      }
      const [updatedGame, updatedUser] = await Promise.all([
        BingoSession.findById(gameId),
        User.findById(userId).select('-password'),
      ]);
      logger.info('User joined game', { gameId, alreadyJoined: hasJoined });
      return res.status(200).json({ success: true, game: updatedGame, user: updatedUser });
    } catch (error) {
      logger.error('Joining game failed', error);
      return res.status(400).json({ error: 'Unable to join game' });
    }
  },
};
