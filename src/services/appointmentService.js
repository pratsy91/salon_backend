const mongoose = require("mongoose");
const Appointment = require("../models/Appointment");
const Client = require("../models/Client");
const Service = require("../models/Service");
const Staff = require("../models/Staff");
const Plan = require("../models/Plan");
const ApiError = require("../utils/ApiError");
const {
  toMinutes,
  toTimeString,
  isValidDateString,
  todayDateString,
} = require("../utils/time");
const {
  BLOCKING_STATUSES,
  APPOINTMENT_STATUS,
} = require("../config/constants");

function assertObjectId(value, field) {
  if (!mongoose.isValidObjectId(value)) {
    throw ApiError.badRequest("INVALID_ID", `'${field}' must be a valid id.`);
  }
}

async function loadSalonScopedRefs(salonId, { clientId, serviceId, staffId }) {
  assertObjectId(clientId, "clientId");
  assertObjectId(serviceId, "serviceId");
  assertObjectId(staffId, "staffId");

  const [client, service, staff] = await Promise.all([
    Client.findOne({ _id: clientId, salonId }),
    Service.findOne({ _id: serviceId, salonId, isActive: true }),
    Staff.findOne({ _id: staffId, salonId, isActive: true }),
  ]);

  if (!client)
    throw ApiError.notFound(
      "CLIENT_NOT_FOUND",
      "Client not found for this salon.",
    );
  if (!service)
    throw ApiError.notFound(
      "SERVICE_NOT_FOUND",
      "Service not found for this salon.",
    );
  if (!staff)
    throw ApiError.notFound(
      "STAFF_NOT_FOUND",
      "Staff member not found for this salon.",
    );

  return { client, service, staff };
}

function resolveTimeWindow({ startTime, endTime }, service, salon) {
  const startMinutes = toMinutes(startTime);
  if (startMinutes === null) {
    throw ApiError.badRequest(
      "INVALID_TIME",
      "'startTime' must be in HH:MM 24-hour format.",
    );
  }

  const endMinutes = startMinutes + service.durationMinutes;

  if (endTime !== undefined && endTime !== null && endTime !== "") {
    const providedEnd = toMinutes(endTime);
    if (providedEnd === null) {
      throw ApiError.badRequest(
        "INVALID_TIME",
        "'endTime' must be in HH:MM 24-hour format.",
      );
    }
    if (providedEnd !== endMinutes) {
      throw ApiError.badRequest(
        "DURATION_MISMATCH",
        `${service.name} takes ${service.durationMinutes} minutes, so the appointment must end at ${toTimeString(endMinutes)}.`,
      );
    }
  }

  const openingMinutes = toMinutes(salon.openingTime);
  const closingMinutes = toMinutes(salon.closingTime);

  if (startMinutes < openingMinutes || endMinutes > closingMinutes) {
    throw ApiError.badRequest(
      "OUTSIDE_WORKING_HOURS",
      `Appointments must fall completely within working hours (${salon.openingTime}-${salon.closingTime}). ` +
        `Requested ${toTimeString(startMinutes)}-${toTimeString(endMinutes)}.`,
    );
  }

  return { startMinutes, endMinutes };
}

// Overlap rule: same salon, same staff, same day, ignoring cancelled rows.
// Two windows collide when each begins strictly before the other ends, which
// permits back-to-back bookings that merely touch at the boundary.
async function findConflictingAppointment({
  salonId,
  staffId,
  date,
  startMinutes,
  endMinutes,
  excludeId,
}) {
  const query = {
    salonId,
    staffId,
    date,
    status: { $in: BLOCKING_STATUSES },
    startMinutes: { $lt: endMinutes },
    endMinutes: { $gt: startMinutes },
  };
  if (excludeId) query._id = { $ne: excludeId };

  return Appointment.findOne(query).populate("staffId", "name");
}

async function assertPlanAppointmentQuota(salon) {
  if (!salon.currentPlan) return;
  const plan = await Plan.findById(salon.currentPlan);
  if (!plan) return;

  const usage = await Appointment.countDocuments({
    salonId: salon._id,
    status: { $ne: APPOINTMENT_STATUS.CANCELLED },
    createdAt: { $gte: salon.subscriptionStartDate || new Date(0) },
  });

  if (usage >= plan.maxAppointments) {
    throw ApiError.forbidden(
      "PLAN_LIMIT_REACHED",
      `Your ${plan.name} plan allows ${plan.maxAppointments} appointments per subscription period and you have used all of them.`,
    );
  }
}

async function createAppointment({ salon, payload, userId }) {
  const salonId = salon._id;
  const { date, startTime, endTime, notes, status } = payload;

  if (!isValidDateString(date)) {
    throw ApiError.badRequest(
      "INVALID_DATE",
      "'date' must be a real calendar date in YYYY-MM-DD format.",
    );
  }
  if (date < todayDateString()) {
    throw ApiError.badRequest(
      "DATE_IN_PAST",
      "Appointments cannot be booked for a past date.",
    );
  }
  if (status && !Object.values(APPOINTMENT_STATUS).includes(status)) {
    throw ApiError.badRequest(
      "INVALID_STATUS",
      `'status' must be one of ${Object.values(APPOINTMENT_STATUS).join(", ")}.`,
    );
  }

  const { client, service, staff } = await loadSalonScopedRefs(
    salonId,
    payload,
  );
  const { startMinutes, endMinutes } = resolveTimeWindow(
    { startTime, endTime },
    service,
    salon,
  );

  await assertPlanAppointmentQuota(salon);

  const conflict = await findConflictingAppointment({
    salonId,
    staffId: staff._id,
    date,
    startMinutes,
    endMinutes,
  });

  if (conflict) {
    throw ApiError.conflict(
      "STAFF_UNAVAILABLE",
      `${staff.name} already has an appointment from ${conflict.startTime} to ${conflict.endTime} on ${date}.`,
      {
        conflictingAppointmentId: conflict._id,
        conflictingSlot: `${conflict.startTime}-${conflict.endTime}`,
      },
    );
  }

  return Appointment.create({
    salonId,
    clientId: client._id,
    serviceId: service._id,
    staffId: staff._id,
    date,
    startTime: toTimeString(startMinutes),
    endTime: toTimeString(endMinutes),
    startMinutes,
    endMinutes,
    status: status || APPOINTMENT_STATUS.PENDING,
    notes,
    createdBy: userId,
  });
}

module.exports = {
  createAppointment,
  findConflictingAppointment,
  resolveTimeWindow,
};
