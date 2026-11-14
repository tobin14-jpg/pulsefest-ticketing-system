const express = require('express');
const { listEvents } = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/', protect, listEvents);

module.exports = router;
