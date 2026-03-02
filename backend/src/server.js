const express = require('express');
const cors = require('cors');
require('dotenv/config');

const apiRoutes = require('./routes/index.route');
const { attachUser } = require('./middleware/auth.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to the Quiz Quest API',
    version: '1.0.0',
  });
});

app.use('/api', apiRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});