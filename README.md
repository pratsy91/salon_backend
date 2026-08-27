# Salon CRM — Full-Stack Technical Assessment

A focused multi-tenant Salon CRM slice: **Node.js / Express / MongoDB** backend, **React + Material UI** web panel, and a minimal **Expo (SDK 54) React Native** staff app.

## 1. Setup & run instructions

**Prerequisites:** Node.js 18+ (tested on 22), npm, MongoDB Atlas (or local MongoDB), Expo Go on a phone for mobile.

### Database

1. Create a MongoDB Atlas free cluster (or use local MongoDB).
2. Allow network access (for demos, `0.0.0.0/0` is simplest).
3. Copy the connection string into `backend/.env` as `MONGO_URI`.

### Backend

```bash
cd backend
npm install
cp .env.example .env      # set MONGO_URI and JWT_SECRET
npm run seed              # wipes DB and loads demo data
npm start                 # http://localhost:5000  (API base: /api)
```

Useful `.env` keys:

| Key                                 | Purpose                                             |
| ----------------------------------- | --------------------------------------------------- |
| `MONGO_URI`                         | MongoDB connection string                           |
| `JWT_SECRET`                        | JWT signing secret                                  |
| `JWT_EXPIRES_IN`                    | Token lifetime (default `7d`)                       |
| `PORT`                              | API port (default `5000`)                           |
| `SEED_SALON_LAT` / `SEED_SALON_LNG` | Optional geo-fence centre for the seeded Glow salon |

Health check: `GET http://localhost:5000/api/health`

### Web

```bash
cd web
npm install
# web/.env → VITE_API_URL=http://localhost:5000/api
# (or your deployed API, e.g. https://your-api.onrender.com/api)
npm run dev               # http://localhost:5173
```

### Mobile

```bash
cd mobile
npm install
# mobile/.env → EXPO_PUBLIC_API_URL=
#   local:  http://<your-LAN-IP>:5000/api
#   or deployed: https://your-api.onrender.com/api
npx expo start
```

Scan the QR code with **Expo Go** (project uses **SDK 54**). Phone and PC must be on the same Wi‑Fi if using a LAN IP. Allow Node through the Windows firewall if local calls time out.

---

## 2. Test credentials (all 3 roles)

Password for **every** account: **`Password@123`**

| Role             | Email                   | Salon / notes                 |
| ---------------- | ----------------------- | ----------------------------- |
| **Super Admin**  | `superadmin@salon.test` |
| **Salon Owner**  | `owner@glow.test`       | Glow & Go — **active** plan   |
| **Receptionist** | `reception@glow.test`   | Glow — staff **Aisha Khan**   |
| Receptionist     | `vikram@glow.test`      | Glow — staff **Vikram Rao**   |
| Receptionist     | `neha@glow.test`        | Glow — staff **Neha Joshi**   |
| Salon Owner      | `owner@urban.test`      | Urban Cuts — **expired** plan |
| Receptionist     | `reception@urban.test`  | Urban Cuts — **expired** plan |

On **web** and **mobile** login, open **Testing credentials**: choose a role; for Receptionist, pick a Glow staff member to auto-fill email/password. Use **Show** on the password field if dots are hard to read (especially on Android).

Seed also creates today for Aisha: **10:00–11:00 CONFIRMED** (blocks overlaps) and **14:00–14:30 CANCELLED** (does not block).

### How to test with these credentials

**A. Super Admin** (`superadmin@salon.test`)

1. Open web → login via Testing credentials → Super Admin.
2. **Plans** — create a plan; edit an existing one; toggle Active/Inactive.
3. **Salons** — list tenants; **Create salon** (GPS or paste lat/lng from Google Maps); **Manage plan** with ASSIGN / RENEW / UPGRADE.
4. **Subscription history** — confirm each plan action appears as a history row.

**B. Salon Owner — active** (`owner@glow.test`)

1. **Dashboard** — today’s appointment count, subscription status, attendance.
2. **Appointments** — book Aisha at **10:30** → should fail (conflict); book **11:00** → OK; book **14:00** → OK (cancelled slot free); try **08:30** → outside hours.
3. End time is read-only (service duration). Confirm / Cancel show a loading state.
4. **Clients** — add a client.
5. **Subscription** — plan, dates, history (owner only).

**C. Receptionist** (`reception@glow.test` / Vikram / Neha)

1. Can use Dashboard, Appointments, Clients.
2. Cannot see Subscription / Plans / Salons (UI + API both block).
3. Mobile: login as each staff → **Check-in** inside geo-fence → attendance is **only for that user**.

**D. Expired owner** (`owner@urban.test`)

1. Login still works; dashboard shows expired.
2. Appointments / Clients return **`SUBSCRIPTION_EXPIRED`** with the specified message.
3. **Subscription** page still loads so they can see status.

**E. Tenant isolation (quick check)**

