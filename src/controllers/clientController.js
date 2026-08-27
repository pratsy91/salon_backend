const Client = require('../models/Client');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const listClients = asyncHandler(async (req, res) => {
  const filter = { salonId: req.salonId };
  const search = (req.query.search || '').trim();
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(safe, 'i') }, { phone: new RegExp(safe, 'i') }];
  }

  const clients = await Client.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json({ clients });
});

const createClient = asyncHandler(async (req, res) => {
  const { name, phone, email, notes } = req.body || {};
  if (!name || !String(name).trim()) throw ApiError.badRequest('MISSING_FIELD', "'name' is required.");
  if (!phone || !String(phone).trim()) throw ApiError.badRequest('MISSING_FIELD', "'phone' is required.");

  const existing = await Client.findOne({ salonId: req.salonId, phone: String(phone).trim() });
  if (existing) {
    throw ApiError.conflict('CLIENT_EXISTS', 'A client with this phone number already exists in your salon.');
  }

  const client = await Client.create({
    salonId: req.salonId,
    name: String(name).trim(),
    phone: String(phone).trim(),
    email,
    notes,
  });
  res.status(201).json({ client });
});

module.exports = { listClients, createClient };
