const Event = require('../models/Event');

const eventDetails = (event) => ({
    _id: event._id, name: event.name, description: event.description,
    date: event.date, location: event.location, price: event.price,
    capacity: event.capacity, reservedTickets: event.reservedTickets || 0,
    remainingTickets: event.capacity - (event.reservedTickets || 0),
});
const validText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const validCapacity = (value) => Number.isSafeInteger(value) && value >= 0;

const listManagedEvents = async (req, res) => {
    try {
        const events = await Event.find().sort({ date: 1, _id: 1 }).lean();
        res.set('Cache-Control', 'no-store');
        return res.json(events.map(eventDetails));
    } catch (error) {
        return res.status(503).json({ message: 'Events could not be loaded. Please try again.' });
    }
};

const createEvent = async (req, res) => {
    const body = req.body || {};
    const allowed = ['name', 'description', 'date', 'location', 'price', 'capacity'];
    if (Object.keys(body).some((key) => !allowed.includes(key))) {
        return res.status(400).json({ message: 'Only festival name, description, date, location, price and capacity may be supplied.' });
    }
    if (!validText(body.name, 120) || !validText(body.location, 200)) {
        return res.status(400).json({ message: 'Enter a name (up to 120 characters) and location (up to 200 characters).' });
    }
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.trim().length > 2000)) {
        return res.status(400).json({ message: 'Description must be text of at most 2000 characters.' });
    }
    // Require a real UTC ISO timestamp; reject dates JavaScript would silently normalise.
    const date = typeof body.date === 'string' ? new Date(body.date) : new Date(NaN);
    const canonical = Number.isFinite(date.getTime()) ? date.toISOString() : '';
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(body.date || '') ||
        (canonical !== body.date && canonical.replace('.000Z', 'Z') !== body.date) || date <= new Date()) {
        return res.status(400).json({ message: 'Choose a valid future date and time (send an ISO UTC timestamp).' });
    }
    if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 ||
        body.price > Number.MAX_SAFE_INTEGER / 100 || Math.abs(body.price * 100 - Math.round(body.price * 100)) > 0.000001) {
        return res.status(400).json({ message: 'Price must be a non-negative number with at most two decimal places.' });
    }
    if (!validCapacity(body.capacity)) {
        return res.status(400).json({ message: 'Capacity must be a non-negative whole number.' });
    }
    try {
        const event = await Event.create({
            name: body.name.trim(), description: (body.description || '').trim(),
            date, location: body.location.trim(), price: body.price, capacity: body.capacity,
            createdBy: req.user._id,
        });
        return res.status(201).json(eventDetails(event));
    } catch (error) {
        return res.status(503).json({ message: 'The festival could not be created. Check the dashboard before retrying.' });
    }
};

const updateCapacity = async (req, res) => {
    if (!/^[0-9a-f]{24}$/i.test(req.params.id)) {
        return res.status(400).json({ message: 'Invalid festival ID.' });
    }
    const body = req.body || {};
    if (Object.keys(body).length !== 1 || !validCapacity(body.capacity)) {
        return res.status(400).json({ message: 'Supply only capacity, as a non-negative whole number.' });
    }
    try {
        // The predicate and update run atomically on the same document bookings modify.
        const event = await Event.findOneAndUpdate({
            _id: req.params.id,
            $expr: { $lte: [{ $ifNull: ['$reservedTickets', 0] }, body.capacity] },
        }, { $set: { capacity: body.capacity } }, { new: true, runValidators: true });
        if (!event) {
            const exists = await Event.exists({ _id: req.params.id });
            return res.status(exists ? 409 : 404).json({ message: exists
                ? 'Capacity cannot be lower than tickets already reserved. Refresh the event and try again.'
                : 'Festival not found.' });
        }
        return res.json(eventDetails(event));
    } catch (error) {
        return res.status(503).json({ message: 'Capacity could not be updated. Please try again.' });
    }
};

module.exports = { listManagedEvents, createEvent, updateCapacity };
