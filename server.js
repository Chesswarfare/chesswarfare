const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
app.use(express.static(path.join(__dirname, 'public')));
const rooms = new Map();
function generateCode() { const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let code = ''; for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)]; return code; }
wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); ws.on('message', (data) => { try { const msg = JSON.parse(data); if (msg.type === 'create_room') { let code = generateCode(); while (rooms.has(code)) code = generateCode(); rooms.set(code, { player1: ws, player2: null }); ws.roomCode = code; ws.playerNumber = 1; ws.send(JSON.stringify({ type: 'room_created', code })); } if (msg.type === 'join_room') { const room = rooms.get(msg.code); if (!room) { ws.send(JSON.stringify({ type: 'error', message: 'Room not found' })); return; } if (room.player2) { ws.send(JSON.stringify({ type: 'error', message: 'Room is full' })); return; } room.player2 = ws; ws.roomCode = msg.code; ws.playerNumber = 2; ws.send(JSON.stringify({ type: 'room_joined', code: msg.code })); room.player1.send(JSON.stringify({ type: 'game_start', player: 1 })); room.player2.send(JSON.stringify({ type: 'game_start', player: 2 })); } if (msg.type === 'game_move') { const room = rooms.get(ws.roomCode); if (!room) return; const opponent = ws.playerNumber === 1 ? room.player2 : room.player1; if (opponent && opponent.readyState === 1) { opponent.send(JSON.stringify(msg)); } } } catch (e) { console.error('Message error:', e); } }); ws.on('close', () => { if (ws.roomCode) { const room = rooms.get(ws.roomCode); if (room) { const opponent = ws.playerNumber === 1 ? room.player2 : room.player1; if (opponent && opponent.readyState === 1) { opponent.send(JSON.stringify({ type: 'player_disconnected' })); } rooms.delete(ws.roomCode); } } }); });
setInterval(() => { wss.clients.forEach((ws) => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); }); }, 30000);
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log('Server running on port ' + PORT); });
