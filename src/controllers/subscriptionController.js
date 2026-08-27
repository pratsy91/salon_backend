const mongoose = require("mongoose");
const Salon = require("../models/Salon");
const SubscriptionHistory = require("../models/SubscriptionHistory");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { applyPlan } = require("../services/subscriptionService");
const { serialiseSalon } = require("./salonController");

const assignPlan = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { planId, action } = req.body || {};
  if (!mongoose.isValidObjectId(id))
    throw ApiError.badRequest("INVALID_ID", "Invalid salon id.");
  if (!mongoose.isValidObjectId(planId))
    throw ApiError.badRequest(
      "INVALID_ID",
      "'planId' is required and must be valid.",
    );

  const { salon, history } = await applyPlan({
    salonId: id,
    planId,
    action: action || "ASSIGN",
    performedBy: req.user.id,
  });

  await salon.populate("currentPlan", "name price durationInDays");
  res.status(201).json({ salon: serialiseSalon(salon), history });
});

const listHistory = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.params.id) {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw ApiError.badRequest("INVALID_ID", "Invalid salon id.");
    }
    filter.salonId = req.params.id;
  }

  const history = await SubscriptionHistory.find(filter)
    .populate("salonId", "name")
    .populate("planId", "name price durationInDays")
    .sort({ createdAt: -1 });

  res.json({ history });
});

const mySubscription = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.salonId).populate("currentPlan");
  if (!salon) throw ApiError.notFound("SALON_NOT_FOUND", "Salon not found.");

  const history = await SubscriptionHistory.find({ salonId: salon._id })
    .populate("planId", "name price")
    .sort({ createdAt: -1 })
    .limit(20);

  const daysRemaining = salon.subscriptionEndDate
    ? Math.ceil((salon.subscriptionEndDate.getTime() - Date.now()) / 86400000)
    : null;

  res.json({
    salon: serialiseSalon(salon),
    isActive: salon.isSubscriptionActive(),
    daysRemaining,
    history,
  });
});

module.exports = { assignPlan, listHistory, mySubscription };
