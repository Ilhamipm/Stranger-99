const isLocalhost = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const hubUrl = isLocalhost ? "/chatHub" : "https://my-chat-backend-production-2b56.up.railway.app/chatHub";

const connection = new signalR.HubConnectionBuilder()
    .withUrl(hubUrl)
    .withAutomaticReconnect()
    .build();

const STORAGE_KEY = 'glowme_user_id';

const authSection = document.getElementById('auth-section');
const chatSection = document.getElementById('chat-section');
const registrationInfo = document.getElementById('registration-info');
const btnRegister = document.getElementById('btn-register');
const btnEnterChat = document.getElementById('btn-enter-chat');
const myIdDisplay = document.getElementById('my-id');
const displayIdHead = document.getElementById('display-id');
const messagesList = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const targetIdInput = document.getElementById('target-id');
const btnSend = document.getElementById('btn-send');
const btnLogout = document.getElementById('btn-logout');
const btnEditId = document.getElementById('btn-edit-id');
const recipientIndicator = document.getElementById('recipient-indicator');
const unreadAlert = document.getElementById('unread-alert');
const unreadCountSpan = document.getElementById('unread-count');
const btnOpenUnread = document.getElementById('btn-open-unread');
const btnViewOnline = document.getElementById('btn-view-online');
const onlineModal = document.getElementById('online-modal');
const btnCloseOnline = document.getElementById('btn-close-online');
const onlineModalList = document.getElementById('online-modal-list');
const btnSettings = document.getElementById('btn-settings');
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const selectGender = document.getElementById('select-gender');
const selectInterest = document.getElementById('select-interest');
const btnSaveSettings = document.getElementById('btn-save-settings');
const genderSymbolDisplay = document.getElementById('gender-symbol');
const SETTINGS_KEY = 'glowme_user_settings';
const GENDER_SYMBOLS = {
    "Male": "♂",
    "Female": "♀",
    "Non-binary": "⚧"
};

// Play Together Elements
const btnPlayTogether = document.getElementById('btn-play-together');
const btnStartGame = document.getElementById('btn-start-game');
const matchDot = document.getElementById('match-dot');
const matchText = document.getElementById('match-text');
const gameOverlay = document.getElementById('game-overlay');
const btnExitGame = document.getElementById('btn-exit-game');
const gameRole = document.getElementById('game-role');
const gameBall = document.getElementById('game-ball');
const gameControls = document.getElementById('game-controls');
const speedSlider = document.getElementById('speed-slider');
// No longer used in sidebar:
// const onlineUsersList = document.getElementById('online-users-list');

// Selection Modal Elements
const btnSelectUser = document.getElementById('btn-select-user');
const userModal = document.getElementById('user-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalUserList = document.getElementById('modal-user-list');

let myId = null;
let isController = false;
let currentBallSpeed = 10;
let ballDirection = 1; // 1 for down, -1 for up
let ballPosY = 50;
let gameActive = false;
let onlineUsers = [];

// SignalR Events
connection.on("UserRegistered", (id) => {
    // If myId was already set and is different, it means we successfully changed it
    if (myId && myId !== id) {
        alert(`Success! Your ID has been changed to: ${id}`);
    }

    myId = id;
    localStorage.setItem(STORAGE_KEY, id); // Simpan ID agar tetap sama besok
    myIdDisplay.textContent = id;
    displayIdHead.textContent = `ID: ${id}`;
    btnRegister.classList.add('hidden');
    registrationInfo.classList.remove('hidden');

    // Sync profile settings if they exist
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
        const { gender, interest } = JSON.parse(savedSettings);
        connection.invoke("UpdateProfile", gender, interest).catch(console.error);
        updateGenderSymbol(gender);
    }
});

connection.on("ReceiveMessage", (senderId, message) => {
    appendMessage(senderId, message, 'received');
});

connection.on("Error", (msg) => {
    alert(msg);
});

