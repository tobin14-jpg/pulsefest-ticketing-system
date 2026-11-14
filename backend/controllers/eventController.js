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

module.exports = { listEvents };
