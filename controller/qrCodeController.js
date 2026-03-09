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
    if (!ceremony.organiserUpiId) {
      return res.status(400).json({ message: 'Organiser UPI ID missing for this ceremony.' });
    }

    if (mongoose.Types.ObjectId.isValid(normalizedWeddingId)) {
      wedding = await Wedding.findOne({ _id: normalizedWeddingId, user: req.user._id });
    }

    const inviteCode = crypto.randomBytes(8).toString('hex');
    const organizerName = req.user?.name || 'Shagun Organiser';
    const resolvedWeddingName = wedding?.weddingName || ceremony?.ceremonyName || '';
    
    // Generate web payment page URL
    // This will redirect to a web page where guest selects relation and amount
    // Then the web page will open UPI with the amount

    const baseUrl = process.env.WEB_BASE_URL || 'https://mohamed-ismail-06.github.io/shagun';
    const paymentPageUrl = `${baseUrl}/payment.html?code=${inviteCode}&upi=${encodeURIComponent(ceremony.organiserUpiId)}&wedding=${encodeURIComponent(resolvedWeddingName)}`;
    
    // Keep direct UPI link for reference
    const noteText = resolvedWeddingName
      ? `Shagun payment for ${resolvedWeddingName}`
      : `Shagun payment for wedding ${normalizedWeddingId}`;
    const paymentLink = `upi://pay?pa=${encodeURIComponent(ceremony.organiserUpiId)}&pn=${encodeURIComponent(organizerName)}&tn=${encodeURIComponent(noteText)}&cu=INR`;
    
    const shareLink = paymentPageUrl; // QR code will contain web URL

    const qrRecord = await QRCode.create({
      user: req.user._id,
      wedding: wedding ? wedding._id : null,
      weddingId: wedding ? wedding._id.toString() : normalizedWeddingId,
      weddingName: resolvedWeddingName,
      organiserUpiId: ceremony.organiserUpiId,
      guestLimit: parsedGuestLimit,
      inviteCode,
      shareLink,
      paymentLink,
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
      generatedAt: qrRecord.generatedAt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateQRCode,
};
