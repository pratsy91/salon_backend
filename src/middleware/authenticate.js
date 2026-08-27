const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

module.exports = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    throw ApiError.unauthorized(
      "UNAUTHENTICATED",
      "Missing or malformed Authorization header.",
    );
  }

  const token = header.slice(7).trim();
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const expired = err.name === "TokenExpiredError";
    throw ApiError.unauthorized(
      expired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      expired
        ? "Your session has expired. Please log in again."
        : "Invalid authentication token.",
    );
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized(
      "UNAUTHENTICATED",
      "This account no longer exists or is disabled.",
    );
  }

  req.user = {
    id: user._id,
    role: user.role,
    salonId: user.salonId,
    email: user.email,
    name: user.name,
  };
  next();
});
