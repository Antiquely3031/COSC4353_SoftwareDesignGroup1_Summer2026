const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./fakeDB');

const app = express();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.post('/api/signup', async (req, res) => {
  const {name, email, password} = req.body;

  if(!name || !email || !password) {
    return res.status(400).json({error: 'Name, email, and password are required.'});
  }
  if(password.length < 8 || password.length > 20) {
    return res.status(400).json({error: 'Password must be between 8 and 20 characters.'});
  }
  if(!emailRegex.test(email)) {
    return res.status(400).json({error: 'Please provide a valid email address.'});
  }
  if(db.findUserByEmail(email)) {
    return res.status(409).json({error: 'An account already exists with that email.'});
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = db.createUser({ name, email, password: hashedPassword, role: 'user' });

  res.status(201).json({
    id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role
  });
});

app.post('/api/login', async (req, res) => {
  const {email, password} = req.body;

  if(!email || !password) {
    return res.status(400).json({error: 'Email and password are required.'});
  }
  if(!emailRegex.test(email)) {
    return res.status(400).json({error: 'Please provide a valid email address.'});
  }

  const user = db.findUserByEmail(email);
  if(!user) {
    return res.status(401).json({error: "Invalid email or password."});
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if(!passwordMatches) {
    return res.status(401).json({error: 'Invalid email or password'});
  }

  res.status(200).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/admin-login', async (req, res) => {
  const {email, password} = req.body;

  if(!email || !password) {
    return res.status(400).json({error: 'Email and password are required.'});
  }
  if(!emailRegex.test(email)) {
    return res.status(400).json({error: 'Please provide a valid email address.'});
  }

  const user = db.findUserByEmail(email);
  if(!user) {
    return res.status(401).json({error: 'Invalid email or password.'});
  }

  const passwordMatches = await bcrypt.compare(password, user.password);
  if(!passwordMatches) {
    return res.status(401).json({error: 'Invalid email or password.'});
  }
  if(user.role !== 'admin') {
    return res.status(403).json({error: 'You do not have adminstrator access.'});
  }

  res.status(200).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/debug/make-admin', (req, res) => {
  const {email} = req.body;
  const user = db.findUserByEmail(email);
  if(!user) {
    return res.status(404).json({error: 'No user with that email.'});
  }
  user.role = 'admin';
  res.json({
    message: `${email} is now an admin`,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

module.exports = app;