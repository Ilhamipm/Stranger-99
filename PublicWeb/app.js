
// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onDisconnect, onValue, push, remove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION ---
// User must replace this with their own config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyD--YQOiniI1Rdrx8tFvtsu-ZoOZjR5BlA",
    authDomain: "stranger-99.firebaseapp.com",
    databaseURL: "https://stranger-99-default-rtdb.firebaseio.com",
    projectId: "stranger-99",
    storageBucket: "stranger-99.firebasestorage.app",
    messagingSenderId: "419674409538",
    appId: "1:419674409538:web:0b32d852a8202e6bfd3bdb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- STATE ---
let currentUser = null;
let currentPartnerId = null;
let myId = null;
let isGameHost = false; // Is this user the one controlling settings?
let gameSpeed = 10;
let gameInterval = null;

// --- DOM ELEMENTS ---
const appScreens = {
    auth: document.getElementById('auth-section'),
    chat: document.getElementById('chat-section'),
    game: document.getElementById('game-overlay')
};

const ui = {
    myIdDisplay: document.getElementById('my-id'),
    displayId: document.getElementById('display-id'),
    btnRegister: document.getElementById('btn-register'),
    btnEnterChat: document.getElementById('btn-enter-chat'),
    regInfo: document.getElementById('registration-info'),

    onlineModal: document.getElementById('online-modal'),
    onlineList: document.getElementById('online-modal-list'),
    btnViewOnline: document.getElementById('btn-view-online'),
    btnCloseOnline: document.getElementById('btn-close-online'),

    userModal: document.getElementById('user-modal'),
    userList: document.getElementById('modal-user-list'),
    btnSelectUser: document.getElementById('btn-select-user'),
    btnCloseUser: document.getElementById('btn-close-modal'),

    msgInput: document.getElementById('message-input'),
    btnSend: document.getElementById('btn-send'),
    msgList: document.getElementById('messages'),
    targetIdInput: document.getElementById('target-id'),
    recipientIndicator: document.getElementById('recipient-indicator'),

    gameBall: document.getElementById('game-ball'),
    gameSpeedSlider: document.getElementById('speed-slider'),
    btnPlay: document.getElementById('btn-play-together'),
    btnStartGame: document.getElementById('btn-start-game'),
    btnExitGame: document.getElementById('btn-exit-game'),
    gamePartnerName: document.getElementById('game-partner-name'),
    gameRole: document.getElementById('game-role'),
    gameControls: document.getElementById('game-controls'),

    settingsModal: document.getElementById('settings-modal'),
    btnSettings: document.getElementById('btn-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnSaveSettings: document.getElementById('btn-save-settings'),
    selectGender: document.getElementById('select-gender'),
    selectInterest: document.getElementById('select-interest'),
};

// --- AUTHENTICATION ---
ui.btnRegister.addEventListener('click', () => {
    signInAnonymously(auth).catch((error) => {
        console.error("Auth Error:", error);
        alert("Gagal login: " + error.message);
    });
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in.
        currentUser = user;
        // Generate a simple 5-char ID from the UID for readability
        myId = user.uid.substring(0, 5).toUpperCase();

        ui.myIdDisplay.textContent = myId;
        ui.displayId.textContent = "ID: " + myId;

        ui.btnRegister.classList.add('hidden');
        ui.regInfo.classList.remove('hidden');

        // Setup Presence
        setupPresence(user.uid, myId);

        // Listen for Signals (Messages, Invites)
        setupSignalListener(user.uid);
    } else {
        // User is signed out.
    }
});

ui.btnEnterChat.addEventListener('click', () => {
    appScreens.auth.classList.add('hidden');
    appScreens.chat.classList.remove('hidden');

    // Load persisted settings
    const savedGender = localStorage.getItem('glowme_gender') || 'Male';
    const savedInterest = localStorage.getItem('glowme_interest') || 'Female';
    ui.selectGender.value = savedGender;
    ui.selectInterest.value = savedInterest;

    updateUserProfile(savedGender, savedInterest);
});

// --- PRESENCE SYSTEM ---
function setupPresence(uid, shortId) {
    const userRef = ref(db, 'users/' + uid);
    const connectionRef = ref(db, '.info/connected');

    onValue(connectionRef, (snap) => {
        if (snap.val() === true) {
            const gender = localStorage.getItem('glowme_gender') || 'Unknown';
            const interest = localStorage.getItem('glowme_interest') || 'Unknown';

            set(userRef, {
                id: shortId,
                online: true,
                gender: gender,
                interest: interest,
                lastSeen: serverTimestamp()
            });

            onDisconnect(userRef).remove();
        }
    });

    // Listen for other users to populate lists
    const allUsersRef = ref(db, 'users');
    onValue(allUsersRef, (snapshot) => {
        const users = snapshot.val() || {};
        renderOnlineUsers(users);
    });
}

