const mongoose = require('mongoose');

const weddingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  weddingName: {
    type: String,
    required: true,
  },
  groomName: {
    type: String,
    required: true,
  },
  brideName: {
    type: String,
    required: true,
  },
  weddingDate: {
    type: String,
    required: true,
  },
  venue: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Wedding', weddingSchema);
