const express = require('express');
const router = express.Router();
const { recordPayment, getPaymentsByInviteCode, getAllPayments, addLedgerEntry } = require('../controller/paymentController');
const { protect } = require('../middleware/auth');

// @route   POST /api/payments/record
// @access  Public
router.post('/record', recordPayment);

// @route   POST /api/payments/ledger
// @access  Private
router.post('/ledger', protect, addLedgerEntry);

// @route   GET /api/payments/:inviteCode
// @access  Private
router.get('/:inviteCode', protect, getPaymentsByInviteCode);

// @route   GET /api/payments
// @access  Private
router.get('/', protect, getAllPayments);

module.exports = router;

