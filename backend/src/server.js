const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv/config');

const apiRoutes = require('./routes');
const { attachUser } = require('./middleware/auth.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const { initializeSocketServer } = require('./realtime/socket-server');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

initializeSocketServer(server);

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

server.listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});