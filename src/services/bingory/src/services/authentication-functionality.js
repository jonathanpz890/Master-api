const bcrypt = require('bcrypt');
const User = require('../entities/models/user');
const { logger } = require('../logger');

module.exports = {
  createUser: async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();
      const userExists = await User.findOne({ email: normalizedEmail });
      if (userExists) {
        return res.status(400).json({ message: 'כבר קיים חשבון עם כתובת האימייל הזו' });
      }
      let user = new User({ name: name.trim(), email: normalizedEmail, password });
      user.password = await bcrypt.hash(user.password, 10);
      await user.save();
      user = user.toObject();
      delete user.password;
      return res.status(201).json({
        success: true,
        data: {
          user,
        },
      });
    } catch (error) {
      logger.error('Registering Bingory user failed', error);
      return res.status(400).json({ error: 'Unable to register user' });
    }
  },
};
