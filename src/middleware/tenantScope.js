const ApiError = require("../utils/ApiError");
const { ROLES } = require("../config/constants");

const TENANT_KEYS = ["salonId", "salon_id", "salon"];

module.exports = (req, res, next) => {
  for (const source of [req.body, req.query, req.params]) {
    if (source && typeof source === "object") {
      for (const key of TENANT_KEYS) {
        if (key in source) delete source[key];
      }
    }
  }

  if (!req.user) {
    return next(
      ApiError.unauthorized("UNAUTHENTICATED", "Authentication required."),
    );
  }

  if (req.user.role === ROLES.SUPER_ADMIN) {
    req.salonId = null;
    return next();
  }

  if (!req.user.salonId) {
    return next(
      ApiError.forbidden(
        "NO_TENANT",
        "This account is not associated with any salon.",
      ),
    );
  }

  req.salonId = req.user.salonId;
  return next();
};
