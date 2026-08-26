const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            requried: true
        },
        phone: {
            type: String,
            required: true
        },
        password: {
            type: String, 
            required: true
        },
        games: [{
            type: Object,
            _id: {
                type: mongoose.Objectid,
                ref: 'BingoSession',
                required: true
            },
            properties: [{
                type: Object,
                title: {
                    type: String,
                    required: true
                },
                marked: {
                    type: Boolean,
                    required: true,
                    default: false
                }
            }]
        }]
    }
)

UserSchema.plugin(passportLocalMongoose, { usernameField: 'phone' });
module.exports = mongoose.model('User', UserSchema);