const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { createAppointment } = require("../services/appointmentService");
const { APPOINTMENT_STATUS } = require("../config/constants");
const { isValidDateString, todayDateString } = require("../utils/time");

const POPULATE = [
  { path: "clientId", select: "name phone" },
  { path: "serviceId", select: "name durationMinutes price" },
  { path: "staffId", select: "name specialization" },
];

const listAppointments = asyncHandler(async (req, res) => {
  const filter = { salonId: req.salonId };

  const { date, status, staffId } = req.query;
  if (date) {
    if (!isValidDateString(date)) {
      throw ApiError.badRequest(
        "INVALID_DATE",
        "'date' must be in YYYY-MM-DD format.",
      );
    }
    filter.date = date;
  }
  if (status) {
    const wanted = String(status).toUpperCase();
    if (!Object.values(APPOINTMENT_STATUS).includes(wanted)) {
      throw ApiError.badRequest("INVALID_STATUS", "Unknown status filter.");
    }
    filter.status = wanted;
  }
  if (staffId) {
    if (!mongoose.isValidObjectId(staffId))
      throw ApiError.badRequest("INVALID_ID", "Invalid staffId filter.");
    filter.staffId = staffId;
  }

  const appointments = await Appointment.find(filter)
    .populate(POPULATE)
    .sort({ date: 1, startMinutes: 1 })
    .limit(300);

  res.json({ appointments });
});

const createAppointmentHandler = asyncHandler(async (req, res) => {
  const appointment = await createAppointment({
    salon: req.salon,
    payload: req.body || {},
    userId: req.user.id,
  });
  await appointment.populate(POPULATE);
  res.status(201).json({ appointment });
});

const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body || {};
  if (!Object.values(APPOINTMENT_STATUS).includes(status)) {
    throw ApiError.badRequest(
      "INVALID_STATUS",
      `'status' must be one of ${Object.values(APPOINTMENT_STATUS).join(", ")}.`,
    );
  }
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw ApiError.badRequest("INVALID_ID", "Invalid appointment id.");
  }

  const appointment = await Appointment.findOne({
    _id: req.params.id,
    salonId: req.salonId,
  });
  if (!appointment) {
    throw ApiError.notFound(
      "APPOINTMENT_NOT_FOUND",
      "Appointment not found for this salon.",
    );
  }
  if (
    appointment.status === APPOINTMENT_STATUS.CANCELLED &&
    status !== APPOINTMENT_STATUS.CANCELLED
  ) {
    throw ApiError.badRequest(
      "ALREADY_CANCELLED",
      "A cancelled appointment cannot be reactivated; create a new booking instead.",
    );
  }

  appointment.status = status;
  await appointment.save();
  await appointment.populate(POPULATE);
  res.json({ appointment });
});

const todaySummary = asyncHandler(async (req, res) => {
  const today = todayDateString();
  const [total, byStatus] = await Promise.all([
    Appointment.countDocuments({ salonId: req.salonId, date: today }),
    Appointment.aggregate([
      {
        $match: {
          salonId: new mongoose.Types.ObjectId(req.salonId),
          date: today,
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    date: today,
    total,
    byStatus: byStatus.reduce(
      (acc, row) => ({ ...acc, [row._id]: row.count }),
      {},
    ),
  });
});

module.exports = {
  listAppointments,
  createAppointment: createAppointmentHandler,
  updateStatus,
  todaySummary,
};
