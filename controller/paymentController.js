const Payment = require('../model/Payment');
const QRCode = require('../model/QRCode');
const crypto = require('crypto');

// @desc    Record a payment from guest
// @route   POST /api/payments/record
// @access  Public
const recordPayment = async (req, res) => {
  try {
    const { inviteCode, guestName, relation, amount, upiId, weddingName, paymentStatus } = req.body;

    if (!inviteCode || !guestName || !relation || !amount || !upiId) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const payment = await Payment.create({
      inviteCode,
      guestName,
      relation,
      amount,
      upiId,
      weddingName: weddingName || '',
      paymentStatus: paymentStatus || 'pending'
    });

    return res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all payments for an invite code
// @route   GET /api/payments/:inviteCode
// @access  Private
const getPaymentsByInviteCode = async (req, res) => {
  try {
    const payments = await Payment.find({ inviteCode: req.params.inviteCode }).sort({ createdAt: -1 });
    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Get all payments for a user
// @route   GET /api/payments
// @access  Private
const getAllPayments = async (req, res) => {
  try {
    const { weddingId } = req.query;
    let query = {};
    
    if (weddingId) {
      query.$or = [
        { inviteCode: { $regex: weddingId, $options: 'i' } },
        { weddingName: { $regex: weddingId, $options: 'i' } }
      ];
    }
    
    const payments = await Payment.find(query).sort({ createdAt: -1 });
    return res.status(200).json(payments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Add a ledger entry (manual cash/gift entry)
// @route   POST /api/payments/ledger
// @access  Private
const addLedgerEntry = async (req, res) => {
  try {
    const { guestName, weddingId, amount, giftType, date } = req.body;

    if (!guestName || !amount || !giftType) {
      return res.status(400).json({ message: 'Guest name, amount, and gift type are required' });
    }

    const entry = await Payment.create({
      inviteCode: weddingId || 'manual',
      guestName,
      relation: giftType, // Using relation field to store gift type
      amount: parseInt(amount),
      upiId: 'manual-entry',
      weddingName: weddingId || '',
      paymentStatus: 'completed',
      paymentTime: date || new Date()
    });

    return res.status(201).json({
      success: true,
      data: entry
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const verifyRazorpayWebhookSignature = (rawBody, signature, secret) => {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return digest === signature;
};

const toRupees = (paiseAmount) => {
  const value = Number(paiseAmount || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }
  return Math.round(value / 100);
};

const normalizeText = (value, fallback) => {
  const text = String(value || '').trim();
  return text || fallback;
};

// @desc    Receive Razorpay webhook events and auto-record QR payments
// @route   POST /api/webhooks/razorpay
// @access  Public
const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;

    if (!webhookSecret) {
      return res.status(500).json({ message: 'RAZORPAY_WEBHOOK_SECRET is not configured.' });
    }

    if (!signature || !Buffer.isBuffer(rawBody)) {
      return res.status(400).json({ message: 'Invalid webhook payload.' });
    }

    const isSignatureValid = verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret);
    if (!isSignatureValid) {
      return res.status(401).json({ message: 'Invalid webhook signature.' });
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = payload?.event;

    // We process payment.captured and qr_code.credited events for QR flows.
    if (event !== 'payment.captured' && event !== 'qr_code.credited') {
      return res.status(200).json({ success: true, message: `Event ${event} ignored.` });
    }

    const paymentEntity = payload?.payload?.payment?.entity;
    if (!paymentEntity?.id) {
      return res.status(200).json({ success: true, message: 'No payment entity found in webhook.' });
    }

    const existingPayment = await Payment.findOne({ paymentId: paymentEntity.id });
    if (existingPayment) {
      return res.status(200).json({ success: true, message: 'Payment already recorded.' });
    }

    const qrEntity = payload?.payload?.qr_code?.entity;
    const notes = {
      ...(paymentEntity?.notes || {}),
      ...(qrEntity?.notes || {}),
    };

    const qrCodeId = normalizeText(
      qrEntity?.id || paymentEntity?.acquirer_data?.qr_code_id || paymentEntity?.qr_code_id,
      ''
    );

    let linkedQr = null;
    if (qrCodeId) {
      linkedQr = await QRCode.findOne({ razorpayQrCodeId: qrCodeId }).sort({ createdAt: -1 });
    }

    if (!linkedQr && notes.inviteCode) {
      linkedQr = await QRCode.findOne({ inviteCode: String(notes.inviteCode) }).sort({ createdAt: -1 });
    }

    const inviteCode = normalizeText(notes.inviteCode, linkedQr?.inviteCode || qrCodeId || 'razorpay');
    const weddingName = normalizeText(notes.weddingName, linkedQr?.weddingName || '');
    const upiId = normalizeText(
      paymentEntity?.upi?.vpa || paymentEntity?.acquirer_data?.vpa,
      linkedQr?.organiserUpiId || 'razorpay-upi'
    );

    const createdRecord = await Payment.create({
      inviteCode,
      guestName: normalizeText(paymentEntity?.email || paymentEntity?.contact, 'Razorpay Guest'),
      relation: 'QR Payment',
      amount: toRupees(paymentEntity?.amount),
      upiId,
      weddingName,
      paymentStatus: paymentEntity?.status === 'captured' ? 'completed' : 'pending',
      paymentId: paymentEntity.id,
      paymentTime: paymentEntity?.captured_at
        ? new Date(paymentEntity.captured_at * 1000)
        : new Date(),
    });

    return res.status(200).json({
      success: true,
      message: 'Webhook processed and payment recorded.',
      data: {
        paymentId: createdRecord.paymentId,
        inviteCode: createdRecord.inviteCode,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  recordPayment,
  getPaymentsByInviteCode,
  getAllPayments,
  addLedgerEntry,
  handleRazorpayWebhook
};

