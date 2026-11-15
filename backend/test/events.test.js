const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const mongoose = require('mongoose');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const Reservation = require('../models/Reservation');
const User = require('../models/User');
const { promoteOrganiser } = require('../scripts/promoteOrganiser');
const app = require('../server');

describe('Festival browsing and reservations with an isolated MongoDB replica set', function () {
    this.timeout(30000);
    let database, dataPath, server, baseURL, token, attendeeId, databaseExited;
    const previousSecret = process.env.JWT_SECRET;

    before(async function () {
        process.env.JWT_SECRET = randomBytes(32).toString('hex');
        const portServer = net.createServer();
        await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve));
        const port = portServer.address().port;
        await new Promise((resolve) => portServer.close(resolve));
        dataPath = await mkdtemp(path.join(tmpdir(), 'pulsefest-test-'));
        database = spawn(process.env.MONGOD_BINARY || 'mongod', [
            '--dbpath', dataPath, '--bind_ip', '127.0.0.1', '--port', String(port),
            '--replSet', 'pulsefestTest',
        ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        databaseExited = new Promise((resolve) => database.once('exit', resolve));
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Test MongoDB did not start within 15 seconds.')), 15000);
            const finish = (error) => { clearTimeout(timeout); error ? reject(error) : resolve(); };
            database.once('error', () => finish(new Error('Install mongod or set MONGOD_BINARY to run integration tests.')));
            database.once('exit', (code) => finish(new Error('Test MongoDB exited with code ' + code)));
            database.stdout.on('data', (chunk) => { if (chunk.toString().includes('Waiting for connections')) finish(); });
            database.stderr.resume();
        });
        mongoose.set('strictQuery', true);
        const uri = 'mongodb://127.0.0.1:' + port + '/pulsefest_test';
        const bootstrap = new mongoose.mongo.MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 });
        try {
            await bootstrap.connect();
            await bootstrap.db('admin').command({ replSetInitiate: {
                _id: 'pulsefestTest', members: [{ _id: 0, host: '127.0.0.1:' + port }],
            } });
            const deadline = Date.now() + 15000;
            while (!(await bootstrap.db('admin').command({ hello: 1 })).isWritablePrimary) {
                if (Date.now() > deadline) throw new Error('Test replica set did not elect a primary.');
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
        } finally {
            await bootstrap.close();
        }
        await mongoose.connect(uri + '?replicaSet=pulsefestTest', { serverSelectionTimeoutMS: 5000 });
        await Event.init();
        await Reservation.init();
        server = app.listen(0, '127.0.0.1');
        await new Promise((resolve) => server.once('listening', resolve));
        baseURL = 'http://127.0.0.1:' + server.address().port;
        const registration = await fetch(baseURL + '/api/auth/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Test attendee', email: 'attendee@example.test', password: randomBytes(16).toString('hex') }),
        });
        assert.equal(registration.status, 201);
        const attendee = await registration.json();
        token = attendee.token;
        attendeeId = attendee.id;
    });

    afterEach(async function () {
        sinon.restore();
        if (mongoose.connection.readyState === 1) {
            await Reservation.deleteMany({});
            await Event.deleteMany({});
        }
    });

    after(async function () {
        if (server) await new Promise((resolve) => server.close(resolve));
        await mongoose.disconnect();
        if (database && database.exitCode === null && database.pid) {
            database.kill();
            await databaseExited;
        }
        if (dataPath) {
            const relative = path.relative(tmpdir(), path.resolve(dataPath));
            if (!relative.startsWith('pulsefest-test-') || relative.includes(path.sep)) {
                throw new Error('Refusing to clean an unexpected test directory.');
            }
            await rm(dataPath, { recursive: true, force: true });
        }
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });

    const request = (auth = token) => fetch(baseURL + '/api/events', {
        headers: auth ? { Authorization: 'Bearer ' + auth } : {},
    });
    const festival = (overrides = {}) => ({
        name: 'River Sounds', description: 'Live music by the river.',
        date: new Date(Date.now() + 86400000), location: 'Perth', price: 25,
        capacity: 10, createdBy: attendeeId, ...overrides,
    });

    it('requires authentication', async function () {
        assert.equal((await request(null)).status, 401);
        assert.equal((await request('invalid')).status, 401);
    });

    it('returns an empty list when there are no festivals', async function () {
        const response = await request();
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), []);
    });

    it('reads persisted upcoming festivals in date order with current availability', async function () {
        await Event.create(festival({ name: 'Later festival', date: new Date(Date.now() + 172800000) }));
        await Event.create(festival({ reservedTickets: 3 }));
        await Event.create(festival({ name: 'Past festival', date: new Date(Date.now() - 86400000) }));
        const response = await request();
        const events = await response.json();
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(events.map((event) => event.name), ['River Sounds', 'Later festival']);
        assert.equal(events[0].remainingTickets, 7);
        assert.equal(events[0].price, 25);
        assert.equal(events[0].location, 'Perth');
        assert.equal(events[0].createdBy, undefined);
        assert.equal(events[0].__v, undefined);
    });

    it('includes sold-out festivals with zero remaining tickets', async function () {
        await Event.create(festival({ reservedTickets: 10 }));
        const response = await request();
        assert.equal((await response.json())[0].remainingTickets, 0);
    });

    it('rejects negative or fractional capacity and negative prices', async function () {
        for (const overrides of [{ capacity: -1 }, { capacity: 1.5 }, { price: -1 }]) {
            await assert.rejects(Event.create(festival(overrides)), { name: 'ValidationError' });
        }
        assert.equal(await Event.countDocuments(), 0);
    });

    it('rejects a valid token for an account that no longer exists', async function () {
        const deletedId = new mongoose.Types.ObjectId().toString();
        const deletedToken = jwt.sign({ id: deletedId }, process.env.JWT_SECRET);
        assert.equal((await request(deletedToken)).status, 401);
    });

    it('returns a helpful error without database details when the query fails', async function () {
        sinon.stub(Event, 'find').throws(new Error('private database information'));
        const response = await request();
        assert.equal(response.status, 503);
        const body = await response.json();
        assert.match(body.message, /try again/i);
        assert.ok(!JSON.stringify(body).includes('private'));
    });

    it('preserves the existing authenticated profile endpoint', async function () {
        const response = await fetch(baseURL + '/api/auth/profile', { headers: { Authorization: 'Bearer ' + token } });
        assert.equal(response.status, 200);
        const profile = await response.json();
        assert.equal(profile.email, 'attendee@example.test');
        assert.equal(profile.password, undefined);
    });

    const book = (eventId, quantity = 1, requestId = randomUUID(), auth = token, extra = {}) => fetch(baseURL + '/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
        body: JSON.stringify({ eventId, quantity, requestId, ...extra }),
    });
    const readBooking = (reference, auth = token) => fetch(baseURL + '/api/reservations/' + reference, {
        headers: { Authorization: 'Bearer ' + auth },
    });

    it('persists a reservation and exposes confirmation only to its attendee', async function () {
        const event = await Event.create(festival());
        const response = await book(event.id, 4, randomUUID(), token, { attendeeId: new mongoose.Types.ObjectId() });
        assert.equal(response.status, 201);
        const booking = await response.json();
        assert.match(booking.bookingReference, /^PF-[0-9a-f-]{36}$/);
        const saved = await Reservation.findOne({ bookingReference: booking.bookingReference });
        assert.equal(String(saved.attendeeId), attendeeId);
        assert.equal(saved.quantity, 4);
        assert.equal((await Event.findById(event.id)).reservedTickets, 4);
        const listing = await (await request()).json();
        assert.equal(listing[0].remainingTickets, 6);
        const confirmationResponse = await readBooking(booking.bookingReference);
        assert.equal(confirmationResponse.status, 200);
        assert.equal(confirmationResponse.headers.get('cache-control'), 'no-store');
        const confirmation = await confirmationResponse.json();
        assert.equal(confirmation.eventId.name, 'River Sounds');
        assert.equal(confirmation.quantity, 4);
        assert.equal(confirmation.attendeeId, undefined);
        assert.equal(confirmation.requestId, undefined);
        const otherUser = await require('../models/User').create({ name: 'Other attendee', email: 'other@example.test', password: randomBytes(16).toString('hex') });
        const otherToken = jwt.sign({ id: otherUser.id }, process.env.JWT_SECRET);
        assert.equal((await readBooking(booking.bookingReference, otherToken)).status, 404);
    });

    it('rejects unauthenticated bookings and confirmation reads', async function () {
        const event = await Event.create(festival());
        assert.equal((await book(event.id, 1, randomUUID(), null)).status, 401);
        assert.equal((await readBooking('PF-' + randomUUID(), 'invalid')).status, 401);
        assert.equal(await Reservation.countDocuments(), 0);
    });

    it('rejects invalid quantities and request identifiers without changing availability', async function () {
        const event = await Event.create(festival());
        for (const quantity of [0, -1, 5, 1.5, '2', null, true, {}, [1]]) {
            assert.equal((await book(event.id, quantity)).status, 400);
        }
        assert.equal((await book(event.id, 1, 'invalid')).status, 400);
        assert.equal((await book({ $ne: null })).status, 400);
        assert.equal((await book('invalid')).status, 400);
        assert.equal((await Event.findById(event.id)).reservedTickets, 0);
        assert.equal(await Reservation.countDocuments(), 0);
    });

    it('rejects nonexistent, past, sold-out and insufficient-capacity festivals', async function () {
        assert.equal((await book(new mongoose.Types.ObjectId().toString())).status, 404);
        for (const overrides of [{ date: new Date(Date.now() - 1000) }, { capacity: 0 }, { capacity: 1 }]) {
            const event = await Event.create(festival(overrides));
            assert.equal((await book(event.id, 2)).status, 409);
            assert.equal((await Event.findById(event.id)).reservedTickets, 0);
        }
        assert.equal(await Reservation.countDocuments(), 0);
    });

    it('rolls back the capacity claim when reservation persistence fails', async function () {
        const event = await Event.create(festival());
        sinon.stub(Reservation, 'create').rejects(new Error('private storage failure'));
        const response = await book(event.id, 3);
        assert.equal(response.status, 503);
        assert.ok(!JSON.stringify(await response.json()).includes('private'));
        assert.equal((await Event.findById(event.id)).reservedTickets, 0);
        assert.equal(await Reservation.countDocuments(), 0);
    });

    it('does not oversell when twelve bookings compete for five tickets', async function () {
        const event = await Event.create(festival({ capacity: 5 }));
        const responses = await Promise.all(Array.from({ length: 12 }, () => book(event.id)));
        assert.equal(responses.filter((response) => response.status === 201).length, 5);
        assert.equal(responses.filter((response) => response.status === 409).length, 7);
        const reservations = await Reservation.find({ eventId: event.id });
        assert.equal(reservations.reduce((sum, item) => sum + item.quantity, 0), 5);
        assert.equal(new Set(reservations.map((item) => item.bookingReference)).size, 5);
        assert.equal((await Event.findById(event.id)).reservedTickets, 5);
    });

    it('returns the same saved booking for concurrent retries and rejects changed payloads', async function () {
        const event = await Event.create(festival({ capacity: 4 }));
        const requestId = randomUUID();
        const responses = await Promise.all(Array.from({ length: 4 }, () => book(event.id, 4, requestId)));
        assert.equal(responses.filter((response) => response.status === 201).length, 1);
        assert.equal(responses.filter((response) => response.status === 200).length, 3);
        const bookings = await Promise.all(responses.map((response) => response.json()));
        assert.equal(new Set(bookings.map((booking) => booking.bookingReference)).size, 1);
        assert.equal(await Reservation.countDocuments(), 1);
        assert.equal((await Event.findById(event.id)).reservedTickets, 4);
        assert.equal((await book(event.id, 1, requestId)).status, 409);
    });

    it('retrieves festival detail and handles invalid or missing references', async function () {
        const event = await Event.create(festival({ reservedTickets: 2 }));
        const response = await fetch(baseURL + '/api/events/' + event.id, { headers: { Authorization: 'Bearer ' + token } });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).remainingTickets, 8);
        assert.equal((await readBooking('invalid')).status, 400);
        assert.equal((await readBooking('PF-' + randomUUID())).status, 404);
    });

    const api = (method, url, body, auth = token) => fetch(baseURL + url, {
        method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: 'Bearer ' + auth } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const eventBody = (overrides = {}) => ({
        name: 'Organiser Sounds', description: 'A real festival', date: new Date(Date.now() + 86400000).toISOString(),
        location: 'Perth', price: 25.50, capacity: 10, ...overrides,
    });
    let organiserToken;
    let organiserId;

    it('creates an organiser only through explicit development setup and returns its role at login', async function () {
        const password = randomBytes(16).toString('hex');
        const email = 'organiser-test@example.test';
        const registered = await api('POST', '/api/auth/register', { name: 'Organiser', email, password }, null);
        assert.equal(registered.status, 201);
        const account = await registered.json();
        assert.equal(account.role, 'attendee');
        organiserId = account.id;
        const update = sinon.spy(User, 'findOneAndUpdate');
        await assert.rejects(promoteOrganiser({ nodeEnv: 'production', allowed: 'true', email }), /requires NODE_ENV/);
        await assert.rejects(promoteOrganiser({ nodeEnv: 'development', allowed: 'false', email }), /requires NODE_ENV/);
        await assert.rejects(promoteOrganiser({ nodeEnv: 'development', allowed: 'true', email: { $ne: null } }), /exact email/);
        assert.equal(update.callCount, 0);
        const beforePassword = (await User.findById(account.id)).password;
        await promoteOrganiser({ nodeEnv: 'development', allowed: 'true', email });
        assert.equal((await User.findById(account.id)).password, beforePassword);
        const login = await api('POST', '/api/auth/login', { email, password }, null);
        assert.equal(login.status, 200);
        const signedIn = await login.json();
        assert.equal(signedIn.role, 'organiser');
        assert.equal(signedIn.password, undefined);
        organiserToken = signedIn.token;
        // The original token also uses the new database role, not an old JWT claim.
        assert.equal((await api('GET', '/api/events/manage', undefined, account.token)).status, 200);
    });

    it('rejects role injection through registration and profile changes', async function () {
        const response = await api('POST', '/api/auth/register', {
            name: 'Injected', email: 'injected@example.test', password: 'valid-test-password', role: 'organiser',
        }, null);
        assert.equal(response.status, 403);
        assert.equal(await User.countDocuments({ email: 'injected@example.test' }), 0);
        assert.equal((await api('PUT', '/api/auth/profile', { role: 'organiser' })).status, 403);
        const update = await api('PUT', '/api/auth/profile', { name: 'Still attendee', address: '' });
        assert.equal(update.status, 200);
        assert.equal((await update.json()).role, 'attendee');
        assert.equal((await User.findById(attendeeId)).role, 'attendee');
    });

    it('enforces organiser permissions for every management endpoint including forged JWT role claims', async function () {
        const event = await Event.create(festival());
        const forgedRole = jwt.sign({ id: attendeeId, role: 'organiser' }, process.env.JWT_SECRET);
        for (const auth of [null, token, forgedRole]) {
            const expected = auth ? 403 : 401;
            assert.equal((await api('GET', '/api/events/manage', undefined, auth)).status, expected);
            assert.equal((await api('POST', '/api/events', eventBody(), auth)).status, expected);
            assert.equal((await api('PATCH', '/api/events/' + event.id, { capacity: 100 }, auth)).status, expected);
        }
        assert.equal(await Event.countDocuments(), 1);
        assert.equal((await Event.findById(event.id)).capacity, 10);
    });

    it('treats legacy accounts without a role as attendees and honours role revocation immediately', async function () {
        await User.collection.updateOne({ _id: new mongoose.Types.ObjectId(attendeeId) }, { $unset: { role: '' } });
        assert.equal((await api('GET', '/api/events/manage')).status, 403);
        assert.equal((await (await api('GET', '/api/auth/profile')).json()).role, 'attendee');
        await User.updateOne({ _id: organiserId }, { $set: { role: 'attendee' } });
        try {
            assert.equal((await api('POST', '/api/events', eventBody(), organiserToken)).status, 403);
        } finally {
            await User.updateOne({ _id: organiserId }, { $set: { role: 'organiser' } });
        }
    });

    it('completes organiser create, attendee reserve and organiser capacity-edit workflows', async function () {
        const created = await api('POST', '/api/events', eventBody({ name: '  New Festival  ', capacity: 6 }), organiserToken);
        assert.equal(created.status, 201);
        const event = await created.json();
        assert.equal(event.name, 'New Festival');
        assert.equal(event.remainingTickets, 6);
        assert.equal(String((await Event.findById(event._id)).createdBy), organiserId);
        assert.equal((await book(event._id, 4)).status, 201);
        assert.equal((await api('PATCH', '/api/events/' + event._id, { capacity: 3 }, organiserToken)).status, 409);
        assert.equal((await Event.findById(event._id)).capacity, 6);
        const increased = await api('PATCH', '/api/events/' + event._id, { capacity: 8 }, organiserToken);
        assert.equal(increased.status, 200);
        assert.equal((await increased.json()).remainingTickets, 4);
        const listing = await (await request()).json();
        assert.equal(listing[0].capacity, 8);
        assert.equal(listing[0].remainingTickets, 4);
        const equalReserved = await api('PATCH', '/api/events/' + event._id, { capacity: 4 }, organiserToken);
        assert.equal(equalReserved.status, 200);
        assert.equal((await equalReserved.json()).remainingTickets, 0);
    });

    it('validates event fields, prevents internal-field injection and allows zero capacity and free events', async function () {
        for (const override of [
            { name: ' ' }, { name: 'x'.repeat(121) }, { location: '' }, { location: {} },
            { description: {} }, { description: 'x'.repeat(2001) }, { date: 'invalid' },
            { date: '2099-02-30T10:00:00.000Z' }, { date: new Date(Date.now() - 1000).toISOString() },
            { date: 1234 }, { price: -1 }, { price: '25' }, { price: 1.234 },
            { capacity: -1 }, { capacity: 1.5 }, { capacity: '10' }, { capacity: Number.MAX_SAFE_INTEGER + 1 },
            { createdBy: attendeeId }, { reservedTickets: -10 },
        ]) {
            assert.equal((await api('POST', '/api/events', eventBody(override), organiserToken)).status, 400, JSON.stringify(override));
        }
        assert.equal(await Event.countDocuments(), 0);
        const response = await api('POST', '/api/events', eventBody({ capacity: 0, price: 0 }), organiserToken);
        assert.equal(response.status, 201);
        assert.equal((await response.json()).remainingTickets, 0);
    });

    it('lists past and sold-out events for organisers and rejects invalid capacity patches', async function () {
        const event = await Event.create(festival({ date: new Date(Date.now() - 1000), capacity: 0 }));
        const list = await api('GET', '/api/events/manage', undefined, organiserToken);
        assert.equal(list.status, 200);
        const events = await list.json();
        assert.equal(events.length, 1);
        assert.equal(events[0].remainingTickets, 0);
        for (const body of [{}, { capacity: -1 }, { capacity: 2.5 }, { capacity: '10' }, { capacity: null }, { capacity: 10, reservedTickets: 0 }]) {
            assert.equal((await api('PATCH', '/api/events/' + event.id, body, organiserToken)).status, 400);
        }
        assert.equal((await api('PATCH', '/api/events/invalid', { capacity: 10 }, organiserToken)).status, 400);
        assert.equal((await api('PATCH', '/api/events/' + new mongoose.Types.ObjectId(), { capacity: 10 }, organiserToken)).status, 404);
        assert.equal((await Event.findById(event.id)).capacity, 0);
    });

    it('keeps capacity consistent when bookings race an organiser reduction', async function () {
        for (let run = 0; run < 8; run += 1) {
            const event = await Event.create(festival({ capacity: 4 }));
            const [booking, reduction] = await Promise.all([
                book(event.id, 4), api('PATCH', '/api/events/' + event.id, { capacity: 2 }, organiserToken),
            ]);
            assert.ok([201, 409].includes(booking.status));
            assert.ok([200, 409].includes(reduction.status));
            const savedEvent = await Event.findById(event.id);
            const savedBookings = await Reservation.find({ eventId: event.id });
            const reserved = savedBookings.reduce((sum, reservation) => sum + reservation.quantity, 0);
            assert.equal(savedEvent.reservedTickets, reserved);
            assert.ok(savedEvent.capacity >= reserved);
            assert.ok((booking.status === 201 && reduction.status === 409) || (booking.status === 409 && reduction.status === 200));
        }
    });

    it('handles invalid authentication input, malformed JSON and duplicate email without database details', async function () {
        assert.equal((await api('POST', '/api/auth/login', { email: { $ne: null }, password: 'test' }, null)).status, 400);
        assert.equal((await api('POST', '/api/auth/register', { name: 'X', email: 'x@example.test', password: 'short' }, null)).status, 400);
        assert.equal((await api('POST', '/api/auth/register', { name: 'X', email: 'attendee@example.test', password: 'validpassword' }, null)).status, 409);
        const malformed = await fetch(baseURL + '/api/events', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken',
        });
        assert.equal(malformed.status, 400);
        assert.equal((await malformed.json()).message, 'Send a valid JSON request body.');
    });
});

