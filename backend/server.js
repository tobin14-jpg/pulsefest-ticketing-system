
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();


const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/reservations', require('./routes/reservationRoutes'));
//app.use('/api/tasks', require('./routes/taskRoutes'));

// Export the app object for testing
if (require.main === module) {
    const start = async () => {
        await connectDB();
        // Build uniqueness indexes before accepting booking requests.
        await require('./models/Reservation').init();
        const PORT = process.env.PORT || 5001;
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
    };
    start().catch(() => {
        console.error('Server startup failed. Check database connectivity and index permissions.');
        process.exit(1);
    });
  }


module.exports = app
