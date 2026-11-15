const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdtemp, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const mongoose = require('mongoose');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const app = require('../server');

describe('Festival browsing with a real isolated MongoDB', function () {
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
        await mongoose.connect('mongodb://127.0.0.1:' + port + '/pulsefest_test', { serverSelectionTimeoutMS: 5000 });
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
        if (mongoose.connection.readyState === 1) await Event.deleteMany({});
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
});

