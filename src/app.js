const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient()

const userRoute = require('./routes/userRoute');
const authRoutes = require('./routes/authRoute');

const app = express();
const httpServer = createServer(app);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoute);


app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
      message: 'Something went wrong!',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

module.exports = { app, httpServer };