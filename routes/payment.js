const express = require('express');
const router = express.Router();
const {
  recordPayment,
  getPaymentsByInviteCode,
  getAllPayments,
  addLedgerEntry,
  createOrderForGuest,
  verifyGuestPayment,
} = require('../controller/paymentController');
const { protect } = require('../middleware/auth');

// @route   POST /api/payments/record
// @access  Public
router.post('/record', recordPayment);

// @route   POST /api/payments/ledger
// @access  Private
router.post('/ledger', protect, addLedgerEntry);

// @route   POST /api/payments/create-order
// @access  Public
router.post('/create-order', createOrderForGuest);

// @route   POST /api/payments/verify
// @access  Public
router.post('/verify', verifyGuestPayment);

// @route   GET /api/payments/:inviteCode
// @access  Private
router.get('/:inviteCode', protect, getPaymentsByInviteCode);

// @route   GET /api/payments
// @access  Private
router.get('/', protect, getAllPayments);

module.exports = router;

