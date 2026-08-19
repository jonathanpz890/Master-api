const User = require('../entities/models/user');
const { logger } = require('../logger');

module.exports = {
  getAllUsers: async (req, res) => {
    try {
      const users = await User.find().populate({ path: 'properties' }).select('-password');
      return res.status(200).json({
        success: true,
        data: {
          users,
        },
      });
    } catch (error) {
      logger.error('Fetching users failed', error);
      return res.status(500).json({ error: 'Unable to fetch users' });
    }
  },
  updateUser: async (req, res) => {
    const { id, gameId, propertyId, marked } = req.body;
    try {
      const user = await User.findById(id);
      if (!user) return res.status(404).json({ error: 'User not found' });
      const game = user.games.find((entry) => entry._id.toString() === gameId);
      if (!game) return res.status(404).json({ error: 'Game is not assigned to this user' });
      const property = game.properties.find((entry) => entry._id.toString() === propertyId);
      if (!property)
        return res.status(404).json({ error: 'Property is not assigned to this game' });
      property.marked = marked;
      User.findOneAndUpdate(
        {
          _id: id,
        },
        { $set: { 'games.$[game].properties': game.properties } },
        { new: true, arrayFilters: [{ 'game._id': gameId }] },
        (err, updatedUser) => {
          if (err) {
            logger.error('User update database operation failed', err);
            return;
          }
          logger.info('User update completed', { userId: updatedUser?._id?.toString() });
          return res.status(200).json({
            success: true,
            data: {
              user: updatedUser,
            },
          });
        },
      );
    } catch (error) {
      logger.error('User update failed', error);
      return res.status(400).json({ message: 'something failed' });
    }
  },
};
