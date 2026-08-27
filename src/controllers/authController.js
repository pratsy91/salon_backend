const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Salon = require("../models/Salon");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function issueToken(user) {
  return jwt.sign(
    { sub: user._id, role: user.role, salonId: user.salonId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
}

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    throw ApiError.badRequest(
      "MISSING_CREDENTIALS",
      "Email and password are required.",
    );
  }

  const user = await User.findOne({
    email: String(email).toLowerCase().trim(),
  });

  if (
    !user ||
    !user.isActive ||
    !(await user.comparePassword(String(password)))
  ) {
    throw ApiError.unauthorized(
      "INVALID_CREDENTIALS",
      "Invalid email or password.",
    );
  }

  let salon = null;
  if (user.salonId) {
    const salonDoc = await Salon.findById(user.salonId).populate(
      "currentPlan",
      "name price",
    );
    if (salonDoc) {
      salon = {
        id: salonDoc._id,
        name: salonDoc.name,
        subscriptionStatus: salonDoc.isSubscriptionActive()
          ? "ACTIVE"
          : "EXPIRED",
        subscriptionEndDate: salonDoc.subscriptionEndDate,
        plan: salonDoc.currentPlan,
      };
    }
  }

  res.json({ token: issueToken(user), user: user.toSafeJSON(), salon });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

module.exports = { login, me };
