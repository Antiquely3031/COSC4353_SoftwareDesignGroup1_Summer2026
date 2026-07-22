// fakeDB.js — temporary in-memory stand-in for the real database
let users = [];
let nextId = 1;

module.exports = {
  findUserByEmail: (email) => users.find(u => u.email === email),
  createUser: (userData) => {
    const newUser = { id: nextId++, ...userData };
    users.push(newUser);
    return newUser;
  },
  getAllUsers: () => users,
  _resetForTests: () => {
    users = [];
    nextId = 1;
  }
};