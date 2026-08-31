const BingoSession = require('../entities/models/BingoSession');
const User = require('../entities/models/user');
const { logger } = require('../logger');

// This palette intentionally has one color per hue family. It gives players a
// distinctly recognizable board without allowing near-duplicate yellows, blues,
// or greens in the same game.
const PLAYER_COLORS = [
  '#ef5a67', '#f28c3c', '#e3bd37', '#8dca45', '#37b86d',
  '#31b5a4', '#399fe5', '#6e7fe6', '#a16ddb', '#d25d9a',
];

const hexToRgb = color => {
  const normalized = color.replace('#', '');
  return [0, 2, 4].map(offset => Number.parseInt(normalized.slice(offset, offset + 2), 16));
};

const colorDistance = (first, second) => Math.sqrt(
  hexToRgb(first).reduce((total, channel, index) => total + (channel - hexToRgb(second)[index]) ** 2, 0),
);

const hslToHex = (hue, saturation = 68, lightness = 56) => {
  const chroma = (1 - Math.abs((2 * lightness / 100) - 1)) * saturation / 100;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const match = lightness / 100 - chroma / 2;
  const [red, green, blue] = hue < 60 ? [chroma, x, 0]
    : hue < 120 ? [x, chroma, 0]
      : hue < 180 ? [0, chroma, x]
        : hue < 240 ? [0, x, chroma]
          : hue < 300 ? [x, 0, chroma]
            : [chroma, 0, x];
  return `#${[red, green, blue].map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
};

const randomItem = items => items[Math.floor(Math.random() * items.length)];

const choosePlayerColor = assignedColors => {
  const colors = assignedColors.filter(Boolean);
  const generatedCandidates = Array.from({ length: 24 }, (_, index) => hslToHex((index * 15 + Math.floor(Math.random() * 15)) % 360));
  const candidates = [...PLAYER_COLORS, ...generatedCandidates]
    .filter((color, index, all) => all.indexOf(color) === index)
    .filter(candidate => colors.every(assigned => colorDistance(candidate, assigned) >= 95));

  if (candidates.length) return randomItem(candidates);

  // Large games can exhaust the well-separated palette. In that case, use the
  // candidate farthest from every existing color instead of duplicating one.
  return [...PLAYER_COLORS, ...generatedCandidates]
    .sort((first, second) => Math.min(...colors.map(color => colorDistance(second, color))) - Math.min(...colors.map(color => colorDistance(first, color))))[0];
};

const ensureParticipantColors = async game => {
  const participantIds = game.users || [];
  const participants = await User.find({ _id: { $in: participantIds } }).select('games');
  const assignedColors = participants.flatMap(participant => participant.games
    .filter(entry => entry._id.toString() === game._id.toString())
    .map(entry => entry.playerColor)
    .filter(Boolean));

  const updates = participants.flatMap(participant => participant.games
    .filter(entry => entry._id.toString() === game._id.toString() && !entry.playerColor)
    .map(entry => {
      entry.playerColor = choosePlayerColor(assignedColors);
      assignedColors.push(entry.playerColor);
      return participant.save();
    }));
  await Promise.all(updates);
};

module.exports = {
  createGame: async (req, res) => {
    try {
      const playerColor = choosePlayerColor([]);
      const game = await BingoSession.create({
        title: req.body.title.trim(),
        creator: req.body.creator?.trim(),
        about: req.body.about?.trim(),
        visibility: req.body.visibility === 'public' ? 'public' : 'private',
        properties: req.body.properties.map(({ title }) => ({ title: title.trim() })),
        users: [req.user._id],
      });

      const properties = game.properties
        .sort(() => Math.random() - 0.5)
        .slice(0, 25)
        .map((property) => ({ _id: property._id, title: property.title, marked: false }));
      const user = await User.findByIdAndUpdate(
        req.user._id,
        { $push: { games: { _id: game._id, properties, playerColor } } },
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
      const game = await BingoSession.findById(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      await ensureParticipantColors(game);
      if (req.query.populateUsers === 'true') await game.populate('users', 'name email games');
      return res.status(200).json({
        success: true,
        game,
      });
    } catch (error) {
      logger.error('Fetching game failed', error);
      return res.status(400).json({ error: 'Invalid game id' });
    }
  },
  getMyGames: async (req, res) => {
    try {
      const games = await BingoSession.find({ users: req.user._id })
        .select('title creator about color visibility users')
        .sort({ _id: -1 })
        .lean();
      return res.status(200).json({ success: true, games });
    } catch (error) {
      logger.error('Fetching user games failed', error);
      return res.status(500).json({ error: 'Unable to fetch user games' });
    }
  },
  explorePublicGames: async (req, res) => {
    try {
      const query = req.query.q?.trim();
      const filters = { visibility: 'public' };
      if (query) {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filters.$or = [
          { title: { $regex: escapedQuery, $options: 'i' } },
          { about: { $regex: escapedQuery, $options: 'i' } },
        ];
      }
      const games = await BingoSession.find(filters)
        .select('title about users visibility')
        .sort({ _id: -1 })
        .limit(50)
        .lean();
      return res.status(200).json({ success: true, games });
    } catch (error) {
      logger.error('Exploring public games failed', error);
      return res.status(500).json({ error: 'Unable to explore public games' });
    }
  },
  createComment: async (req, res) => {
    try {
      const game = await BingoSession.findById(req.params.gameId);
      if (!game) return res.status(404).json({ error: 'Game not found' });
      const isParticipant = game.users.some((id) => id.toString() === req.user._id.toString());
      if (!isParticipant) return res.status(403).json({ error: 'Only game participants can comment' });

      const comment = {
        author: req.user._id,
        authorName: req.user.name,
        text: req.body.text.trim(),
      };
      game.comments.push(comment);
      await game.save();
      return res.status(201).json({ success: true, comment: game.comments[game.comments.length - 1] });
    } catch (error) {
      logger.error('Creating game comment failed', error);
      return res.status(400).json({ error: 'Unable to create comment' });
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
        await ensureParticipantColors(game);
        const participantUsers = await User.find({ _id: { $in: game.users } }).select('games');
        const assignedColors = participantUsers.flatMap(participant => participant.games
          .filter(entry => entry._id.toString() === gameId)
          .map(entry => entry.playerColor)
          .filter(Boolean));
        const playerColor = choosePlayerColor(assignedColors);
        await BingoSession.findByIdAndUpdate(gameId, { $push: { users: userId } });
        await User.findByIdAndUpdate(userId, {
          $push: {
            games: { _id: gameId, properties, playerColor },
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