connection.on("ProfileUpdated", (gender, interest) => {
    console.log(`Profile updated: ${gender}, ${interest}`);
});

connection.on("UnreadNotification", (count) => {
    if (count > 0) {
        unreadAlert.classList.remove('hidden');
        unreadCountSpan.textContent = count;
    } else {
        unreadAlert.classList.add('hidden');
    }
});

connection.on("MatchmakingStatus", (status) => {
    matchText.textContent = status;
    matchDot.className = `dot dot-${status.toLowerCase()}`;
    if (status === 'Idle') {
        btnPlayTogether.textContent = "Play Now";
        btnPlayTogether.classList.remove('hidden');
        btnStartGame.classList.add('hidden');
    }
});

connection.on("MatchFound", (partnerId, canControl) => {
    matchText.textContent = `Matched with ${partnerId}`;
    matchDot.className = 'dot dot-matched';
    btnPlayTogether.classList.add('hidden');
    btnStartGame.classList.remove('hidden');
    isController = canControl;
});

connection.on("GameStart", () => {
    gameOverlay.classList.remove('hidden');
    gameActive = true;

    // Reset Ball State
    ballPosY = 50;
    ballDirection = 1;
    gameBall.style.top = "50%"; // Visual reset immediately

    gameRole.textContent = isController ? "You are Controlling" : "Spectating Partner";
    if (isController) {
        gameControls.classList.remove('hidden');
    } else {
        gameControls.classList.add('hidden');
    }
    startGameLoop();
});

connection.on("UpdateSpeed", (speed) => {
    currentBallSpeed = speed;
});

connection.on("PartnerDisconnected", () => {
    alert("Partner disconnected. Game over.");
    exitGame();
});

connection.on("UpdateOnlineUsers", (users) => {
    onlineUsers = users;
    renderOnlineUsers(users);
});

// UI Actions
btnRegister.onclick = async () => {
    try {
        if (connection.state === signalR.HubConnectionState.Disconnected) {
            await connection.start();
        }
        const savedId = localStorage.getItem(STORAGE_KEY);
        await connection.invoke("Register", savedId);
    } catch (err) {
        console.error("Connection failed: ", err);
        alert("Failed to connect to server. Make sure the backend is running.");
    }
};

btnEditId.onclick = async () => {
    let newId = prompt("Enter your new custom ID (max 20 chars):", myId);
    if (newId) {
        newId = newId.trim();
        if (newId === myId) return;

        if (newId.length > 20 || newId.length < 1) {
            alert("ID must be between 1 and 20 characters.");
            return;
        }

        try {
            await connection.invoke("ChangeId", newId);
        } catch (err) {
            console.error(err);
            alert("Failed to send request. Check your connection.");
        }
    }
};

// Auto-start if we have a saved ID
(async () => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId) {
        try {
            await connection.start();
            await connection.invoke("Register", savedId);
            // Auto enter chat if we were already registered
            authSection.classList.add('hidden');
            chatSection.classList.remove('hidden');
        } catch (err) {
            console.warn("Auto-reconnect failed:", err);
        }
    }
})();

btnEnterChat.onclick = () => {
    authSection.classList.add('hidden');
    chatSection.classList.remove('hidden');
    chatSection.classList.add('fade-in');
};

btnOpenUnread.onclick = async () => {
    try {
        await connection.invoke("FetchUnreadMessages");
    } catch (err) {
        console.error(err);
    }
};

// Play Together Actions
btnPlayTogether.onclick = async () => {
    if (matchText.textContent === 'Idle') {
        await connection.invoke("JoinMatchmaking");
        btnPlayTogether.textContent = "Cancel Matchmaking";
    } else {
        await connection.invoke("LeaveMatchmaking");
        btnPlayTogether.textContent = "Play Now";
    }
};

btnStartGame.onclick = async () => {
    await connection.invoke("StartGame");
};

btnExitGame.onclick = exitGame;

