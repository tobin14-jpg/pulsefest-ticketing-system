const express = require('express');
const { listEvents, getEvent } = require('../controllers/eventController');
const { protect, organiserOnly } = require('../middleware/authMiddleware');
const { listManagedEvents, createEvent, updateCapacity } = require('../controllers/organiserController');

const router = express.Router();
router.get('/', protect, listEvents);
router.get('/manage', protect, organiserOnly, listManagedEvents);
router.post('/', protect, organiserOnly, createEvent);
router.patch('/:id', protect, organiserOnly, updateCapacity);
router.get('/:id', protect, getEvent);

module.exports = router;
