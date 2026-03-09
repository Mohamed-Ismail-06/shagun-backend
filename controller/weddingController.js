const Wedding = require('../model/Wedding');

// @desc    Create a new wedding
// @route   POST /api/weddings
// @access  Private
const createWedding = async (req, res) => {
  const { weddingName, groomName, brideName, weddingDate, venue } = req.body;

  // Validation
  if (!weddingName || !groomName || !brideName || !weddingDate || !venue) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }

  try {
    const wedding = await Wedding.create({
      user: req.user._id,
      weddingName,
      groomName,
      brideName,
      weddingDate,
      venue,
    });

    res.status(201).json(wedding);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all weddings for current user
// @route   GET /api/weddings
// @access  Private
const getWeddings = async (req, res) => {
  try {
    const weddings = await Wedding.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(weddings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single wedding
// @route   GET /api/weddings/:id
// @access  Private
const getWeddingById = async (req, res) => {
  try {
    const wedding = await Wedding.findById(req.params.id);

    if (!wedding) {
      return res.status(404).json({ message: 'Wedding not found' });
    }

    // Check if user owns the wedding
    if (wedding.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to view this wedding' });
    }

    res.status(200).json(wedding);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update wedding
// @route   PUT /api/weddings/:id
// @access  Private
const updateWedding = async (req, res) => {
  try {
    const wedding = await Wedding.findById(req.params.id);

    if (!wedding) {
      return res.status(404).json({ message: 'Wedding not found' });
    }

    // Check if user owns the wedding
    if (wedding.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this wedding' });
    }

    const updatedWedding = await Wedding.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedWedding);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete wedding
// @route   DELETE /api/weddings/:id
// @access  Private
const deleteWedding = async (req, res) => {
  try {
    const wedding = await Wedding.findById(req.params.id);

    if (!wedding) {
      return res.status(404).json({ message: 'Wedding not found' });
    }

    // Check if user owns the wedding
    if (wedding.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this wedding' });
    }

    await wedding.deleteOne();

    res.status(200).json({ id: req.params.id, message: 'Wedding deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createWedding,
  getWeddings,
  getWeddingById,
  updateWedding,
  deleteWedding,
};
