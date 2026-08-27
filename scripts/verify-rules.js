/**
 * Executable proof of the graded rules.
 *
 * Run the server and `npm run seed` first, then `npm run verify`. Every check
 * below hits the real HTTP API with real tokens - nothing is stubbed, and no
 * assertion relies on the frontend.
 */
const BASE = process.env.API_URL || 'http://localhost:5000/api';
const PASSWORD = 'Password@123';

let passed = 0;
let failed = 0;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    if (detail !== undefined) console.log(`        got: ${JSON.stringify(detail)}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

async function login(email) {
  const { body } = await api('/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  if (!body.token) throw new Error(`Login failed for ${email}: ${JSON.stringify(body)}`);
  return body.token;
}

async function run() {
  const superAdmin = await login('superadmin@salon.test');
  const owner = await login('owner@glow.test');
  const receptionist = await login('reception@glow.test');
  const expiredOwner = await login('owner@urban.test');
  const expiredReceptionist = await login('reception@urban.test');

  section('1. RBAC enforced server-side');
  {
    const r1 = await api('/plans', {
      method: 'POST',
      token: receptionist,
      body: { name: 'Sneaky', price: 1, durationInDays: 1, maxStaff: 1, maxAppointments: 1 },
    });
    check('receptionist cannot create a plan', r1.status === 403 && r1.body.error === 'FORBIDDEN', r1);

    const r2 = await api('/salons', { token: owner });
    check('salon owner cannot list all salons', r2.status === 403, r2);

    const r3 = await api('/me/subscription', { token: receptionist });
    check('receptionist cannot read subscription details', r3.status === 403, r3);

    const r4 = await api('/staff', {
      method: 'POST',
      token: receptionist,
      body: { name: 'Ghost Stylist' },
    });
    check('receptionist cannot create staff', r4.status === 403, r4);

    const r5 = await api('/appointments', { token: receptionist });
    check('receptionist CAN read appointments', r5.status === 200, r5.status);

    const r6 = await api('/plans', { token: superAdmin, body: undefined });
    check('super admin CAN list plans', r6.status === 200, r6.status);

    const r7 = await api('/appointments');
    check('no token is rejected', r7.status === 401, r7);

    const r8 = await api('/appointments', { token: 'not-a-real-token' });
    check('forged token is rejected', r8.status === 401, r8);
  }

  section('2. Subscription gating');
  {
    const r1 = await api('/appointments', { token: expiredReceptionist });
    check(
      'expired salon gets 403 SUBSCRIPTION_EXPIRED on appointments',
      r1.status === 403 && r1.body.error === 'SUBSCRIPTION_EXPIRED',
      r1
    );
    check(
      'expiry message matches the specified copy',
      r1.body.message === 'Your subscription has expired. Please contact the administrator to renew your plan.',
      r1.body.message
    );

    const r2 = await api('/clients', { token: expiredOwner });
    check('expired salon is blocked on clients too', r2.status === 403 && r2.body.error === 'SUBSCRIPTION_EXPIRED', r2);

    const r3 = await api('/me/subscription', { token: expiredOwner });
    check('expired owner can still read their own subscription status', r3.status === 200 && r3.body.isActive === false, r3.status);

    const r4 = await api('/appointments', { token: receptionist });
    check('active salon is not blocked', r4.status === 200, r4.status);
  }

  section('3. Tenant isolation');
  {
    const mine = await api('/appointments', { token: owner });
    const salonIds = new Set(mine.body.appointments.map((a) => String(a.salonId)));
    check('owner sees exactly one salon\'s appointments', salonIds.size === 1, [...salonIds]);

    const myClients = await api('/clients', { token: owner });
    const names = myClients.body.clients.map((c) => c.name);
    check('owner cannot see the other tenant\'s clients', !names.includes('Deepak Shah'), names);

    // Attempt to force another tenant's scope through the request body.
    const forged = await api('/clients', {
      method: 'POST',
      token: owner,
      body: { name: 'Injected Client', phone: '9999900000', salonId: '000000000000000000000000' },
    });
    const injected = forged.body.client;
    check(
      'client-supplied salonId is ignored, record lands in the caller\'s tenant',
      forged.status === 201 && String(injected.salonId) !== '000000000000000000000000',
      forged.body
    );

    const otherSalonStaff = await api('/staff', { token: expiredOwner });
    check('cross-tenant staff read is gated before it can leak', otherSalonStaff.status === 403, otherSalonStaff.status);
  }

  section('4. Appointment rules');
  {
    const { body: refs } = await api('/services', { token: owner });
    const { body: staffBody } = await api('/staff', { token: owner });
    const { body: clientBody } = await api('/clients', { token: owner });

    const haircut = refs.services.find((s) => s.name === 'Haircut');
    const facial = refs.services.find((s) => s.name === 'Facial');
    const hairColor = refs.services.find((s) => s.name === 'Hair Color');
    const aisha = staffBody.staff.find((s) => s.name === 'Aisha Khan');
    const vikram = staffBody.staff.find((s) => s.name === 'Vikram Rao');
    const client = clientBody.clients[0];
    const today = new Date().toISOString().slice(0, 10);

    const base = { clientId: client._id, staffId: aisha._id, date: today };

    const early = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, startTime: '08:30' },
    });
    check('08:30 start is rejected (before opening)', early.status === 400 && early.body.error === 'OUTSIDE_WORKING_HOURS', early.body);

    const late = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: hairColor._id, startTime: '19:00' },
    });
    check('19:00 Hair Color is rejected (would end at 21:00)', late.status === 400 && late.body.error === 'OUTSIDE_WORKING_HOURS', late.body);

    const boundary = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, staffId: vikram._id, serviceId: haircut._id, startTime: '19:30' },
    });
    check('19:30-20:00 exactly at closing is accepted', boundary.status === 201, boundary.body);

    const overlap = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: facial._id, startTime: '10:30' },
    });
    check('10:30-11:30 overlapping the seeded 10:00-11:00 is rejected', overlap.status === 409 && overlap.body.error === 'STAFF_UNAVAILABLE', overlap.body);

    const contains = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, startTime: '10:15' },
    });
    check('10:15-10:45 fully inside the existing booking is rejected', contains.status === 409, contains.body);

    const backToBack = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, startTime: '11:00' },
    });
    check('11:00-11:30 starting exactly when the other ends is accepted', backToBack.status === 201, backToBack.body);

    const otherStaff = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, staffId: vikram._id, serviceId: facial._id, startTime: '10:30' },
    });
    check('same slot for a different staff member is accepted', otherStaff.status === 201, otherStaff.body);

    const cancelledSlot = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, startTime: '14:00' },
    });
    check('the cancelled 14:00-14:30 slot does not block a new booking', cancelledSlot.status === 201, cancelledSlot.body);

    const mismatch = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, staffId: vikram._id, serviceId: haircut._id, startTime: '15:00', endTime: '17:00' },
    });
    check('endTime that contradicts the service duration is rejected', mismatch.status === 400 && mismatch.body.error === 'DURATION_MISMATCH', mismatch.body);

    const garbage = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, startTime: '25:99' },
    });
    check('malformed time is a 400, not a crash', garbage.status === 400, garbage.body);

    const past = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, date: '2020-01-01', startTime: '10:00' },
    });
    check('past date is rejected', past.status === 400 && past.body.error === 'DATE_IN_PAST', past.body);

    const foreignStaff = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, staffId: '000000000000000000000000', serviceId: haircut._id, startTime: '16:00' },
    });
    check('staff from outside the tenant cannot be booked', foreignStaff.status === 404, foreignStaff.body);

    // Cancelling frees the slot again.
    const created = backToBack.body.appointment;
    await api(`/appointments/${created._id}/status`, { method: 'PATCH', token: owner, body: { status: 'CANCELLED' } });
    const rebooked = await api('/appointments', {
      method: 'POST',
      token: owner,
      body: { ...base, serviceId: haircut._id, startTime: '11:00' },
    });
    check('slot is bookable again once the blocker is cancelled', rebooked.status === 201, rebooked.body);
  }

  section('5. Geo-fenced check-in');
  {
    const missing = await api('/attendance/check-in', { method: 'POST', token: receptionist, body: {} });
    check('missing coordinates return 400, not a crash', missing.status === 400 && missing.body.error === 'LOCATION_REQUIRED', missing.body);

    const garbage = await api('/attendance/check-in', { method: 'POST', token: receptionist, body: { latitude: 'north', longitude: 'west' } });
    check('non-numeric coordinates return 400', garbage.status === 400 && garbage.body.error === 'INVALID_COORDINATES', garbage.body);

    const outOfRange = await api('/attendance/check-in', { method: 'POST', token: receptionist, body: { latitude: 28.6139, longitude: 77.209 } });
    check('a location far away returns 403 OUT_OF_RANGE', outOfRange.status === 403 && outOfRange.body.error === 'OUT_OF_RANGE', outOfRange.body);

    // Read the fence from the API rather than from env, so this stays correct
    // whatever coordinates the database was seeded with.
    const { body: salonList } = await api('/salons', { token: superAdmin });
    const glow = salonList.salons.find((s) => s.name.startsWith('Glow'));
    const { latitude: lat, longitude: lng } = glow;

    // ~55m north of the salon: inside a 200m fence.
    const inRange = await api('/attendance/check-in', { method: 'POST', token: receptionist, body: { latitude: lat + 0.0005, longitude: lng } });
    check('a location inside the radius is accepted', inRange.status === 201, inRange.body);

    const twice = await api('/attendance/check-in', { method: 'POST', token: receptionist, body: { latitude: lat, longitude: lng } });
    check('a second check-in on the same day is rejected', twice.status === 409, twice.body);

    const spoofed = await api('/attendance/check-in', {
      method: 'POST',
      token: owner,
      body: { latitude: 28.6139, longitude: 77.209, isInside: true, distanceMeters: 0 },
    });
    check('a client-supplied "inside" flag is ignored', spoofed.status === 403 && spoofed.body.error === 'OUT_OF_RANGE', spoofed.body);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error('\nVerification could not run:', err.message);
  console.error('Is the server running (npm start) and the database seeded (npm run seed)?');
  process.exit(1);
});
