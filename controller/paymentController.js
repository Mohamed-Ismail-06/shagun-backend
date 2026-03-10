const Payment = require('../model/Payment');

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

module.exports = {
  recordPayment,
  getPaymentsByInviteCode,
  getAllPayments,
  addLedgerEntry
};

