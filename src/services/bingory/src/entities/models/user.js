const mongoose = require('mongoose-bingory');

const AssignedPropertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    marked: { type: Boolean, default: false },
  },
  { _id: true },
);

const UserGameSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'BingoSession', required: true },
    properties: { type: [AssignedPropertySchema], required: true },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String, 
            required: true
        },
        games: { type: [UserGameSchema], default: [] },
    }
)

module.exports = mongoose.model('User', UserSchema);
