const Salon = require("../models/Salon");
const Plan = require("../models/Plan");
const SubscriptionHistory = require("../models/SubscriptionHistory");
const ApiError = require("../utils/ApiError");
const {
  SUBSCRIPTION_ACTION,
  SUBSCRIPTION_STATUS,
} = require("../config/constants");

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

async function applyPlan({ salonId, planId, action, performedBy }) {
  if (!Object.values(SUBSCRIPTION_ACTION).includes(action)) {
    throw ApiError.badRequest(
      "INVALID_ACTION",
      `'action' must be one of ${Object.values(SUBSCRIPTION_ACTION).join(", ")}.`,
    );
  }

  const [salon, plan] = await Promise.all([
    Salon.findById(salonId),
    Plan.findById(planId),
  ]);
  if (!salon) throw ApiError.notFound("SALON_NOT_FOUND", "Salon not found.");
  if (!plan) throw ApiError.notFound("PLAN_NOT_FOUND", "Plan not found.");
  if (!plan.isActive) {
    throw ApiError.badRequest(
      "PLAN_INACTIVE",
      "This plan is inactive and cannot be assigned.",
    );
  }

  const now = new Date();
  const hasRunningTerm = salon.isSubscriptionActive();
  const currentPlanId = salon.currentPlan ? String(salon.currentPlan) : null;

  if (action === SUBSCRIPTION_ACTION.RENEW) {
    if (!currentPlanId) {
      throw ApiError.badRequest(
        "NOTHING_TO_RENEW",
        "This salon has no plan to renew. Use ASSIGN instead.",
      );
    }
    if (currentPlanId !== String(plan._id)) {
      throw ApiError.badRequest(
        "PLAN_MISMATCH",
        "RENEW must use the salon's current plan. Use UPGRADE to move to a different plan.",
      );
    }
  }

  if (action === SUBSCRIPTION_ACTION.UPGRADE) {
    if (!currentPlanId) {
      throw ApiError.badRequest(
        "NOTHING_TO_UPGRADE",
        "This salon has no plan yet. Use ASSIGN instead.",
      );
    }
    if (currentPlanId === String(plan._id)) {
      throw ApiError.badRequest(
        "SAME_PLAN",
        "The salon is already on this plan. Use RENEW to extend it.",
      );
    }
  }

  const startDate =
    action === SUBSCRIPTION_ACTION.RENEW && hasRunningTerm
      ? salon.subscriptionEndDate
      : now;
  const endDate = addDays(startDate, plan.durationInDays);

  salon.currentPlan = plan._id;
  salon.subscriptionStartDate =
    action === SUBSCRIPTION_ACTION.RENEW && hasRunningTerm
      ? salon.subscriptionStartDate
      : startDate;
  salon.subscriptionEndDate = endDate;
  salon.subscriptionStatus = SUBSCRIPTION_STATUS.ACTIVE;
  await salon.save();

  const history = await SubscriptionHistory.create({
    salonId: salon._id,
    planId: plan._id,
    startDate,
    endDate,
    price: plan.price,
    action,
    performedBy,
  });

  return { salon, plan, history };
}

module.exports = { applyPlan, addDays };
