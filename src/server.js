require('dotenv').config();

const app = require('./app');
const { connectDatabase } = require('./config/db');

const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDatabase(process.env.MONGO_URI);
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
})();
