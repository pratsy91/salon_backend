const Staff = require("../models/Staff");
const Plan = require("../models/Plan");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const listStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.find({ salonId: req.salonId, isActive: true }).sort(
    { name: 1 },
  );
  res.json({ staff });
});

const createStaff = asyncHandler(async (req, res) => {
  const { name, specialization } = req.body || {};
  if (!name || !String(name).trim())
    throw ApiError.badRequest("MISSING_FIELD", "'name' is required.");

  const plan = req.salon.currentPlan
    ? await Plan.findById(req.salon.currentPlan)
    : null;
  if (plan) {
    const activeCount = await Staff.countDocuments({
      salonId: req.salonId,
      isActive: true,
    });
    if (activeCount >= plan.maxStaff) {
      throw ApiError.forbidden(
        "PLAN_LIMIT_REACHED",
        `Your ${plan.name} plan allows ${plan.maxStaff} staff members. Upgrade the plan to add more.`,
      );
    }
  }

  const staff = await Staff.create({
    salonId: req.salonId,
    name: String(name).trim(),
    specialization,
  });
  res.status(201).json({ staff });
});

module.exports = { listStaff, createStaff };
