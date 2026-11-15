
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match) {
        return res.status(401).json({ message: 'Please log in to continue.' });
    }
    try {
        const decoded = jwt.verify(match[1], process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');
        if (!req.user) {
            return res.status(401).json({ message: 'Please log in again.' });
        }
    } catch (error) {
        return res.status(401).json({ message: 'Your session could not be verified. Please log in again.' });
    }
    return next();
};

const organiserOnly = (req, res, next) => {
    // Always use the current database user loaded by protect, never a JWT/body role.
    if (req.user?.role !== 'organiser') {
        return res.status(403).json({ message: 'Organiser access is required.' });
    }
    return next();
};

module.exports = { protect, organiserOnly };
