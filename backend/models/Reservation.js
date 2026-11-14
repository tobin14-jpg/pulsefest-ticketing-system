const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    attendeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quantity: { type: Number, required: true, min: 1, max: 4, validate: Number.isInteger },
    bookingReference: { type: String, required: true, unique: true },
    // Retrying the same request must not purchase a second set of tickets.
    requestId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

reservationSchema.index({ attendeeId: 1, requestId: 1 }, { unique: true });

module.exports = mongoose.model('Reservation', reservationSchema);
