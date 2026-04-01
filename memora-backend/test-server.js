const express = require('express');
const cors = require('cors');

const app = express();

// Basic middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Test route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Memora Backend API is running',
    timestamp: new Date().toISOString(),
    port: 8080
  });
});

// Test auth routes
app.post('/api/auth/register', (req, res) => {
  res.json({ 
    success: true, 
    message: 'User registered successfully',
    user: { id: 1, email: req.body.email, username: req.body.username }
  });
});

app.post('/api/auth/login', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Login successful',
    user: { id: 1, email: req.body.email },
    token: 'fake-jwt-token'
  });
});

const PORT = 8080;

app.listen(PORT, () => {
  console.info(`Memora test server running on port ${PORT}`);
});

module.exports = app;
