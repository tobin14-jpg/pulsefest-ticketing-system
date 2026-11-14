const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Reservation = require('../models/Reservation');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const publicReservation = (reservation) => ({
    bookingReference: reservation.bookingReference,
    eventId: reservation.eventId,
    quantity: reservation.quantity,
    createdAt: reservation.createdAt,
});
const problem = (status, message) => Object.assign(new Error(message), { status });

const reserveTickets = async (req, res) => {
    const { eventId, quantity, requestId = randomUUID() } = req.body || {};
    if (typeof eventId !== 'string' || !/^[0-9a-f]{24}$/i.test(eventId)) {
        return res.status(400).json({ message: 'Select a valid festival.' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
        return res.status(400).json({ message: 'Choose a whole number of tickets from 1 to 4.' });
    }
    if (typeof requestId !== 'string' || !uuidPattern.test(requestId)) {
        return res.status(400).json({ message: 'The booking request ID must be a UUID v4.' });
    }
    const key = { attendeeId: req.user._id, requestId };
    const checkRepeat = (existing) => {
        if (String(existing.eventId) !== eventId.toLowerCase() || existing.quantity !== quantity) {
            throw problem(409, 'This request has already been used for a different booking. Start a new reservation.');
        }
        return existing;
    };
    let saved;
    let repeated = false;
    try {
        await mongoose.connection.transaction(async (session) => {
            // The callback can run again on a transient write conflict.
            const existing = await Reservation.findOne(key).session(session);
            if (existing) {
                saved = checkRepeat(existing);
                repeated = true;
                return;
            }
            const event = await Event.findOneAndUpdate({
                _id: eventId,
                date: { $gt: new Date() },
                $expr: { $lte: [{ $add: [{ $ifNull: ['$reservedTickets', 0] }, quantity] }, '$capacity'] },
            }, { $inc: { reservedTickets: quantity } }, { new: true, session });
            if (!event) {
                const exists = await Event.exists({ _id: eventId }).session(session);
                throw problem(exists ? 409 : 404, exists
                    ? 'This festival has started or no longer has enough tickets. Refresh availability and choose again.'
                    : 'Festival not found.');
            }
            [saved] = await Reservation.create([{
                ...key, eventId, quantity, bookingReference: `PF-${randomUUID()}`,
            }], { session });
        }, { readPreference: 'primary', readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
        // Only a completed transaction is a confirmed booking.
        return res.status(repeated ? 200 : 201).json(publicReservation(saved));
    } catch (error) {
        if (error.code === 11000) {
            // Concurrent delivery of the same request can reach the unique index.
            try {
                const existing = await Reservation.findOne(key);
                if (existing) return res.status(200).json(publicReservation(checkRepeat(existing)));
            } catch (lookupError) {
                if (lookupError.status) return res.status(lookupError.status).json({ message: lookupError.message });
            }
        }
        if (error.status) return res.status(error.status).json({ message: error.message });
        return res.status(503).json({ message: 'We could not confirm your booking. Retry the same request to check it safely.' });
    }
};

const getReservation = async (req, res) => {
    const reference = req.params.reference;
    if (!reference.startsWith('PF-') || !uuidPattern.test(reference.slice(3))) {
        return res.status(400).json({ message: 'Invalid booking reference.' });
    }
    try {
        const reservation = await Reservation.findOne({ bookingReference: reference, attendeeId: req.user._id })
            .populate('eventId', 'name date location').lean();
        if (!reservation) return res.status(404).json({ message: 'Booking not found for your account.' });
        res.set('Cache-Control', 'no-store');
        return res.json(publicReservation(reservation));
    } catch (error) {
        return res.status(503).json({ message: 'Your booking could not be loaded. Please try again.' });
    }
};

module.exports = { reserveTickets, getReservation };
