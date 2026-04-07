const Payment = require('../model/Payment');
const QRCode = require('../model/QRCode');
const crypto = require('crypto');
const https = require('https');

// @desc    Record a payment from guest
// @route   POST /api/payments/record
// @access  Public
const recordPayment = async (req, res) => {
  try {
    const { inviteCode, weddingId, guestName, relation, amount, upiId, weddingName, paymentStatus } = req.body;

    if (!inviteCode || !guestName || !relation || !amount || !upiId) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const payment = await Payment.create({
      inviteCode,
      weddingId: weddingId || '',
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
        { weddingId: { $regex: weddingId, $options: 'i' } },
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
      weddingId: weddingId || '',
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

const createRazorpayOrder = (payload) =>
  new Promise((resolve, reject) => {
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeyId || !razorpayKeySecret) {
      reject(new Error('Razorpay keys are missing on server.'));
      return;
    }

    const body = JSON.stringify(payload);
    const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');

    const request = https.request(
      {
        hostname: 'api.razorpay.com',
        path: '/v1/orders',
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          let parsed = {};
          try {
            parsed = data ? JSON.parse(data) : {};
          } catch (_error) {
            reject(new Error('Invalid response from Razorpay order API.'));
            return;
          }

          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve(parsed);
            return;
          }

          const reason = parsed?.error?.description || parsed?.error?.reason || parsed?.error?.code;
          reject(new Error(reason || `Razorpay order API failed with status ${response.statusCode}.`));
        });
      }
    );

    request.on('error', (error) => reject(error));
    request.write(body);
    request.end();
  });

// @desc    Create Razorpay order for guest payment page
// @route   POST /api/payments/create-order
// @access  Public
const createOrderForGuest = async (req, res) => {
  try {
    const { inviteCode, guestName, relation, amount, weddingName } = req.body;

    if (!inviteCode || !guestName || !relation || !amount) {
      return res.status(400).json({ message: 'inviteCode, guestName, relation and amount are required.' });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than zero.' });
    }

    const amountInPaise = Math.round(parsedAmount * 100);
    const safeInvite = String(inviteCode).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'guest';
    const receipt = `rcpt_${safeInvite}_${Date.now()}`.slice(0, 40);
    const linkedQr = await QRCode.findOne({ inviteCode: String(inviteCode) }).sort({ createdAt: -1 });
    const resolvedWeddingId = normalizeText(linkedQr?.weddingId, '');
    const resolvedWeddingName = normalizeText(weddingName, linkedQr?.weddingName || '');

    const order = await createRazorpayOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        inviteCode: String(inviteCode),
        weddingId: resolvedWeddingId,
        guestName: String(guestName).slice(0, 64),
        relation: String(relation).slice(0, 64),
        weddingName: String(resolvedWeddingName || '').slice(0, 128),
      },
    });

    // Persist a pending row immediately so reports/ledger can reflect attempted payment quickly.
    // It will be finalized by verify API or webhook.
    await Payment.findOneAndUpdate(
      { paymentOrderId: order.id },
      {
        inviteCode: String(inviteCode),
        weddingId: resolvedWeddingId,
        guestName: String(guestName),
        relation: String(relation),
        amount: parsedAmount,
        upiId: 'razorpay',
        weddingName: String(resolvedWeddingName || ''),
        paymentStatus: 'pending',
        paymentOrderId: order.id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const verifyRazorpayPaymentSignature = ({ orderId, paymentId, signature, secret }) => {
  const expected = crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  return expected === signature;
};

// @desc    Verify Razorpay payment signature and persist successful payment
// @route   POST /api/payments/verify
// @access  Public
const verifyGuestPayment = async (req, res) => {
  try {
    const {
      inviteCode,
      guestName,
      relation,
      amount,
      weddingName,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    if (!inviteCode || !guestName || !relation || !amount || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'Missing required payment verification fields.' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'Razorpay key secret is missing on server.' });
    }

    const isValid = verifyRazorpayPaymentSignature({
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
      secret,
    });

    if (!isValid) {
      return res.status(400).json({ message: 'Invalid Razorpay payment signature.' });
    }

    const existing = await Payment.findOne({ paymentId: razorpayPaymentId });
    if (existing) {
      return res.status(200).json({ success: true, data: existing, message: 'Payment already recorded.' });
    }

    const linkedQr = await QRCode.findOne({ inviteCode: String(inviteCode) }).sort({ createdAt: -1 });
    const resolvedWeddingId = normalizeText(linkedQr?.weddingId, '');
    const resolvedWeddingName = normalizeText(weddingName, linkedQr?.weddingName || '');

    const payment = await Payment.findOneAndUpdate(
      { paymentOrderId: razorpayOrderId },
      {
        inviteCode: String(inviteCode),
        weddingId: resolvedWeddingId,
        guestName: String(guestName),
        relation: String(relation),
        amount: Number(amount),
        upiId: 'razorpay',
        weddingName: String(resolvedWeddingName || ''),
        paymentStatus: 'completed',
        paymentId: razorpayPaymentId,
        paymentOrderId: razorpayOrderId,
        paymentTime: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ success: true, data: payment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
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
    const weddingId = normalizeText(notes.weddingId, linkedQr?.weddingId || '');
    const weddingName = normalizeText(notes.weddingName, linkedQr?.weddingName || '');
    const upiId = normalizeText(
      paymentEntity?.upi?.vpa || paymentEntity?.acquirer_data?.vpa,
      linkedQr?.organiserUpiId || 'razorpay-upi'
    );

    const createdRecord = await Payment.findOneAndUpdate(
      { paymentOrderId: normalizeText(paymentEntity?.order_id, paymentEntity.id) },
      {
        inviteCode,
        weddingId,
        guestName: normalizeText(
          notes.guestName || paymentEntity?.email || paymentEntity?.contact,
          'Razorpay Guest'
        ),
        relation: normalizeText(notes.relation, 'QR Payment'),
        amount: toRupees(paymentEntity?.amount),
        upiId,
        weddingName,
        paymentStatus: paymentEntity?.status === 'captured' ? 'completed' : 'pending',
        paymentId: paymentEntity.id,
        paymentOrderId: normalizeText(paymentEntity?.order_id, ''),
        paymentTime: paymentEntity?.captured_at
          ? new Date(paymentEntity.captured_at * 1000)
          : new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

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
  handleRazorpayWebhook,
  createOrderForGuest,
  verifyGuestPayment,
};