function updateUserProfile(gender, interest) {
    if (!currentUser) return;
    localStorage.setItem('glowme_gender', gender);
    localStorage.setItem('glowme_interest', interest);

    const userRef = ref(db, 'users/' + currentUser.uid);
    // Only update specific fields to avoid overwriting presence
    // Note: set() overwrites. update() is better here.
    // Using simple set for now as we re-set on connect.
    // Let's use re-set logic safely.
    // But since we are client-side, we can just set.
    set(userRef, {
        id: myId,
        online: true,
        gender: gender,
        interest: interest,
        lastSeen: serverTimestamp()
    });
}


// --- SIGNAL / MESSAGING SYSTEM ---
// We use a 'signals' path to send ephemeral data to specific users
function setupSignalListener(uid) {
    const mySignalsRef = ref(db, 'signals/' + uid); // We listen to OUR inbox

    // When a new signal is added
    onValue(mySignalsRef, (snapshot) => {
        const signals = snapshot.val();
        if (!signals) return;

        Object.keys(signals).forEach(key => {
            const signal = signals[key];
            handleSignal(signal);

            // Remove signal after processing so we don't process it again
            remove(ref(db, 'signals/' + uid + '/' + key));
        });
    });
}

function sendSignal(targetUid, type, data) {
    const targetRef = ref(db, 'signals/' + targetUid);
    push(targetRef, {
        type: type,
        from: currentUser.uid,
        fromId: myId,
        data: data,
        timestamp: serverTimestamp()
    });
}

// Find UID by Short ID (Helper)
// In a real app we'd index this. For now we loop through online users.
// This is inefficient but fine for small scale.
async function findUidByShortId(shortId) {
    return new Promise((resolve) => {
        const allUsersRef = ref(db, 'users');
        onValue(allUsersRef, (snapshot) => {
            const users = snapshot.val() || {};
            for (const uid in users) {
                if (users[uid].id === shortId) {
                    resolve(uid);
                    return;
                }
            }
            resolve(null);
        }, { onlyOnce: true });
    });
}

function handleSignal(signal) {
    // 1. Message
    if (signal.type === 'message') {
        addMessageToUI(signal.fromId, signal.data.text, false);
    }
    // 2. Game Invite
    else if (signal.type === 'game_invite') {
        const accept = confirm(`Player ${signal.fromId} wants to play with you! Accept?`);
        if (accept) {
            // Send accept signal
            findUidByShortId(signal.fromId).then(targetUid => {
                if (targetUid) {
                    sendSignal(targetUid, 'game_accept', {});
                    startGameLine(signal.fromId, targetUid, false); // I am guest
                }
            });
        }
    }
    // 3. Game Accept
    else if (signal.type === 'game_accept') {
        alert(`${signal.fromId} accepted! Game starting.`);
        findUidByShortId(signal.fromId).then(targetUid => {
            startGameLine(signal.fromId, targetUid, true); // I am host
        });
    }
    // 4. Game Sync
    else if (signal.type === 'game_sync') {
        if (appScreens.game.classList.contains('hidden')) return; // Ignore if not in game
        if (signal.data.speed) {
            updateBallSpeed(signal.data.speed);
        }
    }
    // 5. Emoticon
    else if (signal.type === 'emoticon') {
        showEmoticon(signal.data.emoji);
    }
}


// --- CHAT LOGIC ---
ui.btnSend.addEventListener('click', sendMessage);
ui.msgInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    const text = ui.msgInput.value.trim();
    const targetId = ui.targetIdInput.value.trim().toUpperCase();

    if (!text) return;
    if (!targetId || targetId === "--------") {
        alert("Please enter a Target ID or select a user.");
        return;
    }

    const targetUid = await findUidByShortId(targetId);
    if (!targetUid) {
        alert("User not found or offline.");
        return;
    }

    // Send
    sendSignal(targetUid, 'message', { text: text });

    // UI update
    addMessageToUI("ME", text, true);
    ui.msgInput.value = '';
}

