const mongoose = require("mongoose");
const {
  SUBSCRIPTION_STATUS,
  DEFAULT_OPENING_TIME,
  DEFAULT_CLOSING_TIME,
} = require("../config/constants");

const salonSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    allowedRadius: { type: Number, required: true, min: 1, default: 200 },

    openingTime: { type: String, default: DEFAULT_OPENING_TIME },
    closingTime: { type: String, default: DEFAULT_CLOSING_TIME },

    currentPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },
    subscriptionStartDate: { type: Date, default: null },
    subscriptionEndDate: { type: Date, default: null },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.INACTIVE,
    },
  },
  { timestamps: true },
);

salonSchema.methods.isSubscriptionActive = function isSubscriptionActive() {
  if (!this.currentPlan || !this.subscriptionEndDate) return false;
  if (this.subscriptionStatus === SUBSCRIPTION_STATUS.INACTIVE) return false;
  return this.subscriptionEndDate.getTime() >= Date.now();
};

module.exports = mongoose.model("Salon", salonSchema);
