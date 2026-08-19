const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = './entities/models/user';

const initialize = (passport) => {
    const authenticateUser = (phone, password, done) => {
        User.findOne({ phone }, (error, user) => {
            if (error) return done(error);
            if (!user) return done(null, false, { message: 'Incorrect phone number' });
            
            bcrypt.compare(password, user.password, (error, res) => {
                if (error) return done(error)
                if (!res) return done(null, false, { message: 'Incorrect password' });
                if (!user.verifyPassword(password)) { return done(null, false); }
                return done(null, user);
            })
        })
    }

    passport.use(new LocalStrategy({ usernameField: 'phone' }), authenticateUser)
    passport.serializeUser((user, done) => {
        done(null, user.id);
    })
    passport.deserializeUser((id, done) => {
        User.findById(id, (error, user) => {
            done(error, user);
        })
    })
}

module.exports = initialize