require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const legacyMongooseURI = `${process.env.DB_PROTOCOL}${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}`;
const mongooseURI = process.env.MONGO_URI || (process.env.DB_HOST ? legacyMongooseURI : 'mongodb://localhost:27017/bango');
const APIRoutes = require('./src/routes/config.js')
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const MongoStore = require('connect-mongo');
const User = require('./src/entities/models/user');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser')
const BingoSession = mongoose.model('BingoSession');
const Property = mongoose.model('Property');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors({
	origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
	methods: 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
	credentials: true,
    allowedHeaders: 'Origin, X-Requested-With, Content-Type, X-Access-Token, Accept'

}));
if (process.env.NODE_ENV !== 'dev' && process.env.NODE_ENV !== 'localhost') {
    app.set('trust proxy', 1);
}
app.use(cookieParser())
app.use(session({
    name: 'bango.sid',
    secret: process.env.SESSION_SECRET || 'development-only-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
        path: process.env.SESSION_COOKIE_PATH || '/',
        secure: process.env.NODE_ENV !== 'dev',
        httpOnly: process.env.NODE_ENV !== 'dev',
        maxAge: 36000000000,
        sameSite: process.env.NODE_ENV !== 'dev' ? 'none' : 'lax'
    },
    store: MongoStore.create({
        mongoUrl: mongooseURI
    })
}))
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({usernameField: 'phone'}, (phone, password, done) => {
    User.findOne({ phone }, {}, (error, user) => {
        if (error) return done(error);
        if (!user) return done(null, false, { message: 'Incorrect phone number' });
        
        bcrypt.compare(password, user.password, (error, res) => {
            if (error) return done(error)
            if (!res) return done(null, false, { message: 'Incorrect password' });
            return done(null, user);
        })
    })
}))
passport.serializeUser((user, done) => {
    done(null, user.id);
});
passport.deserializeUser((id, done) => {
    User.findById(id, {}, (err, user) => {
        done(err, user);
    });
});

// app.get('/', async (req, res) => {
//     const properties = await Property.find()
//     const newBingo = new BingoSession({
//         title: 'בינגו מין',
//         properties,
//     })
//     newBingo.save();
// })
app.use('/', APIRoutes);

const startServer = async () => {
    try {
        await mongoose.connect(mongooseURI)
        app.listen(process.env.PORT, () => {
            console.log('App running.')
        })
    } catch (error) {
        console.log(error);
        process.exit(0);
    }
}

startServer();
