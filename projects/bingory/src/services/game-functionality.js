const BingoSession = require('../entities/models/BingoSession');
const user = require('../entities/models/user');

module.exports = {
    getGame: async (req, res) => {
        try {
            const game = await BingoSession.findById(req.params.id)
            return res.status(200).json({
                success: true,
                game
            })
        } catch (error) {
            return res.status(400).json({ error })
        }
    },
    userJoinGame: async (req, res) => {
        try {
            const { id, userId} = req.body;
            const game = await BingoSession.findById(id);
            let properties = game.properties;
            properties = properties.sort(() => Math.random() - 0.5).slice(0, 25);
            if (!game.users.includes(userId)) {
                await BingoSession.findByIdAndUpdate(id, {$push: {users: userId}})
                await user.findByIdAndUpdate(userId, {
                    $push: {
                        games: {_id: id, properties}
                    }
                })
            }
            res.sendStatus(200);
        } catch(error) {
            console.log(error)
        }
    }
}