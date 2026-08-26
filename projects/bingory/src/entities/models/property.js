const mongoose = require('mongoose');

const PropertySchema = new mongoose.Schema(
    {
        male: {
            type: String,
            required: true
        },
        female: {
            type: String,
            required: true
        }
    }
)

module.exports = mongoose.model('Property', PropertySchema)