const Salon = require("../models/Salon");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { ROLES, SUBSCRIPTION_STATUS } = require("../config/constants");

module.exports = asyncHandler(async (req, res, next) => {
  if (req.user.role === ROLES.SUPER_ADMIN) return next();

  const salon = await Salon.findById(req.salonId);
  if (!salon) {
    throw ApiError.notFound(
      "SALON_NOT_FOUND",
      "The salon for this account no longer exists.",
    );
  }

  if (!salon.isSubscriptionActive()) {
    if (salon.subscriptionStatus === SUBSCRIPTION_STATUS.ACTIVE) {
      salon.subscriptionStatus = SUBSCRIPTION_STATUS.EXPIRED;
      await salon.save();
    }
    throw ApiError.forbidden(
      "SUBSCRIPTION_EXPIRED",
      "Your subscription has expired. Please contact the administrator to renew your plan.",
    );
  }

  req.salon = salon;
  return next();
});