1. As Glow owner, list clients — you should **not** see Urban Cuts clients (e.g. Deepak Shah).
2. Injecting `salonId` in a request body is ignored; records always use the token’s salon.

**F. Geo check-in (mobile)**

1. Seed Glow fence uses `SEED_SALON_LAT` / `SEED_SALON_LNG` (or defaults in seed).
2. Inside radius → success + distance metres; far away → `OUT_OF_RANGE`; missing GPS → clear `400`.

---

## 3. Architecture explanation (brief)

```
authenticate → tenantScope → requireRole(...) → requireActiveSubscription → controller → service
```

- **`authenticate`** — JWT + reload user from DB
- **`tenantScope`** — strip client `salonId`; set `req.salonId` from token only (Super Admin stays cross-tenant)
- **`requireRole`** — server-side RBAC
- **`requireActiveSubscription`** — date-based plan gate (not applied to login / subscription status screens)

Core domain logic lives in services (`appointmentService`, `subscriptionService`) and pure helpers (`utils/time.js`, `utils/geo.js`). Frontends call the API; they never decide permissions or “inside fence” alone.

**Models:** User, Salon (includes lat/lng/`allowedRadius`/hours), Plan, SubscriptionHistory, Client, Staff, Service, Appointment, Attendance.

---

## 4. Assumptions made

1. **Branch merged into Salon** — geo-fence and hours live on Salon (allowed by the brief).
2. **Expired plans can still log in** and open subscription/dashboard; feature routes stay locked.
3. **`endTime` is derived** from fixed service duration; mismatched client `endTime` → `DURATION_MISMATCH`.
4. **Working hours** stored per salon (default 09:00–20:00).
5. **Past calendar dates** cannot be booked; same-day walk-ins are allowed.
6. **Only `CANCELLED` frees a slot**; `COMPLETED` still blocks time.
7. **Cancelled appointments cannot be reactivated** — book again instead.
8. **`maxAppointments` / `maxStaff`** enforced against the current plan period / active staff count.
9. **Staff ↔ User** optional link for mobile check-in; check-in allowed for salon-scoped users.
10. **One check-in per user per day**; no check-out.
11. **Mobile** uses a simple tab shell (no React Navigation).
12. **Stateless JWT**; user reloaded every request so deactivation applies immediately.

---

## 5. Known limitations / what we'd improve with more time

- Booking **check-then-insert race** (fix with transactions or a partial unique index).
- No Jest suite yet; pure geo/time helpers are ready to unit-test.
- **Timezone** “today” uses server UTC `toISOString()` — should be salon IANA timezone.
- No appointment **reschedule** (status change only; conflict helper already supports `excludeId`).
- No login rate limiting / password reset.
- Web lists are capped, not paginated.
- Mobile stays minimal (no offline, push, or check-out).
- Browser GPS for “Use my location” can need many retries indoors — manual Google Maps paste is supported.

---

## What the brief asked for vs what we built

### Required (implemented)

| Requirement                                                                                     | Implementation                                                                             |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Roles: Super Admin, Salon Owner, Receptionist                                                   | JWT auth + `requireRole` middleware on every protected route                               |
| Plans create/update; assign/renew; subscription history                                         | Super Admin Plans + Salons “Manage plan” (`ASSIGN` / `RENEW` / `UPGRADE`)                  |
| Subscription expiry → exact `403 SUBSCRIPTION_EXPIRED`                                          | `requireActiveSubscription` middleware                                                     |
| Appointments with conflict + working hours (09:00–20:00)                                        | Validated in `appointmentService` (overlap, cancelled free slots, fixed service durations) |
| Geo check-in with Haversine + `OUT_OF_RANGE`                                                    | `POST /attendance/check-in` — distance computed only on the server                         |
| Tenant isolation via token `salonId`                                                            | `tenantScope` strips client `salonId` and scopes all salon queries                         |
| Models: User, Salon, Plan, SubscriptionHistory, Client, Staff, Service, Appointment, Attendance | All present; Branch merged into Salon                                                      |
| Web screens: login, dashboard, appointments, clients, subscription, admin plans/salons/history  | Implemented with MUI                                                                       |
| Mobile: login, dashboard, check-in, today’s appointments                                        | Expo Go app                                                                                |

### Extra (beyond the brief)

- **Create salon from web** with “Use my location” + editable lat/lng and Google Maps paste instructions
- **Default staff** created with each salon: `{Salon Name}'s Default Stylist`
- **Three Glow receptionist logins** (one per staff) for check-in demos; attendance is per user
- **Login “Testing credentials”** role + staff dropdowns (web + mobile), show/hide password, visible demo password helper
- **Confirm/Cancel loading state** on appointments
- **Read-only end time** on create appointment (derived from service duration)
- **Expired second tenant** in seed for easy subscription-gate demos
- Salon create also seeds Haircut / Facial / Hair Color services

---
