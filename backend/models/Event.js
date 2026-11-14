const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    date: { type: Date, required: true },
    location: { type: String, required: true, trim: true, maxlength: 200 },
    price: { type: Number, required: true, min: 0, validate: Number.isFinite },
    capacity: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
    // The reservation workflow will update this counter within a transaction.
    reservedTickets: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
});

eventSchema.index({ date: 1, _id: 1 });

module.exports = mongoose.model('Event', eventSchema);