async function exitGame() {
    gameActive = false;
    gameOverlay.classList.add('hidden');
    btnStartGame.classList.add('hidden');
    btnPlayTogether.classList.remove('hidden');
    matchText.textContent = 'Idle';
    matchDot.className = 'dot dot-idle';
    btnPlayTogether.textContent = "Play Now";

    // Reset game state
    currentBallSpeed = 10;
    speedSlider.value = 10;

    try {
        await connection.invoke("QuitGame");
    } catch (err) {
        console.error("Failed to quit game on server:", err);
    }
}

btnViewOnline.onclick = () => {
    onlineModal.classList.remove('hidden');
    renderOnlineModal();
};

btnCloseOnline.onclick = () => {
    onlineModal.classList.add('hidden');
};

btnSelectUser.onclick = () => {
    userModal.classList.remove('hidden');
    renderModalUsers();
};

btnCloseModal.onclick = () => {
    userModal.classList.add('hidden');
};

// Close modals when clicking outside
window.onclick = (event) => {
    if (event.target === userModal) {
        userModal.classList.add('hidden');
    }
    if (event.target === onlineModal) {
        onlineModal.classList.add('hidden');
    }
    if (event.target === settingsModal) {
        settingsModal.classList.add('hidden');
    }
};

// Profile Settings Actions
btnSettings.onclick = () => {
    const savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"gender":"Non-binary", "interest":"Both"}');
    selectGender.value = savedSettings.gender;
    selectInterest.value = savedSettings.interest;
    settingsModal.classList.remove('hidden');
};

btnCloseSettings.onclick = () => {
    settingsModal.classList.add('hidden');
};

btnSaveSettings.onclick = async () => {
    const gender = selectGender.value;
    const interest = selectInterest.value;
    const settings = { gender, interest };

    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    // Close modal immediately as requested
    settingsModal.classList.add('hidden');
    updateGenderSymbol(gender);

    try {
        await connection.invoke("UpdateProfile", gender, interest);
    } catch (err) {
        console.error(err);
        alert("Failed to sync settings with server, but they are saved locally.");
    }
};

function updateGenderSymbol(gender) {
    if (!genderSymbolDisplay) return;
    const symbol = GENDER_SYMBOLS[gender] || "";
    genderSymbolDisplay.textContent = symbol;
    genderSymbolDisplay.className = `gender-symbol-mini gender-${gender.toLowerCase()}`;
}

function renderModalUsers() {
    modalUserList.innerHTML = '';
    // Show other users except self
    const others = onlineUsers.filter(u => u.id !== myId);

    if (others.length === 0) {
        modalUserList.innerHTML = '<p style="text-align: center; opacity: 0.5; padding: 20px;">No other players online yet.</p>';
        return;
    }

    others.forEach(user => {
        const div = document.createElement('div');
        div.className = 'modal-user-item';

        const nameWrapper = document.createElement('div');
        nameWrapper.style.position = "relative";
        nameWrapper.style.display = "inline-block";

        const name = document.createElement('span');
        name.textContent = user.id;

        const symbol = document.createElement('span');
        symbol.className = `gender-symbol-mini gender-${user.gender.toLowerCase()}`;
        symbol.style.right = "-12px";
        symbol.textContent = GENDER_SYMBOLS[user.gender] || "";

        nameWrapper.appendChild(name);
        nameWrapper.appendChild(symbol);

        const statusSpan = document.createElement('span');
        statusSpan.className = `status-text status-${user.status.toLowerCase()}`;
        statusSpan.textContent = user.status;

        div.appendChild(nameWrapper);
        div.appendChild(statusSpan);

        div.onclick = () => {
            targetIdInput.value = user.id;
            userModal.classList.add('hidden');
            updateRecipientIndicator();
        };
        modalUserList.appendChild(div);
    });
}

