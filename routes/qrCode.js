const express = require('express');
const router = express.Router();
const { generateQRCode } = require('../controller/qrCodeController');
const { protect } = require('../middleware/auth');

// @route   POST /api/qr-codes/generate
// @access  Private
router.post('/generate', protect, generateQRCode);

module.exports = router;
