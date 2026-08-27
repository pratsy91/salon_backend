const mongoose = require("mongoose");
const { APPOINTMENT_STATUS } = require("../config/constants");

const appointmentSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },

    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },

    startMinutes: { type: Number, required: true },
    endMinutes: { type: Number, required: true },

    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.PENDING,
    },
    notes: { type: String, trim: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

appointmentSchema.index({ salonId: 1, date: 1, staffId: 1, status: 1 });

module.exports = mongoose.model("Appointment", appointmentSchema);
