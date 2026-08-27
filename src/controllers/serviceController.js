const Service = require('../models/Service');
const asyncHandler = require('../utils/asyncHandler');

const listServices = asyncHandler(async (req, res) => {
  const services = await Service.find({ salonId: req.salonId, isActive: true }).sort({ durationMinutes: 1 });
  res.json({ services });
});

module.exports = { listServices };
