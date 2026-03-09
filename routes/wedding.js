const express = require('express');
const router = express.Router();
const { 
  createWedding, 
  getWeddings, 
  getWeddingById, 
  updateWedding, 

  
  deleteWedding
} = require('../controller/weddingController');
const { protect } = require('../middleware/auth');

// @route   POST /api/weddings
// @access  Private
router.post('/', protect, createWedding);

// @route   GET /api/weddings
// @access  Private
router.get('/', protect, getWeddings);

// @route   GET /api/weddings/:id
// @access  Private
router.get('/:id', protect, getWeddingById);

// @route   PUT /api/weddings/:id
// @access  Private
router.put('/:id', protect, updateWedding);

// @route   DELETE /api/weddings/:id
// @access  Private
router.delete('/:id', protect, deleteWedding);

module.exports = router;
