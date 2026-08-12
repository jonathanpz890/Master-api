const mongoose = require('mongoose');
const passportLocalMongoose = require('passport-local-mongoose');

const BingoSessionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            unique: true
        },
        properties: [{
            type: Object,
            required: true,
            male: {
                type: String,
                required: true,
            },
            female: {
                type: String, 
                required: true
            }
        }],
        color: {
            type: String,
            required: false,
            default: '#000000'
        },
        users: [{
            type: mongoose.ObjectId,
            required: false,
            ref: 'User',
            unique: true
        }]
    }
)
module.exports = mongoose.model('BingoSession', BingoSessionSchema);