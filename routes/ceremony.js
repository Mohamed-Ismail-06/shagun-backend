const express = require('express');
const router = express.Router();
const { 
  createCeremony, 
  getCeremonies, 
  getCeremonyById, 
  updateCeremony, 
  deleteCeremony
} = require('../controller/ceremonyController');
const { protect } = require('../middleware/auth');

// @route   POST /api/ceremonies
// @access  Private
router.post('/', protect, createCeremony);

// @route   GET /api/ceremonies
// @access  Private
router.get('/', protect, getCeremonies);

// @route   GET /api/ceremonies/:id
// @access  Private
router.get('/:id', protect, getCeremonyById);

// @route   PUT /api/ceremonies/:id
// @access  Private
router.put('/:id', protect, updateCeremony);

// @route   DELETE /api/ceremonies/:id
// @access  Private
router.delete('/:id', protect, deleteCeremony);

module.exports = router;
