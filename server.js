const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

wss.on('connection', (ws) => {
  console.log('Player connected');

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    if (msg.type === 'create_room') {
      const code = generateRoomCode();
      rooms.set(code, { players: [ws], state: {} });
      ws.roomCode = code;
      ws.playerNumber = 1;
      ws.send(JSON.stringify({ type: 'room_created', roomCode: code, playerNumber: 1 }));
      console.log('Room ' + code + ' created');
    }

    else if (msg.type === 'join_room') {
      const code = msg.roomCode.toUpperCase();
      const room = rooms.get(code);
      if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; }
      if (room.players.length >= 2) { ws.send(JSON.stringify({ type: 'error', message: 'Room is full' })); return; }
      room.players.push(ws);
      ws.roomCode = code;
      ws.playerNumber = 2;
      ws.send(JSON.stringify({ type: 'room_joined', roomCode: code, playerNumber: 2 }));
      room.players[0].send(JSON.stringify({ type: 'game_start', playerNumber: 1 }));
      ws.send(JSON.stringify({ type: 'game_start', playerNumber: 2 }));
      console.log('Player joined room ' + code);
    }

    else if (msg.type === 'game_move') {
      const room = rooms.get(ws.roomCode);
      if (!room) return;
      room.players.forEach((player) => {
        if (player !== ws && player.readyState === 1) {
          player.send(JSON.stringify({ type: 'game_move', move: msg.move, playerNumber: ws.playerNumber }));
        }
      });
    }
  });

  ws.on('close', () => {
    console.log('Player disconnected');
    const room = rooms.get(ws.roomCode);
    if (room) {
      room.players.forEach((player) => {
        if (player !== ws && player.readyState === 1) {
          player.send(JSON.stringify({ type: 'player_disconnected' }));
        }
      });
      rooms.delete(ws.roomCode);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log('Server running on port ' + PORT); });
