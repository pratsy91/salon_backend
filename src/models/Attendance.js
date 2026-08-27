const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    staffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: null,
    },

    date: { type: String, required: true },
    checkInAt: { type: Date, required: true },

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    distanceMeters: { type: Number, required: true },
  },
  { timestamps: true },
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
