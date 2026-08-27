const Plan = require('../models/Plan');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const NUMERIC_FIELDS = ['price', 'durationInDays', 'maxStaff', 'maxAppointments'];

function parseNumericFields(source, { required }) {
  const result = {};
  for (const field of NUMERIC_FIELDS) {
    const raw = source[field];
    if (raw === undefined || raw === null || raw === '') {
      if (required) {
        throw ApiError.badRequest('MISSING_FIELD', `'${field}' is required.`);
      }
      continue;
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      throw ApiError.badRequest('INVALID_FIELD', `'${field}' must be a non-negative number.`);
    }
    if (field !== 'price' && (!Number.isInteger(value) || value < 1)) {
      throw ApiError.badRequest('INVALID_FIELD', `'${field}' must be a whole number of at least 1.`);
    }
    result[field] = value;
  }
  return result;
}

const createPlan = asyncHandler(async (req, res) => {
  const { name } = req.body || {};
  if (!name || !String(name).trim()) {
    throw ApiError.badRequest('MISSING_FIELD', "'name' is required.");
  }
  const numbers = parseNumericFields(req.body, { required: true });
  const plan = await Plan.create({ name: String(name).trim(), ...numbers });
  res.status(201).json({ plan });
});

const listPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find().sort({ price: 1 });
  res.json({ plans });
});

const updatePlan = asyncHandler(async (req, res) => {
  const updates = parseNumericFields(req.body || {}, { required: false });
  if (req.body?.name) updates.name = String(req.body.name).trim();
  if (typeof req.body?.isActive === 'boolean') updates.isActive = req.body.isActive;

  const plan = await Plan.findByIdAndUpdate(req.params.planId, updates, {
    new: true,
    runValidators: true,
  });
  if (!plan) throw ApiError.notFound('PLAN_NOT_FOUND', 'Plan not found.');
  res.json({ plan });
});

module.exports = { createPlan, listPlans, updatePlan };
