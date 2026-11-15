const mongoose = require('mongoose');
const User = require('../models/User');

async function promoteOrganiser({ nodeEnv, allowed, email }) {
    if (nodeEnv !== 'development' || allowed !== 'true') {
        throw new Error('Organiser setup requires NODE_ENV=development and ALLOW_ORGANISER_SETUP=true.');
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new Error('Set ORGANISER_EMAIL to the exact email of a registered development account.');
    }
    const user = await User.findOneAndUpdate({ email: email.trim() }, { $set: { role: 'organiser' } }, { new: true, runValidators: true });
    if (!user) throw new Error('Account not found. Register it through the application first, then run this command again.');
    return user;
}

if (require.main === module) {
    require('dotenv').config();
    const run = async () => {
        // Validate the development gate before connecting to any database.
        if (process.env.NODE_ENV !== 'development' || process.env.ALLOW_ORGANISER_SETUP !== 'true') {
            throw new Error('Organiser setup requires NODE_ENV=development and ALLOW_ORGANISER_SETUP=true.');
        }
        await mongoose.connect(process.env.MONGO_URI);
        await promoteOrganiser({ nodeEnv: process.env.NODE_ENV, allowed: process.env.ALLOW_ORGANISER_SETUP, email: process.env.ORGANISER_EMAIL });
        console.log('Development account now has organiser access. Log out and log in again.');
    };
    run().catch((error) => {
        console.error(error.constructor === Error ? error.message : 'Organiser setup failed. Check the development database configuration.');
        process.exitCode = 1;
    }).finally(() => mongoose.disconnect());
}

module.exports = { promoteOrganiser };
