const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  inviteCode: {
    type: String,
    required: true,
    index: true
  },
  weddingId: {
    type: String,
    default: '',
    index: true
  },
  guestName: {
    type: String,
    required: true
  },
  relation: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  upiId: {
    type: String,
    required: true
  },
  weddingName: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  paymentId: {
    type: String,
    default: ''
  },
  paymentOrderId: {
    type: String,
    default: '',
    index: true
  },
  paymentTime: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', paymentSchema);
