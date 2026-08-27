const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema(
  {
    salonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Salon",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    notes: { type: String, trim: true },
  },
  { timestamps: true },
);

clientSchema.index({ salonId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("Client", clientSchema);
