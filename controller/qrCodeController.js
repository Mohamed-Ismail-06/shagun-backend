const crypto = require('crypto');
const https = require('https');
const mongoose = require('mongoose');
const QRCode = require('../model/QRCode');
const Wedding = require('../model/Wedding');
const Ceremony = require('../model/Ceremony');

const createRazorpayQrCode = (payload) =>
  new Promise((resolve, reject) => {
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      reject(new Error('Razorpay keys are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.'));
      return;
    }

    const data = JSON.stringify(payload);
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');

    const request = https.request(
      {
        hostname: 'api.razorpay.com',
        path: '/v1/payments/qr_codes',
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (response) => {
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          let parsed;

          try {
            parsed = body ? JSON.parse(body) : {};
          } catch (error) {
            reject(new Error('Invalid Razorpay response while creating QR code.'));
            return;
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }

          const razorpayError = parsed?.error?.description || parsed?.error?.reason || parsed?.error?.code;
          reject(new Error(razorpayError || `Razorpay QR creation failed with status ${response.statusCode}.`));
        });
      }
    );

    request.on('error', (error) => {
      reject(error);
    });

    request.write(data);
    request.end();
  });

const buildQrImageUrl = (text) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;

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
    const resolvedWeddingName = wedding?.weddingName || ceremony?.ceremonyName || '';
    const merchantId = String(process.env.RAZORPAY_MERCHANT_ID || '').trim();
    const displayName = (resolvedWeddingName || `Wedding ${normalizedWeddingId}`).slice(0, 64);
    const description = `Shagun payment for ${displayName}`.slice(0, 255);
    const organizerName = (req.user?.name || 'Shagun Organiser').slice(0, 40);
    const noteText = resolvedWeddingName
      ? `Shagun payment for ${resolvedWeddingName}`
      : `Shagun payment for wedding ${normalizedWeddingId}`;

    let razorpayQr = null;
    let shareLink = '';
    let paymentLink = '';
    let provider = 'razorpay';
    let warning = '';

    try {
      // Razorpay API expects amount in paise if fixed_amount=true.
      // We keep this QR as multiple_use + variable amount so guests can pay any value.
      razorpayQr = await createRazorpayQrCode({
        type: 'upi_qr',
        name: `Shagun ${displayName}`.slice(0, 40),
        usage: 'multiple_use',
        fixed_amount: false,
        description,
        notes: {
          inviteCode,
          weddingId: normalizedWeddingId,
          weddingName: resolvedWeddingName || normalizedWeddingId,
        },
      });

      if (!razorpayQr?.id || !razorpayQr?.image_url) {
        throw new Error('Razorpay did not return a valid QR code.');
      }

      shareLink = razorpayQr.image_url;
      paymentLink = razorpayQr.short_url || razorpayQr.image_url;
    } catch (razorpayError) {
      // Fallback: generate direct UPI QR so host can still collect payments.
      provider = 'upi_fallback';
      warning = `Razorpay unavailable: ${razorpayError.message}`;
      paymentLink = `upi://pay?pa=${encodeURIComponent(ceremony.organiserUpiId)}&pn=${encodeURIComponent(
        organizerName
      )}&tn=${encodeURIComponent(noteText)}&cu=INR`;
      shareLink = buildQrImageUrl(paymentLink);
    }

    const organiserUpiId = ceremony.organiserUpiId || merchantId || 'razorpay-qr';

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
      razorpayQrCodeId: razorpayQr?.id || '',
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
      provider,
      warning,
      razorpay: {
        qrCodeId: razorpayQr?.id || '',
        imageUrl: razorpayQr?.image_url || '',
        shortUrl: razorpayQr?.short_url || '',
        status: razorpayQr?.status || (provider === 'upi_fallback' ? 'fallback' : 'active'),
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
