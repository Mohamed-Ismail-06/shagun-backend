const express = require('express');
const router = express.Router();
const { registerUser, loginUser, forgotPassword, resetPassword, getMe } = require('../controller/authController');
const { protect } = require('../middleware/auth');

// @route   POST /api/auth/register
router.post('/register', registerUser);

// @route   POST /api/auth/login
router.post('/login', loginUser);

// @route   POST /api/auth/forgotpassword
router.post('/forgotpassword', forgotPassword);

// @route   PUT /api/auth/resetpassword/:resettoken
router.put('/resetpassword/:resettoken', resetPassword);

// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, getMe);

module.exports = router;
