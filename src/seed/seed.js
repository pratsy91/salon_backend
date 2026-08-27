require("dotenv").config();

const mongoose = require("mongoose");
const { connectDatabase } = require("../config/db");

const User = require("../models/User");
const Salon = require("../models/Salon");
const Plan = require("../models/Plan");
const SubscriptionHistory = require("../models/SubscriptionHistory");
const Client = require("../models/Client");
const Staff = require("../models/Staff");
const Service = require("../models/Service");
const Appointment = require("../models/Appointment");
const Attendance = require("../models/Attendance");

const {
  ROLES,
  APPOINTMENT_STATUS,
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_ACTION,
} = require("../config/constants");
const { toMinutes, todayDateString } = require("../utils/time");

const SALON_LAT = Number(process.env.SEED_SALON_LAT || 22.7196);
const SALON_LNG = Number(process.env.SEED_SALON_LNG || 75.8577);

const PASSWORD = "Password@123";

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

const SERVICES = [
  { name: "Haircut", durationMinutes: 30, price: 300 },
  { name: "Facial", durationMinutes: 60, price: 900 },
  { name: "Hair Color", durationMinutes: 120, price: 2500 },
];

function appointmentFields({
  salonId,
  clientId,
  serviceId,
  staffId,
  date,
  startTime,
  endTime,
  status,
  createdBy,
}) {
  return {
    salonId,
    clientId,
    serviceId,
    staffId,
    date,
    startTime,
    endTime,
    startMinutes: toMinutes(startTime),
    endMinutes: toMinutes(endTime),
    status,
    createdBy,
  };
}

