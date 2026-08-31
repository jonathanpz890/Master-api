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

const GameCommentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    createdAt: { type: Date, default: Date.now },
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
                validator: properties => properties.length >= 1,
                message: 'A game must contain at least one property',
            },
        },
        color: {
            type: String,
            required: false,
            default: '#000000'
        },
        visibility: {
            type: String,
            enum: ['public', 'private'],
            default: 'private',
        },
        users: [{
            type: mongoose.ObjectId,
            required: false,
            ref: 'User'
        }],
        comments: { type: [GameCommentSchema], default: [] },
    }
)
module.exports = mongoose.model('BingoSession', BingoSessionSchema);
