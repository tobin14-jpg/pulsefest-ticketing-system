const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const identity = (user) => ({
    id: user.id, name: user.name, email: user.email, role: user.role || 'attendee',
});
const validName = (value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 120;
const validEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const validPassword = (value) => typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 72;
const roleSupplied = (body) => Object.prototype.hasOwnProperty.call(body, 'role');
const safeError = (res, error) => res.status(error.code === 11000 ? 409 : 503).json({
    message: error.code === 11000 ? 'That email is already registered.' : 'The account request could not be completed. Please try again.',
});

const registerUser = async (req, res) => {
    const body = req.body || {};
    if (roleSupplied(body)) return res.status(403).json({ message: 'Roles cannot be assigned through registration.' });
    if (!validName(body.name) || !validEmail(body.email) || !validPassword(body.password) || body.password.length < 8) {
        return res.status(400).json({ message: 'Enter a name (up to 120 characters), valid email and password of at least 8 characters (up to 72 UTF-8 bytes).' });
    }
    try {
        const userExists = await User.findOne({ email: body.email.trim() });
        if (userExists) return res.status(409).json({ message: 'That email is already registered.' });
        // Whitelist fields and force the default role, regardless of supplied data.
        const user = await User.create({ name: body.name.trim(), email: body.email.trim(), password: body.password, role: 'attendee' });
        return res.status(201).json({ ...identity(user), token: generateToken(user.id) });
    } catch (error) {
        return safeError(res, error);
    }
};

const loginUser = async (req, res) => {
    const { email, password } = req.body || {};
    if (!validEmail(email) || !validPassword(password)) {
        return res.status(400).json({ message: 'Enter a valid email and password.' });
    }
    try {
        const user = await User.findOne({ email: email.trim() });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        return res.json({ ...identity(user), token: generateToken(user.id) });
    } catch (error) {
        return safeError(res, error);
    }
};

const getProfile = async (req, res) => {
    // protect already loaded the current database user without the password.
    res.set('Cache-Control', 'no-store');
    return res.json({ ...identity(req.user), university: req.user.university || '', address: req.user.address || '' });
};

const updateUserProfile = async (req, res) => {
    const body = req.body || {};
    if (roleSupplied(body)) return res.status(403).json({ message: 'Roles cannot be changed through profile updates.' });
    if ((body.name !== undefined && !validName(body.name)) || (body.email !== undefined && !validEmail(body.email)) ||
        ['university', 'address'].some((key) => body[key] !== undefined && (typeof body[key] !== 'string' || body[key].trim().length > 300))) {
        return res.status(400).json({ message: 'Enter a valid name/email and text of up to 300 characters for university/address.' });
    }
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });
        for (const key of ['name', 'email', 'university', 'address']) {
            if (body[key] !== undefined) user[key] = body[key].trim();
        }
        const updated = await user.save();
        return res.json({ ...identity(updated), university: updated.university || '', address: updated.address || '', token: generateToken(updated.id) });
    } catch (error) {
        return safeError(res, error);
    }
};

module.exports = { registerUser, loginUser, updateUserProfile, getProfile };