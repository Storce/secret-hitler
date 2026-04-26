const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from public folder
app.use(express.static('public'));

const SECRET_WORD = 'nein';
const ADMIN_PASSWORD = 'admin';

let gameState = 'lobby'; // 'lobby', 'voting', 'result'
let round = 1;
let players = {}; // Object mapping socket.id -> { name, hasVoted: boolean, voteChoice: boolean | null }
let adminSockets = new Set();

function broadcastToAdmins(event, data) {
    adminSockets.forEach(id => {
        io.to(id).emit(event, data);
    });
}

function checkAllVoted() {
    const playerArray = Object.values(players);
    if (playerArray.length === 0) return false;
    return playerArray.every(p => p.hasVoted);
}

io.on('connection', (socket) => {
    socket.on('join', ({ role, name, secretWord }) => {
        if (role === 'admin') {
            if (secretWord !== ADMIN_PASSWORD) {
                return socket.emit('join_error', 'Invalid admin password');
            }
            adminSockets.add(socket.id);
            socket.emit('admin_joined', { gameState, players, round });
        } else {
            if (secretWord !== SECRET_WORD) {
                return socket.emit('join_error', 'Invalid secret word');
            }
            if (gameState !== 'lobby') {
                return socket.emit('join_error', 'Game has already started. Cannot join now.');
            }
            
            players[socket.id] = { name, hasVoted: false, voteChoice: null };
            socket.emit('joined', { gameState, round });
            
            // Notify admins
            broadcastToAdmins('players_update', players);
        }
    });

    socket.on('admin_start_game', () => {
        if (!adminSockets.has(socket.id)) return;
        if (Object.keys(players).length === 0) return socket.emit('error', 'Not enough players');
        
        gameState = 'voting';
        // Reset votes
        for (let id in players) {
            players[id].hasVoted = false;
            players[id].voteChoice = null;
        }
        
        io.emit('state_update', { gameState, round, players });
        broadcastToAdmins('players_update', players);
    });

    socket.on('vote', (voteSelection) => {
        if (players[socket.id] && gameState === 'voting' && !players[socket.id].hasVoted) {
            players[socket.id].hasVoted = true;
            players[socket.id].voteChoice = voteSelection; // true for JA, false for NEIN
            socket.emit('vote_confirmed');
            
            broadcastToAdmins('players_update', players);
            
            if (checkAllVoted()) {
                broadcastToAdmins('all_voted');
            }
        }
    });

    socket.on('admin_finish_round', () => {
        if (!adminSockets.has(socket.id)) return;
        if (gameState !== 'voting') return;
        
        gameState = 'result';
        
        let yesVotes = 0;
        let noVotes = 0;
        for (let id in players) {
            if (players[id].voteChoice === true) yesVotes++;
            else if (players[id].voteChoice === false) noVotes++;
        }
        
        const isPass = yesVotes > noVotes; // standard simple majority logic
        
        io.emit('state_update', { 
            gameState, 
            round,
            results: { yes: yesVotes, no: noVotes, pass: isPass }
        });
    });

    socket.on('continue_round', () => {
        if (!adminSockets.has(socket.id)) return;
        if (gameState !== 'result') return;
        
        gameState = 'voting';
        round++;
        
        // Reset votes
        for (let id in players) {
            players[id].hasVoted = false;
            players[id].voteChoice = null;
        }
        
        io.emit('state_update', { gameState, round, players });
        broadcastToAdmins('players_update', players);
    });

    socket.on('admin_restart_game', () => {
        if (!adminSockets.has(socket.id)) return;
        
        gameState = 'lobby';
        round = 1;
        players = {}; // Disconnect/kick everyone? Or just let them be? Design says "reset and restart the game". Let's clear players so they have to rejoin. Or we can just keep players and reset state.
        // Actually, if we clear players, we need to notify them to refresh.
        io.emit('force_reload');
        players = {};
        
        broadcastToAdmins('players_update', players);
        broadcastToAdmins('state_update', { gameState, round });
    });

    socket.on('disconnect', () => {
        if (adminSockets.has(socket.id)) {
            adminSockets.delete(socket.id);
        } else if (players[socket.id]) {
            delete players[socket.id];
            broadcastToAdmins('players_update', players);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
