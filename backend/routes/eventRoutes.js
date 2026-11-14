const express = require('express');
const { listEvents, getEvent } = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();
router.get('/', protect, listEvents);
router.get('/:id', protect, getEvent);

module.exports = router;
