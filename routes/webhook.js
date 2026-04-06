const express = require('express');
const router = express.Router();
const { handleRazorpayWebhook } = require('../controller/paymentController');

// Raw body is required for Razorpay signature verification.
router.post('/razorpay', handleRazorpayWebhook);

module.exports = router;
