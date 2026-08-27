const ApiError = require('../utils/ApiError');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    const body = { error: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.statusCode).json(body);
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'One or more fields are invalid.',
      details: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: `'${err.value}' is not a valid identifier.`,
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'DUPLICATE_KEY',
      message: 'A record with these details already exists.',
      details: err.keyValue,
    });
  }

  console.error('[unhandled]', err);
  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'Something went wrong. Please try again.',
  });
}

module.exports = { notFoundHandler, errorHandler };
