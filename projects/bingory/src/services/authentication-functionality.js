const bcrypt = require('bcrypt');
const User = require('../entities/models/user');
const Property = require('../entities/models/property');
const passport = require('passport');

module.exports = {
    createUser: async (req, res) => {
        try {
            const { name, phone, password } = req.body;
            const userExists = await User.findOne({ phone });
            if (userExists) {
                return res.status(400).json({ message: 'כבר קיים משתמש על המספר הזה' })
            }
            let user = new User({ name, phone, password })
            user.password = await bcrypt.hash(user.password, 10);
            await user.save();
            user = user.toObject();
            delete user.password;
            return res.status(201).json({
                success: true,
                data: {
                    user
                }
            });
        } catch (error) {
            return res.status(400).json({ error })
        }
    }
}