function renderOnlineModal() {
    onlineModalList.innerHTML = '';

    if (onlineUsers.length === 0) {
        onlineModalList.innerHTML = '<p style="text-align: center; opacity: 0.5; padding: 20px;">No one is online.</p>';
        return;
    }

    onlineUsers.forEach(user => {
        const div = document.createElement('div');
        div.className = 'online-user-item-modal';

        const dot = document.createElement('span');
        dot.className = `online-user-dot dot-${user.status.toLowerCase()}`;

        const nameWrapper = document.createElement('div');
        nameWrapper.style.position = "relative";
        nameWrapper.style.display = "inline-block";
        nameWrapper.style.flex = "1";

        const name = document.createElement('span');
        name.textContent = user.id + (user.id === myId ? ' (You)' : '');

        const symbol = document.createElement('span');
        symbol.className = `gender-symbol-mini gender-${user.gender.toLowerCase()}`;
        symbol.style.right = user.id === myId ? "-20px" : "-12px";
        symbol.textContent = GENDER_SYMBOLS[user.gender] || "";

        nameWrapper.appendChild(name);
        nameWrapper.appendChild(symbol);

        const statusText = document.createElement('span');
        statusText.className = `status-label status-${user.status.toLowerCase()}`;
        statusText.textContent = user.status;

        div.appendChild(dot);
        div.appendChild(nameWrapper);
        div.appendChild(statusText);
        onlineModalList.appendChild(div);
    });
}

speedSlider.oninput = async () => {
    if (isController) {
        currentBallSpeed = parseFloat(speedSlider.value);
        await connection.invoke("UpdateBallSpeed", currentBallSpeed);
    }
};

function startGameLoop() {
    if (!gameActive) return;

    // Movement calculation
    ballPosY += (currentBallSpeed * 0.1) * ballDirection;

    // Boundary check
    if (ballPosY > 90) {
        ballPosY = 90;
        ballDirection = -1;
    } else if (ballPosY < 5) {
        ballPosY = 5;
        ballDirection = 1;
    }

    gameBall.style.top = ballPosY + "%";

    requestAnimationFrame(startGameLoop);
}

function renderOnlineUsers(users) {
    // We only need to store the users now, the modal will handle the rendering when opened
    onlineUsers = users;
}

btnSend.onclick = sendMessage;
messageInput.onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage();
};

async function sendMessage() {
    const targetId = targetIdInput.value.trim();
    const text = messageInput.value.trim();

    if (!targetId) {
        alert("Please enter a target ID.");
        return;
    }
    if (!text) return;

    try {
        await connection.invoke("SendMessageToId", targetId, text);
        appendMessage("You", text, 'sent');
        messageInput.value = "";
    } catch (err) {
        console.error(err);
    }
}

function appendMessage(sender, text, type) {
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    const div = document.createElement('div');
    div.className = `message-bubble message-${type}`;

    const senderSpan = document.createElement('span');
    senderSpan.className = 'message-sender';
    senderSpan.textContent = sender;

    const textNode = document.createTextNode(text);

    div.appendChild(senderSpan);
    div.appendChild(textNode);

    messagesList.appendChild(div);
    messagesList.scrollTop = messagesList.scrollHeight;
}

btnLogout.onclick = () => {
    location.reload();
};

function updateRecipientIndicator() {
    const val = targetIdInput.value.trim();
    if (val) {
        recipientIndicator.textContent = `Sending to: ${val}`;
        recipientIndicator.classList.remove('hidden');
    } else {
        recipientIndicator.classList.add('hidden');
    }
}

targetIdInput.oninput = updateRecipientIndicator;

// Ensure selecting from modal also updates indicator
const originalRenderModalUsers = renderModalUsers;
renderModalUsers = function () {
    originalRenderModalUsers();
    const items = modalUserList.querySelectorAll('.modal-user-item');
    items.forEach(item => {
        const originalOnClick = item.onclick;
        item.onclick = (e) => {
            originalOnClick(e);
            updateRecipientIndicator();
        };
    });
};
