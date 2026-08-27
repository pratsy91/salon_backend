const Salon = require("../models/Salon");
const Appointment = require("../models/Appointment");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Attendance = require("../models/Attendance");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { todayDateString } = require("../utils/time");
const { APPOINTMENT_STATUS } = require("../config/constants");

const summary = asyncHandler(async (req, res) => {
  const salon = await Salon.findById(req.salonId).populate(
    "currentPlan",
    "name price maxStaff maxAppointments",
  );
  if (!salon) throw ApiError.notFound("SALON_NOT_FOUND", "Salon not found.");

  const today = todayDateString();
  const isActive = salon.isSubscriptionActive();

  const [todayCount, upcomingCount, clientCount, staffCount, attendance] =
    await Promise.all([
      Appointment.countDocuments({
        salonId: salon._id,
        date: today,
        status: { $ne: APPOINTMENT_STATUS.CANCELLED },
      }),
      Appointment.countDocuments({
        salonId: salon._id,
        date: { $gt: today },
        status: { $ne: APPOINTMENT_STATUS.CANCELLED },
      }),
      Client.countDocuments({ salonId: salon._id }),
      Staff.countDocuments({ salonId: salon._id, isActive: true }),
      Attendance.findOne({ userId: req.user.id, date: today }),
    ]);

  res.json({
    date: today,
    salon: { id: salon._id, name: salon.name },
    subscription: {
      isActive,
      status: isActive ? "ACTIVE" : salon.subscriptionStatus,
      plan: salon.currentPlan,
      endDate: salon.subscriptionEndDate,
      daysRemaining: salon.subscriptionEndDate
        ? Math.ceil(
            (salon.subscriptionEndDate.getTime() - Date.now()) / 86400000,
          )
        : null,
    },
    counts: {
      todayAppointments: todayCount,
      upcomingAppointments: upcomingCount,
      clients: clientCount,
      staff: staffCount,
    },
    attendance: {
      checkedIn: Boolean(attendance),
      checkInAt: attendance ? attendance.checkInAt : null,
    },
  });
});

module.exports = { summary };