function addMessageToUI(sender, text, isMe) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMe ? 'message-sent' : 'message-received'}`;

    const content = `
        <div class="message-sender">${sender}</div>
        <div class="message-text">${text}</div>
    `;
    msgDiv.innerHTML = content;
    ui.msgList.appendChild(msgDiv);
    ui.msgList.scrollTop = ui.msgList.scrollHeight;

    // Remove empty state if exists
    const empty = ui.msgList.querySelector('.empty-state');
    if (empty) empty.remove();
}


// --- ONLINE USERS UI ---
function renderOnlineUsers(users) {
    ui.onlineList.innerHTML = '';
    ui.userList.innerHTML = ''; // Select modal

    let count = 0;

    for (const uid in users) {
        if (uid === currentUser?.uid) continue; // Skip self

        const user = users[uid];
        const el = document.createElement('div');
        el.className = 'user-card';
        el.innerHTML = `
            <div class="user-info-row">
                <span class="user-id-badge">${user.id}</span>
                <span class="user-gender">${getGenderEmoji(user.gender)}</span>
            </div>
            <button class="btn-tiny" onclick="selectUser('${user.id}')">Chat</button>
        `;

        ui.onlineList.appendChild(el.cloneNode(true)); // For "Online Users" Modal
        ui.userList.appendChild(el); // For "Select User" Modal

        count++;
    }
}

function getGenderEmoji(g) {
    if (g === 'Male') return '♂️';
    if (g === 'Female') return '♀️';
    return '⚧';
}

// Expose to window for onclick
window.selectUser = (id) => {
    ui.targetIdInput.value = id;
    ui.recipientIndicator.textContent = `Chatting with: ${id}`;
    ui.recipientIndicator.classList.remove('hidden');
    ui.onlineModal.classList.add('hidden');
    ui.userModal.classList.add('hidden');
    currentPartnerId = id; // Store for game invite
};


// --- GAME LOGIC ---
ui.btnPlay.addEventListener('click', async () => {
    const targetId = ui.targetIdInput.value.trim().toUpperCase();
    if (!targetId || targetId.length < 3) {
        alert("Select a user first!");
        return;
    }

    const targetUid = await findUidByShortId(targetId);
    if (!targetUid) {
        alert("User offline.");
        return;
    }

    sendSignal(targetUid, 'game_invite', {});
    alert(`Invite sent to ${targetId}. Waiting for acceptance...`);
});

function startGameLine(partnerShortId, partnerUid, isHost) {
    currentPartnerId = partnerUid; // store UID not shortID for signals
    isGameHost = isHost;

    ui.gamePartnerName.textContent = partnerShortId;
    ui.gameRole.textContent = isHost ? "Controller (You)" : "Follower";

    appScreens.game.classList.remove('hidden');

    if (isHost) {
        ui.gameControls.classList.remove('hidden');
        // Start heartbeat to sync speed
        gameInterval = setInterval(() => {
            const speed = ui.gameSpeedSlider.value;
            sendSignal(partnerUid, 'game_sync', { speed: speed });
            updateBallSpeed(speed); // Local update
        }, 1000);
    } else {
        ui.gameControls.classList.add('hidden');
    }
}

ui.btnExitGame.addEventListener('click', () => {
    appScreens.game.classList.add('hidden');
    if (gameInterval) clearInterval(gameInterval);
});

// Settings & Modals Logic
ui.btnViewOnline.onclick = () => ui.onlineModal.classList.remove('hidden');
ui.btnCloseOnline.onclick = () => ui.onlineModal.classList.add('hidden');
ui.btnSelectUser.onclick = () => ui.userModal.classList.remove('hidden');
ui.btnCloseUser.onclick = () => ui.userModal.classList.add('hidden');
ui.btnSettings.onclick = () => ui.settingsModal.classList.remove('hidden');
ui.btnCloseSettings.onclick = () => ui.settingsModal.classList.add('hidden');

ui.btnSaveSettings.onclick = () => {
    const g = ui.selectGender.value;
    const i = ui.selectInterest.value;
    updateUserProfile(g, i);
    ui.settingsModal.classList.add('hidden');
    alert("Profile saved!");
};

// Emoticons
document.querySelectorAll('.emoticon-btn-compact').forEach(btn => {
    btn.addEventListener('click', async () => {
        const em = btn.getAttribute('data-emoticon');
        showEmoticon(em); // Show locally
        if (currentPartnerId) {
            sendSignal(currentPartnerId, 'emoticon', { emoji: em });
        }
    });
});

function showEmoticon(emoji) {
    const notif = document.getElementById('emoticon-notification');
    notif.textContent = emoji;
    notif.classList.remove('hidden');
    notif.classList.add('fade-in');

    setTimeout(() => {
        notif.classList.add('hidden');
        notif.classList.remove('fade-in');
    }, 2000);
}

// Game Visuals
function updateBallSpeed(val) {
    // 150 = fast, 1 = slow. Animation duration is inverse.
    // Base duration 2s. Min duration 0.2s.
    // Linear interpolation:
    // Speed 1 -> 5s
    // Speed 150 -> 0.1s
    // Simplified: speed=10 is default.
    const duration = 2000 / val;
    ui.gameBall.style.animationDuration = `${duration}ms`;
}
