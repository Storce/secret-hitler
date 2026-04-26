const socket = io();

// State
let currentRole = 'player'; // or 'admin'
let tempVote = null;

// DOM Elements
const loginView = document.getElementById('login-view');
const playerView = document.getElementById('player-view');
const adminView = document.getElementById('admin-view');

// Login Elements
const toggleAdminBtn = document.getElementById('toggle-admin-btn');
const joinBtn = document.getElementById('join-btn');
const nameGroup = document.getElementById('name-group');
const secretWordInput = document.getElementById('secret-word');
const playerNameInput = document.getElementById('player-name');
const joinError = document.getElementById('join-error');
const secretWordLabel = document.getElementById('secret-word-label');

// Player Sub-views
const playerLobby = document.getElementById('player-lobby');
const playerVoting = document.getElementById('player-voting');
const playerVotedWait = document.getElementById('player-voted-wait');
const playerResult = document.getElementById('player-result');

// Modals
const voteConfirmModal = document.getElementById('vote-confirm-modal');
const confirmVoteText = document.getElementById('confirm-vote-text');
const adminRestartModal = document.getElementById('admin-restart-modal');

// --- LOGIN LOGIC ---
toggleAdminBtn.addEventListener('click', () => {
    if (currentRole === 'player') {
        currentRole = 'admin';
        nameGroup.style.display = 'none';
        secretWordLabel.innerText = 'Admin Password';
        toggleAdminBtn.innerText = 'I am a Player';
    } else {
        currentRole = 'player';
        nameGroup.style.display = 'block';
        secretWordLabel.innerText = 'Secret Word';
        toggleAdminBtn.innerText = 'I am the Admin';
    }
});

joinBtn.addEventListener('click', () => {
    const role = currentRole;
    const name = playerNameInput.value.trim();
    const secretWord = secretWordInput.value;

    if (role === 'player' && !name) {
        joinError.innerText = 'Please enter your name.';
        return;
    }
    if (!secretWord) {
        joinError.innerText = 'Please enter the secret word.';
        return;
    }

    joinError.innerText = '';
    localStorage.setItem('sh_role', role);
    localStorage.setItem('sh_name', name);
    localStorage.setItem('sh_secret', secretWord);
    socket.emit('join', { role, name, secretWord });
});

// Socket Login Responses
socket.on('join_error', (msg) => {
    joinError.innerText = msg;
});

socket.on('admin_joined', (data) => {
    loginView.classList.remove('active');
    adminView.classList.add('active');
    updateAdminUI(data);
});

socket.on('joined', (data) => {
    loginView.classList.remove('active');
    playerView.classList.add('active');
    updatePlayerUI(data);
});

socket.on('force_reload', () => {
    window.location.reload();
});

// --- PLAYER LOGIC ---
function updatePlayerUI(data) {
    playerLobby.classList.remove('active');
    playerVoting.classList.remove('active');
    playerVotedWait.classList.remove('active');
    playerResult.classList.remove('active');

    if (data.gameState === 'lobby') {
        playerLobby.classList.add('active');
    } else if (data.gameState === 'voting') {
        document.getElementById('player-round-display').innerText = data.round;
        if (data.players && data.players[socket.id] && data.players[socket.id].hasVoted) {
            playerVotedWait.classList.add('active');
        } else {
            playerVoting.classList.add('active');
        }
    } else if (data.gameState === 'result') {
        document.getElementById('result-round-display').innerText = data.round;
        const resStatus = document.getElementById('result-status');
        if (data.results.pass) {
            resStatus.innerText = 'PASSED';
            resStatus.className = 'result-status pass';
        } else {
            resStatus.innerText = 'FAILED';
            resStatus.className = 'result-status fail';
        }
        document.getElementById('res-ja').innerText = data.results.yes;
        document.getElementById('res-nein').innerText = data.results.no;
        playerResult.classList.add('active');
    }
}

// Voting Flow
function selectVote(choice) {
    tempVote = choice;
    confirmVoteText.innerText = choice ? 'JA!' : 'NEIN';
    confirmVoteText.style.color = choice ? 'var(--ja-color)' : 'var(--nein-color)';
    voteConfirmModal.classList.add('active');
}

function cancelVote() {
    tempVote = null;
    voteConfirmModal.classList.remove('active');
}

function submitVote() {
    socket.emit('vote', tempVote);
    voteConfirmModal.classList.remove('active');
    tempVote = null;
}

socket.on('vote_confirmed', () => {
    playerVoting.classList.remove('active');
    playerVotedWait.classList.add('active');
});

// --- ADMIN LOGIC ---
let lastAdminData = {};

function updateAdminUI(data) {
    Object.assign(lastAdminData, data);
    
    document.getElementById('admin-state-label').innerText = lastAdminData.gameState.toUpperCase();
    document.getElementById('admin-round-display').innerText = lastAdminData.round;

    const actionsDiv = document.getElementById('admin-actions');
    actionsDiv.innerHTML = '';

    if (lastAdminData.gameState === 'lobby') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerText = 'Start Game';
        btn.onclick = () => socket.emit('admin_start_game');
        actionsDiv.appendChild(btn);
    } else if (lastAdminData.gameState === 'voting') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerText = 'Finish Round & Show Results';
        btn.onclick = () => socket.emit('admin_finish_round');
        actionsDiv.appendChild(btn);
    } else if (lastAdminData.gameState === 'result') {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary';
        btn.innerText = 'Continue to Next Round';
        btn.onclick = () => socket.emit('continue_round');
        actionsDiv.appendChild(btn);
    }

    renderPlayersList(lastAdminData.players);
}

function renderPlayersList(players) {
    if (!players) return;
    const list = document.getElementById('admin-players-list');
    list.innerHTML = '';
    
    let allVoted = true;
    let count = 0;

    for (let id in players) {
        count++;
        const p = players[id];
        const li = document.createElement('li');
        const nameSpan = document.createElement('span');
        nameSpan.innerText = p.name;
        
        const statusSpan = document.createElement('span');
        if (lastAdminData.gameState === 'voting' || lastAdminData.gameState === 'result') {
            if (p.hasVoted) {
                statusSpan.innerText = 'Voted';
                statusSpan.className = 'voted-badge yes';
            } else {
                statusSpan.innerText = 'Waiting...';
                statusSpan.className = 'voted-badge no';
                allVoted = false;
            }
        } else {
            statusSpan.innerText = 'Joined';
            statusSpan.className = 'voted-badge no';
        }

        li.appendChild(nameSpan);
        li.appendChild(statusSpan);
        list.appendChild(li);
    }

    if (count === 0) {
        list.innerHTML = '<li>No players joined yet.</li>';
    }
}

function showRestartConfirm() {
    adminRestartModal.classList.add('active');
}

function closeRestartConfirm() {
    adminRestartModal.classList.remove('active');
}

function executeRestart() {
    socket.emit('admin_restart_game');
    closeRestartConfirm();
}

// --- SHARED REALTIME UPDATES ---
socket.on('state_update', (data) => {
    if (currentRole === 'player') {
        updatePlayerUI(data);
    } else {
        updateAdminUI(data);
    }
});

socket.on('players_update', (players) => {
    if (currentRole === 'admin') {
        updateAdminUI({ players });
    }
});

// Auto-reconnect flow when socket reconnects
socket.on('connect', () => {
    const role = localStorage.getItem('sh_role');
    const name = localStorage.getItem('sh_name');
    const secretWord = localStorage.getItem('sh_secret');
    if (name && secretWord) {
        currentRole = role || 'player';
        socket.emit('join', { role: currentRole, name, secretWord });
    }
});
