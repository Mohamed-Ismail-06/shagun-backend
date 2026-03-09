const mongoose = require('mongoose');

const qrCodeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    wedding: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wedding',
      default: null,
    },
    weddingId: {
      type: String,
      required: true,
      trim: true,
    },
    weddingName: {
      type: String,
      trim: true,
      default: '',
    },
    organiserUpiId: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    guestLimit: {
      type: Number,
      required: true,
      min: 1,
    },
    inviteCode: {
      type: String,
      required: true,
      trim: true,
    },
    shareLink: {
      type: String,
      required: true,
      trim: true,
    },
    paymentLink: {
      type: String,
      required: true,
      trim: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('QRCode', qrCodeSchema);
