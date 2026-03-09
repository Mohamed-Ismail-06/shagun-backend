const mongoose = require('mongoose');

const ceremonySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User',
  },
  weddingId: {
    type: String,
    required: true,
    trim: true,
  },
  organiserUpiId: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  ceremonyName: {
    type: String,
    required: true,
  },
  ceremonyDate: {
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

module.exports = mongoose.model('Ceremony', ceremonySchema);
