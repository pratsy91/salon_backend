const ApiError = require("../utils/ApiError");

module.exports =
  (...allowedRoles) =>
  (req, res, next) => {
    if (!req.user) {
      return next(
        ApiError.unauthorized("UNAUTHENTICATED", "Authentication required."),
      );
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          "FORBIDDEN",
          `Your role (${req.user.role}) is not permitted to perform this action.`,
        ),
      );
    }
    return next();
  };
