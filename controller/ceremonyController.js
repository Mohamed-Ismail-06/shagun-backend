const Ceremony = require('../model/Ceremony');
const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z0-9.-]{2,}$/;

// @desc    Create a new ceremony
// @route   POST /api/ceremonies
// @access  Private
const createCeremony = async (req, res) => {
  const { weddingId, organiserUpiId, ceremonyName, ceremonyDate, venue } = req.body;

  // Validation
  if (!weddingId || !organiserUpiId || !ceremonyName || !ceremonyDate || !venue) {
    return res.status(400).json({ message: 'Please fill all fields' });
  }
  const normalizedUpiId = String(organiserUpiId).trim().toLowerCase();
  if (!UPI_ID_REGEX.test(normalizedUpiId)) {
    return res.status(400).json({ message: 'Please enter a valid organiser UPI ID (example: name@okicici)' });
  }

  try {
    const ceremony = await Ceremony.create({
      user: req.user._id,
      weddingId: String(weddingId).trim(),
      organiserUpiId: normalizedUpiId,
      ceremonyName,
      ceremonyDate,
      venue,
    });

    res.status(201).json(ceremony);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all ceremonies for current user
// @route   GET /api/ceremonies
// @access  Private
const getCeremonies = async (req, res) => {
  try {
    const ceremonies = await Ceremony.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(ceremonies);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single ceremony
// @route   GET /api/ceremonies/:id
// @access  Private
const getCeremonyById = async (req, res) => {
  try {
    const ceremony = await Ceremony.findById(req.params.id);

    if (!ceremony) {
      return res.status(404).json({ message: 'Ceremony not found' });
    }

    // Check if user owns the ceremony
    if (ceremony.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to view this ceremony' });
    }

    res.status(200).json(ceremony);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update ceremony
// @route   PUT /api/ceremonies/:id
// @access  Private
const updateCeremony = async (req, res) => {
  try {
    const ceremony = await Ceremony.findById(req.params.id);

    if (!ceremony) {
      return res.status(404).json({ message: 'Ceremony not found' });
    }

    // Check if user owns the ceremony
    if (ceremony.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to update this ceremony' });
    }

    const updatedCeremony = await Ceremony.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json(updatedCeremony);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete ceremony
// @route   DELETE /api/ceremonies/:id
// @access  Private
const deleteCeremony = async (req, res) => {
  try {
    const ceremony = await Ceremony.findById(req.params.id);

    if (!ceremony) {
      return res.status(404).json({ message: 'Ceremony not found' });
    }

    // Check if user owns the ceremony
    if (ceremony.user.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized to delete this ceremony' });
    }

    await ceremony.deleteOne();

    res.status(200).json({ id: req.params.id, message: 'Ceremony deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createCeremony,
  getCeremonies,
  getCeremonyById,
  updateCeremony,
  deleteCeremony,
};
