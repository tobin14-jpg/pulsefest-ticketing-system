// Temporary development fixture until the organiser create-event workflow exists.
require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../models/Event');
const User = require('../models/User');

async function seedFestival() {
    if (process.env.NODE_ENV !== 'development' || !process.argv.includes('--confirm-demo-data')) {
        throw new Error('Use NODE_ENV=development and --confirm-demo-data for the development database only.');
    }
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne().sort({ _id: 1 }).select('_id');
    if (!user) throw new Error('Register a test account in the application first.');
    const name = 'PulseFest Demo Festival';
    const existing = await Event.findOne({ name });
    if (existing) {
        console.log('The demo festival already exists; its date, capacity and bookings were left unchanged.');
        return;
    }
    await Event.create({
        name,
        description: 'Development test festival for the PFT-6 reservation workflow.',
        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        location: 'Demo Park, Perth', price: 25, capacity: 12,
        createdBy: user._id,
    });
    console.log('Created PulseFest Demo Festival with 12 tickets. No reservations or user roles were changed.');
}

seedFestival().catch((error) => {
    console.error(error.name === 'Error' ? error.message : 'Could not create the demo festival. Check database configuration.');
    process.exitCode = 1;
}).finally(() => mongoose.disconnect());
