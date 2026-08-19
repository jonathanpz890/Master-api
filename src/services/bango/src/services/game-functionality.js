const BingoSession = require('../entities/models/BingoSession');
const user = require('../entities/models/user');
const { logger } = require('../logger');

module.exports = {
  getGame: async (req, res) => {
    try {
      const game = await BingoSession.findById(req.params.id);
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
      const { userId } = req.body;
      const gameId = req.body.gameId ?? req.body.id;
      const game = await BingoSession.findById(gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      let properties = game.properties;
      properties = properties.sort(() => Math.random() - 0.5).slice(0, 25);
      const hasJoined = game.users.some((id) => id.toString() === userId);
      if (!hasJoined) {
        await BingoSession.findByIdAndUpdate(gameId, { $push: { users: userId } });
        await user.findByIdAndUpdate(userId, {
          $push: {
            games: { _id: gameId, properties },
          },
        });
      }
      logger.info('User joined game', { gameId, alreadyJoined: hasJoined });
      return res.sendStatus(200);
    } catch (error) {
      logger.error('Joining game failed', error);
      return res.status(400).json({ error: 'Unable to join game' });
    }
  },
};
