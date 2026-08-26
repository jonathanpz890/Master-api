const mongoose = require('mongoose-bingory');

const GamePropertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    marked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const BingoSessionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            unique: true
        },
        creator: {
            type: String,
            trim: true,
        },
        about: {
            type: String,
            trim: true,
        },
        properties: {
            type: [GamePropertySchema],
            validate: {
                validator: properties => properties.length >= 25,
                message: 'A game must contain at least 25 properties',
            },
        },
        color: {
            type: String,
            required: false,
            default: '#000000'
        },
        users: [{
            type: mongoose.ObjectId,
            required: false,
            ref: 'User'
        }]
    }
)
module.exports = mongoose.model('BingoSession', BingoSessionSchema);
