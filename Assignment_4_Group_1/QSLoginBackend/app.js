const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./db');

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
  if(await db.findUserByEmail(email)) {
    return res.status(409).json({error: 'An account already exists with that email.'});
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await db.createUser({ name, email, password: hashedPassword, role: 'user' });

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

  const user = await db.findUserByEmail(email);
  if(!user) {
    return res.status(401).json({error: "Invalid email or password."});
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if(!passwordMatches) {
    return res.status(401).json({error: 'Invalid email or password'});
  }

  res.status(200).json({ id: user.user_id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/admin-login', async (req, res) => {
  const {email, password} = req.body;

  if(!email || !password) {
    return res.status(400).json({error: 'Email and password are required.'});
  }
  if(!emailRegex.test(email)) {
    return res.status(400).json({error: 'Please provide a valid email address.'});
  }

  const user = await db.findUserByEmail(email);
  if(!user) {
    return res.status(401).json({error: 'Invalid email or password.'});
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if(!passwordMatches) {
    return res.status(401).json({error: 'Invalid email or password.'});
  }
  if(user.role !== 'Administrator') {
    return res.status(403).json({error: 'You do not have adminstrator access.'});
  }

  res.status(200).json({ id: user.user_id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/debug/make-admin', async (req, res) => {
  const {email} = req.body;
  const user = await db.findUserByEmail(email);
  if(!user) {
    return res.status(404).json({error: 'No user with that email.'});
  }
  await db.updateUserRole(email, 'Administrator');
  res.json({
    message: `${email} is now an admin`,
    user: { id: user.user_id, name: user.name, email: user.email, role: 'Administrator' }
  });
});

app.put('/api/user/update', async (req, res) => {
  const {email, currentPassword, newName, newPassword} = req.body;
  if(!email || !currentPassword) {
    return res.status(400).json({error: 'Email and current password are required.'});
  }
  
  const user = await db.findUserByEmail(email);
  if(!user) {
    return res.status(401).json({error: 'Invalid credentials.'});
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.password_hash);
  if(!passwordMatches) {
    return res.status(401).json({error: 'Current password is incorrect.'});
  }

  const updates = {};
  if(newName) {
    updates.name = newName;
  }

  if(newPassword) {
    if(newPassword.length < 8 || newPassword.length > 20) {
      return res.status(400).json({error: 'New password must be between 8 and 20 characters in length.'});
    }
    updates.password_hash = await bcrypt.hash(newPassword, 10);
  }

  await db.updateUser(user.user_id, updates);

  res.status(200).json({message: 'Account updated successfully.'});
});

module.exports = app;