const mongoose = require("mongoose");
const { SUBSCRIPTION_ACTION } = require("../config/constants");

const subscriptionHistorySchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    price: { type: Number, required: true, min: 0 },
    action: {
      type: String,
      enum: Object.values(SUBSCRIPTION_ACTION),
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } },
);

module.exports = mongoose.model(
  "SubscriptionHistory",
  subscriptionHistorySchema,
);
