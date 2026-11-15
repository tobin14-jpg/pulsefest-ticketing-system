const Event = require('../models/Event');

const listEvents = async (req, res) => {
    try {
        const events = await Event.find({ date: { $gt: new Date() } })
            .select('name description date location price capacity reservedTickets')
            .sort({ date: 1, _id: 1 })
            .lean();

        res.set('Cache-Control', 'no-store');
        res.json(events.map((event) => ({
            _id: event._id,
            name: event.name,
            description: event.description,
            date: event.date,
            location: event.location,
            price: event.price,
            capacity: event.capacity,
            remainingTickets: event.capacity - (event.reservedTickets || 0),
        })));
    } catch (error) {
        res.status(503).json({ message: 'Festivals could not be loaded. Please try again shortly.' });
    }
};

const getEvent = async (req, res) => {
    if (!/^[0-9a-f]{24}$/i.test(req.params.id)) {
        return res.status(400).json({ message: 'Invalid festival ID.' });
    }
    try {
        const event = await Event.findById(req.params.id)
            .select('name description date location price capacity reservedTickets').lean();
        if (!event) return res.status(404).json({ message: 'Festival not found.' });
        res.set('Cache-Control', 'no-store');
        const { reservedTickets = 0, ...details } = event;
        return res.json({ ...details, remainingTickets: event.capacity - reservedTickets });
    } catch (error) {
        return res.status(503).json({ message: 'This festival could not be loaded. Please try again.' });
    }
};

module.exports = { listEvents, getEvent };
