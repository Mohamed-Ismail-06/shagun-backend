const express = require('express');
const router = express.Router();
const { recordPayment, getPaymentsByInviteCode, getAllPayments } = require('../controller/paymentController');
const { protect } = require('../middleware/auth');

// @route   POST /api/payments/record
// @access  Public
router.post('/record', recordPayment);

// @route   GET /api/payments/:inviteCode
// @access  Private
router.get('/:inviteCode', protect, getPaymentsByInviteCode);

// @route   GET /api/payments
// @access  Private
router.get('/', protect, getAllPayments);

module.exports = router;

