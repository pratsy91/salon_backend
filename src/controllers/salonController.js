const mongoose = require("mongoose");
const Salon = require("../models/Salon");
const User = require("../models/User");
const Service = require("../models/Service");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  ROLES,
  DEFAULT_OPENING_TIME,
  DEFAULT_CLOSING_TIME,
} = require("../config/constants");
const { toMinutes } = require("../utils/time");

const DEFAULT_SERVICES = [
  { name: "Haircut", durationMinutes: 30, price: 300 },
  { name: "Facial", durationMinutes: 60, price: 900 },
  { name: "Hair Color", durationMinutes: 120, price: 2500 },
];

function serialiseSalon(salon) {
  return {
    id: salon._id,
    name: salon.name,
    email: salon.email,
    phone: salon.phone,
    address: salon.address,
    latitude: salon.latitude,
    longitude: salon.longitude,
    allowedRadius: salon.allowedRadius,
    openingTime: salon.openingTime,
    closingTime: salon.closingTime,
    currentPlan: salon.currentPlan,
    subscriptionStartDate: salon.subscriptionStartDate,
    subscriptionEndDate: salon.subscriptionEndDate,
    subscriptionStatus: salon.isSubscriptionActive()
      ? "ACTIVE"
      : salon.subscriptionStatus,
  };
}

function parseCoordinate(value, field, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw ApiError.badRequest(
      "INVALID_FIELD",
      `'${field}' must be a number between ${min} and ${max}.`,
    );
  }
  return number;
}

const listSalons = asyncHandler(async (req, res) => {
  const salons = await Salon.find()
    .populate("currentPlan", "name price durationInDays")
    .sort({ createdAt: -1 });
  res.json({ salons: salons.map(serialiseSalon) });
});

const getSalon = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("INVALID_ID", "Invalid salon id.");
  }
  const salon = await Salon.findById(req.params.id).populate(
    "currentPlan",
    "name price durationInDays",
  );
  if (!salon) throw ApiError.notFound("SALON_NOT_FOUND", "Salon not found.");
  res.json({ salon: serialiseSalon(salon) });
});

const createSalon = asyncHandler(async (req, res) => {
  const { name, email, phone, address, ownerName, ownerEmail, ownerPassword } =
    req.body || {};
  if (!name || !ownerName || !ownerEmail || !ownerPassword) {
    throw ApiError.badRequest(
      "MISSING_FIELD",
      "'name', 'ownerName', 'ownerEmail' and 'ownerPassword' are required.",
    );
  }
  if (String(ownerPassword).length < 6) {
    throw ApiError.badRequest(
      "WEAK_PASSWORD",
      "Owner password must be at least 6 characters.",
    );
  }

  const latitude = parseCoordinate(req.body.latitude, "latitude", -90, 90);
  const longitude = parseCoordinate(req.body.longitude, "longitude", -180, 180);
  const allowedRadius = Number(req.body.allowedRadius ?? 200);
  if (!Number.isFinite(allowedRadius) || allowedRadius < 1) {
    throw ApiError.badRequest(
      "INVALID_FIELD",
      "'allowedRadius' must be a positive number of metres.",
    );
  }

  const openingTime = req.body.openingTime || DEFAULT_OPENING_TIME;
  const closingTime = req.body.closingTime || DEFAULT_CLOSING_TIME;
  if (toMinutes(openingTime) === null || toMinutes(closingTime) === null) {
    throw ApiError.badRequest(
      "INVALID_TIME",
      "Opening and closing times must be in HH:MM format.",
    );
  }
  if (toMinutes(openingTime) >= toMinutes(closingTime)) {
    throw ApiError.badRequest(
      "INVALID_TIME",
      "Closing time must be after opening time.",
    );
  }

  const normalisedOwnerEmail = String(ownerEmail).toLowerCase().trim();
  if (await User.exists({ email: normalisedOwnerEmail })) {
    throw ApiError.conflict(
      "EMAIL_TAKEN",
      "A user with that email already exists.",
    );
  }

  const salon = await Salon.create({
    name: String(name).trim(),
    email,
    phone,
    address,
    latitude,
    longitude,
    allowedRadius,
    openingTime,
    closingTime,
  });

  await User.create({
    name: String(ownerName).trim(),
    email: normalisedOwnerEmail,
    passwordHash: await User.hashPassword(String(ownerPassword)),
    role: ROLES.SALON_OWNER,
    salonId: salon._id,
  });

  await Service.insertMany(
    DEFAULT_SERVICES.map((service) => ({ ...service, salonId: salon._id })),
  );

  res.status(201).json({ salon: serialiseSalon(salon) });
});

module.exports = { listSalons, getSalon, createSalon, serialiseSalon };
