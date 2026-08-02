const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const peerServer = ExpressPeerServer(server, { debug: true, path: '/' });

app.use('/peerjs', peerServer);
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/room', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);

    socket.on('chat-message', (data) => {
      io.to(roomId).emit('chat-message', data);
    });

    socket.on('disconnect', () => {
      socket.to(roomId).emit('user-disconnected', userId);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

