const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { addUser, removeUser, getUser, getUsersInRoom } = require('./users');
const router = require('./router');

const PORT = process.env.PORT || 8000;
const app = express();

app.use(helmet({
  permissionsPolicy: {
    features: {
      'interest-cohort': ['none']
    }
  }
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['my-custom-header'],
  credentials: true,
}));

app.use(express.static(path.join(__dirname, 'dist')));
app.use(router);

const server = http.createServer(app);

const io = socketio(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['my-custom-header'],
    credentials: true,
  },
});

io.on('connection', (socket) => {
  socket.on('join', ({ name, room }, callback) => {
    const { error, user } = addUser({ id: socket.id, name, room });

    if (error) return callback(error);

    socket.emit('message', { user: 'admin', text: `${user.name}, welcome to the room ${user.room}` });
    socket.broadcast.to(user.room).emit('message', { user: 'admin', text: `${user.name} has joined` });

    socket.join(user.room);

    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);

    if (!user) {
      return callback('User not found');
    }

    io.to(user.room).emit('message', { user: user.name, text: message });
    io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });

    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit('message', { user: 'admin', text: `${user.name} has left.` });
      io.to(user.room).emit('roomData', { room: user.room, users: getUsersInRoom(user.room) });
    }
  });
});

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
