const crypto = require('crypto');
const mongoose = require('mongoose');
const QRCode = require('../model/QRCode');
const Wedding = require('../model/Wedding');
const Ceremony = require('../model/Ceremony');

// @desc    Generate a QR code payload for a wedding
// @route   POST /api/qr-codes/generate
// @access  Private
const generateQRCode = async (req, res) => {
  const { weddingId, guestLimit } = req.body;

  if (!weddingId || guestLimit === undefined) {
    return res.status(400).json({ message: 'weddingId and guestLimit are required' });
  }

  const normalizedWeddingId = String(weddingId).trim();
  if (!normalizedWeddingId) {
    return res.status(400).json({ message: 'weddingId cannot be empty' });
  }

  const parsedGuestLimit = Number(guestLimit);
  if (!Number.isInteger(parsedGuestLimit) || parsedGuestLimit <= 0) {
    return res.status(400).json({ message: 'guestLimit must be a positive integer' });
  }

  try {
    let wedding = null;
    const ceremony = await Ceremony.findOne({
      user: req.user._id,
      weddingId: normalizedWeddingId,
    }).sort({ createdAt: -1 });

    if (!ceremony) {
      return res.status(400).json({ message: 'No ceremony found for this wedding ID. Create ceremony first.' });
    }
    if (mongoose.Types.ObjectId.isValid(normalizedWeddingId)) {
      wedding = await Wedding.findOne({ _id: normalizedWeddingId, user: req.user._id });
    }

    const inviteCode = crypto.randomBytes(8).toString('hex');
    const resolvedWeddingName = wedding?.weddingName || ceremony?.ceremonyName || '';
    const merchantId = String(process.env.RAZORPAY_MERCHANT_ID || '').trim();
    const baseUrl = process.env.WEB_BASE_URL || 'https://mohamed-ismail-06.github.io/shagun';
    const paymentPageUrl = `${baseUrl}/payment.html?code=${inviteCode}&wedding=${encodeURIComponent(
      resolvedWeddingName || normalizedWeddingId
    )}`;
    const shareLink = paymentPageUrl;
    const paymentLink = paymentPageUrl;
    const organiserUpiId = ceremony.organiserUpiId || merchantId || 'razorpay';

    const qrRecord = await QRCode.create({
      user: req.user._id,
      wedding: wedding ? wedding._id : null,
      weddingId: wedding ? wedding._id.toString() : normalizedWeddingId,
      weddingName: resolvedWeddingName,
      organiserUpiId,
      guestLimit: parsedGuestLimit,
      inviteCode,
      shareLink,
      paymentLink,
      razorpayQrCodeId: '',
    });

    return res.status(201).json({
      _id: qrRecord._id,
      weddingId: qrRecord.weddingId,
      weddingName: qrRecord.weddingName,
      organiserUpiId: qrRecord.organiserUpiId,
      guestLimit: qrRecord.guestLimit,
      inviteCode: qrRecord.inviteCode,
      shareLink: qrRecord.shareLink,
      paymentLink: qrRecord.paymentLink,
      provider: 'payment_page',
      warning: '',
      razorpay: {
        qrCodeId: '',
        imageUrl: '',
        shortUrl: '',
        status: 'page_redirect',
      },
      generatedAt: qrRecord.generatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateQRCode,
};
