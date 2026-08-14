const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const db = require('./db');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function calculateLockoutMinutes(failedAttempts) {
  if(failedAttempts < 5) return 0;
  return Math.pow(2, failedAttempts - 5);
}

function isAnomalousLogin(user, currentIp) {
  if(!user.last_login_ip || !user.last_login_time) {
    return false;
  }
  const ipChanged = user.last_login_ip !== currentIp;
  const minutesSinceLastLogin = (Date.now() - new Date(user.last_login_time)) / 60000;
  return ipChanged && minutesSinceLastLogin < 30;
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  }
});

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

  if(user.locked_until && new Date() < new Date(user.locked_until)) {
    const remainingMs = new Date(user.locked_until) - new Date();
    const remainingMinutes = Math.ceil(remainingMs / 60000);
    return res.status(429).json({error: `Too many failed attempts. Try again in ${remainingMinutes} minutes(s).`});
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if(!passwordMatches) {
    await db.incrementFailedAttempts(user.user_id);
    const newAttemptCount = user.failed_attempts + 1;
    const lockoutMinutes = calculateLockoutMinutes(newAttemptCount);
    if(lockoutMinutes > 0) {
      const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
      await db.setLockout(user.user_id, lockedUntil);
    }
    return res.status(401).json({error: 'Invalid email or password'});
  }

  await db.resetFailedAttempts(user.user_id);

  const currentIp = req.ip;
  const anomalous = isAnomalousLogin(user, currentIp);
  if(anomalous) {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'QueueSmart - New Login Detected',
      text: `We noticed a login to your account from a different network recently. If this was you, no action need be taken. If not, consider changing your password.`
    });
  }

  await db.updateLoginTracking(user.user_id, currentIp);

  res.status(200).json({ id: user.user_id, name: user.name, email: user.email, role: user.role,
    securityNotice: anomalous ? 'We noticed unusual login activity and sent you a notification.' : null
   });
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

app.post('/api/forgot-password', async (req, res) => {
  const {email} = req.body;
  if(!email) {
    return res.status(400).json({error: 'Email is required.'});
  }

  const user = await db.findUserByEmail(email);
  if(user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000);
    await db.setResetToken(user.user_id, token, expires);

    const resetLink = `http://127.0.0.1:5500/Assignment_5_Group_1/QSLoginBackend/reset-password.html?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'QueueSmart Password Reset',
      text: `Click this link to reset your password: ${resetLink}\n\nThis link expires in 1 hour.`
    });
  }
  res.json({message: 'A reset link has been sent to the email provided.'});
});

app.post('/api/reset-password', async (req, res) => {
  const {token, newPassword} = req.body;
  if(!token || !newPassword) {
    return res.status(400).json({error: 'Token and new password are required.'});
  }

  if(newPassword.length < 8 || newPassword.length > 20) {
    return res.status(400).json({error: 'Password must be between 8 and 20 characters in length.'});
  }

  const user = await db.findUserByResetToken(token);
  if(!user || !user.reset_token_expires || new Date() > new Date(user.reset_token_expires)) {
    return res.status(400).json({error: 'Reset link is invalid or has expired.'});
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.updateUser(user.user_id, {password_hash: hashedPassword});
  await db.clearResetToken(user.user_id);

  res.json({message: 'Password has successfully been reset.'});
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({error: 'Something went wrong. Please try again later.'});
});

module.exports = app;
module.exports.isAnomalousLogin = isAnomalousLogin;
module.exports.calculateLockoutMinutes = calculateLockoutMinutes;