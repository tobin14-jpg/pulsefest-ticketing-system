const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { reserveTickets, getReservation } = require('../controllers/reservationController');

const router = express.Router();
router.use(protect);
router.post('/', reserveTickets);
router.get('/:reference', getReservation);

module.exports = router;
