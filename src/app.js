const express = require('express');
const cors = require('cors');
const categoryRoutes = require('./routes/category.routes');
const levelRoutes = require('./routes/level.routes');
const wordRoutes = require('./routes/word.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', categoryRoutes);
app.use('/api', levelRoutes);
app.use('/api', wordRoutes);

module.exports = app;