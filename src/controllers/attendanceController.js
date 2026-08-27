const Attendance = require("../models/Attendance");
const Staff = require("../models/Staff");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  haversineDistanceMeters,
  isValidLatitude,
  isValidLongitude,
} = require("../utils/geo");
const { todayDateString } = require("../utils/time");

const checkIn = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body || {};

  if (
    latitude === undefined ||
    longitude === undefined ||
    latitude === null ||
    longitude === null
  ) {
    throw ApiError.badRequest(
      "LOCATION_REQUIRED",
      "Latitude and longitude are required. Enable location services and try again.",
    );
  }

  const lat = typeof latitude === "string" ? Number(latitude) : latitude;
  const lon = typeof longitude === "string" ? Number(longitude) : longitude;

  if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
    throw ApiError.badRequest(
      "INVALID_COORDINATES",
      "Latitude must be between -90 and 90 and longitude between -180 and 180.",
    );
  }

  const salon = req.salon;
  const distanceMeters = Math.round(
    haversineDistanceMeters(lat, lon, salon.latitude, salon.longitude),
  );

  if (distanceMeters > salon.allowedRadius) {
    throw ApiError.forbidden(
      "OUT_OF_RANGE",
      `You are ${distanceMeters}m from ${salon.name}. Check-in is allowed within ${salon.allowedRadius}m.`,
    );
  }

  const date = todayDateString();
  const already = await Attendance.findOne({ userId: req.user.id, date });
  if (already) {
    throw ApiError.conflict(
      "ALREADY_CHECKED_IN",
      "You have already checked in today.",
    );
  }

  const staff = await Staff.findOne({
    salonId: req.salonId,
    userId: req.user.id,
  });

  const attendance = await Attendance.create({
    salonId: req.salonId,
    userId: req.user.id,
    staffId: staff ? staff._id : null,
    date,
    checkInAt: new Date(),
    latitude: lat,
    longitude: lon,
    distanceMeters,
  });

  res
    .status(201)
    .json({ attendance, distanceMeters, allowedRadius: salon.allowedRadius });
});

const myStatus = asyncHandler(async (req, res) => {
  const date = todayDateString();
  const attendance = await Attendance.findOne({ userId: req.user.id, date });
  res.json({ date, checkedIn: Boolean(attendance), attendance });
});

const listAttendance = asyncHandler(async (req, res) => {
  const filter = { salonId: req.salonId };
  if (req.query.date) filter.date = req.query.date;

  const records = await Attendance.find(filter)
    .populate("userId", "name email")
    .populate("staffId", "name")
    .sort({ checkInAt: -1 })
    .limit(200);

  res.json({ attendance: records });
});

module.exports = { checkIn, myStatus, listAttendance };
