const User = require('../entities/models/user');

module.exports = {
    getAllUsers: async (req, res) => {
        try {
            const users = await User.find().populate({ path: 'properties' }).select('-password');
            return res.status(200).json({
                success: true,
                data: {
                    users
                }
            })
        } catch (error) {
            return res.status(400).json({ error })
        }
    },
    updateUser: async (req, res) => {
        const { id, gameId, propertyId, marked } = req.body;
        try {
            const user = await User.findById(id);
            const props = user.games
                .find(game => game._id === gameId)
                .properties;
            props.find(prop => prop._id.toString() === propertyId).marked = marked;
            User.findOneAndUpdate(
                { 
                    _id: id,
                },
                { $set: { 'games.$[game].properties': props } },
                { new: true, arrayFilters: [{'game._id': gameId}] },
                (err, updatedUser) => {
                    if (err) {
                        console.error({err});
                        return;
                    }
                    console.log(updatedUser);
                    return res.status(200).json({
                        success: true,
                        data: {
                            user: updatedUser
                        }
                    })
                }
            );
        } catch (error) {
            console.log(error);
            return res.status(400).json({ message: 'something failed' })
        }
    }
}