async function seed() {
  await connectDatabase(process.env.MONGO_URI);
  console.log("Connected. Clearing existing data...");

  await Promise.all([
    User.deleteMany({}),
    Salon.deleteMany({}),
    Plan.deleteMany({}),
    SubscriptionHistory.deleteMany({}),
    Client.deleteMany({}),
    Staff.deleteMany({}),
    Service.deleteMany({}),
    Appointment.deleteMany({}),
    Attendance.deleteMany({}),
  ]);

  const passwordHash = await User.hashPassword(PASSWORD);

  /* ------------------------------- plans -------------------------------- */
  const [basic, pro] = await Plan.create([
    {
      name: "Basic",
      price: 999,
      durationInDays: 30,
      maxStaff: 3,
      maxAppointments: 100,
    },
    {
      name: "Pro",
      price: 2499,
      durationInDays: 90,
      maxStaff: 10,
      maxAppointments: 1000,
    },
    {
      name: "Enterprise",
      price: 5999,
      durationInDays: 365,
      maxStaff: 50,
      maxAppointments: 10000,
    },
  ]);

  /* ------------------------------- salons ------------------------------- */
  // Two tenants: one healthy, one deliberately expired. The pair is what makes
  // isolation and subscription gating demonstrable without editing the DB.
  const glow = await Salon.create({
    name: "Glow & Go Salon",
    email: "hello@glowandgo.test",
    phone: "9000000001",
    address: "12 MG Road",
    latitude: SALON_LAT,
    longitude: SALON_LNG,
    allowedRadius: 200,
    currentPlan: pro._id,
    subscriptionStartDate: daysFromNow(-10),
    subscriptionEndDate: daysFromNow(80),
    subscriptionStatus: SUBSCRIPTION_STATUS.ACTIVE,
  });

  const urban = await Salon.create({
    name: "Urban Cuts (expired plan)",
    email: "hello@urbancuts.test",
    phone: "9000000002",
    address: "44 Ring Road",
    latitude: 19.076,
    longitude: 72.8777,
    allowedRadius: 150,
    currentPlan: basic._id,
    subscriptionStartDate: daysFromNow(-60),
    subscriptionEndDate: daysFromNow(-30),
    subscriptionStatus: SUBSCRIPTION_STATUS.EXPIRED,
  });

  /* -------------------------------- users -------------------------------- */
  const superAdmin = await User.create({
    name: "Super Admin",
    email: "superadmin@salon.test",
    passwordHash,
    role: ROLES.SUPER_ADMIN,
    salonId: null,
  });

  const [glowOwner, glowReception] = await User.create([
    {
      name: "Meera Kapoor",
      email: "owner@glow.test",
      passwordHash,
      role: ROLES.SALON_OWNER,
      salonId: glow._id,
    },
    {
      name: "Riya Sharma",
      email: "reception@glow.test",
      passwordHash,
      role: ROLES.RECEPTIONIST,
      salonId: glow._id,
    },
  ]);

  await User.create([
    {
      name: "Arjun Mehta",
      email: "owner@urban.test",
      passwordHash,
      role: ROLES.SALON_OWNER,
      salonId: urban._id,
    },
    {
      name: "Sana Ali",
      email: "reception@urban.test",
      passwordHash,
      role: ROLES.RECEPTIONIST,
      salonId: urban._id,
    },
  ]);

  /* ---------------------------- subscription log -------------------------- */
  await SubscriptionHistory.create([
    {
      salonId: glow._id,
      planId: basic._id,
      startDate: daysFromNow(-40),
      endDate: daysFromNow(-10),
      price: basic.price,
      action: SUBSCRIPTION_ACTION.ASSIGN,
      performedBy: superAdmin._id,
    },
    {
      salonId: glow._id,
      planId: pro._id,
      startDate: daysFromNow(-10),
      endDate: daysFromNow(80),
      price: pro.price,
      action: SUBSCRIPTION_ACTION.UPGRADE,
      performedBy: superAdmin._id,
    },
    {
      salonId: urban._id,
      planId: basic._id,
      startDate: daysFromNow(-60),
      endDate: daysFromNow(-30),
      price: basic.price,
      action: SUBSCRIPTION_ACTION.ASSIGN,
      performedBy: superAdmin._id,
    },
  ]);

  /* ------------------------- services, staff, clients --------------------- */
  const glowServices = await Service.insertMany(
    SERVICES.map((s) => ({ ...s, salonId: glow._id })),
  );
  await Service.insertMany(SERVICES.map((s) => ({ ...s, salonId: urban._id })));

  const [aisha] = await Staff.create([
    {
      salonId: glow._id,
      name: "Aisha Khan",
      specialization: "Hair",
      userId: glowReception._id,
    },
    { salonId: glow._id, name: "Vikram Rao", specialization: "Color" },
    { salonId: glow._id, name: "Neha Joshi", specialization: "Skin" },
  ]);

  await Staff.create([
    { salonId: urban._id, name: "Rahul Verma", specialization: "Hair" },
    { salonId: urban._id, name: "Priya Nair", specialization: "Skin" },
  ]);

  const [ananya] = await Client.create([
    {
      salonId: glow._id,
      name: "Ananya Gupta",
      phone: "9811111111",
      email: "ananya@test.com",
    },
    { salonId: glow._id, name: "Rohit Sinha", phone: "9822222222" },
    { salonId: glow._id, name: "Kavya Iyer", phone: "9833333333" },
  ]);

  await Client.create([
    { salonId: urban._id, name: "Deepak Shah", phone: "9844444444" },
    { salonId: urban._id, name: "Farah Khan", phone: "9855555555" },
  ]);

  /* ----------------------------- appointments ----------------------------- */
  const today = todayDateString();
  const facial = glowServices.find((s) => s.name === "Facial");
  const haircut = glowServices.find((s) => s.name === "Haircut");

  await Appointment.create([
    appointmentFields({
      salonId: glow._id,
      clientId: ananya._id,
      serviceId: facial._id,
      staffId: aisha._id,
      date: today,
      startTime: "10:00",
      endTime: "11:00",
      status: APPOINTMENT_STATUS.CONFIRMED,
      createdBy: glowOwner._id,
    }),

    appointmentFields({
      salonId: glow._id,
      clientId: ananya._id,
      serviceId: haircut._id,
      staffId: aisha._id,
      date: today,
      startTime: "14:00",
      endTime: "14:30",
      status: APPOINTMENT_STATUS.CANCELLED,
      createdBy: glowOwner._id,
    }),
  ]);

  console.log("\nSeed complete.\n");
  console.log("Login credentials (password for all accounts: %s)", PASSWORD);
  console.table([
    { role: "SUPER_ADMIN", email: "superadmin@salon.test", salon: "-" },
    {
      role: "SALON_OWNER",
      email: "owner@glow.test",
      salon: "Glow & Go (active plan)",
    },
    {
      role: "RECEPTIONIST",
      email: "reception@glow.test",
      salon: "Glow & Go (active plan)",
    },
    {
      role: "SALON_OWNER",
      email: "owner@urban.test",
      salon: "Urban Cuts (EXPIRED plan)",
    },
    {
      role: "RECEPTIONIST",
      email: "reception@urban.test",
      salon: "Urban Cuts (EXPIRED plan)",
    },
  ]);
  console.log(`\nGeo-fence centre: ${SALON_LAT}, ${SALON_LNG} (radius 200m)`);
  console.log(
    `Blocking appointment seeded: Aisha Khan, ${today} 10:00-11:00 (CONFIRMED)`,
  );
  console.log(
    `Cancelled appointment seeded: Aisha Khan, ${today} 14:00-14:30 (should not block)\n`,
  );

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect();
  process.exit(1);
});
