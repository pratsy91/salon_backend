const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
