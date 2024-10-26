"use strict";
// main.ts
const socket = new WebSocket('ws://localhost:3000');
socket.addEventListener('open', () => {
    console.log('Connected to server');
});
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    // Handle incoming data
});
socket.addEventListener('close', () => {
    console.log('Disconnected from server');
});
function sendMessage(message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    }
}
let selectedToken = null;
let selectedBots = 0;
// Token selection logic
document.querySelectorAll('.token-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        // Remove 'selected' class from all token buttons
        document.querySelectorAll('.token-btn').forEach((b) => b.classList.remove('bg-blue-500', 'text-white'));
        // Add 'selected' class to the clicked token button
        btn.classList.add('bg-blue-500', 'text-white');
        selectedToken = btn.getAttribute('data-token');
        updateSummary();
    });
});
// Bot selection logic
document.querySelectorAll('.bot-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
        // Remove 'selected' class from all bot buttons
        document.querySelectorAll('.bot-btn').forEach((b) => b.classList.remove('bg-blue-500', 'text-white'));
        // Add 'selected' class to the clicked bot button
        btn.classList.add('bg-blue-500', 'text-white');
        selectedBots = parseInt(btn.getAttribute('data-bot') || '0', 10);
        updateSummary();
    });
});
// Function to update the summary
function updateSummary() {
    const summary = document.getElementById('summary');
    const selectedTokenText = document.getElementById('selected-token');
    const selectedBotsText = document.getElementById('selected-bots');
    selectedTokenText.textContent = `Selected Token: ${selectedToken ? selectedToken : 'None'}`;
    selectedBotsText.textContent = `Number of Bots: ${selectedBots}`;
    summary.classList.toggle('hidden', !selectedToken || selectedBots < 0); // Show only if token is selected
}
// Game Start Button Logic
document.getElementById('start-game-btn').addEventListener('click', () => {
    if (!selectedToken) {
        alert('Please choose a token');
        return;
    }
    // Show loading screen while the game starts
    document.getElementById('loading-screen').classList.remove('hidden');
    // Send game setup to server
    startGame();
});
// Start game function
function startGame() {
    const botTokens = ['Race Car', 'Scottie Dog', 'Cat', 'Penguin', 'Rubber Ducky', 'T-Rex', 'Wheelbarrow'];
    const botAssignments = [];
    for (let i = 0; i < selectedBots; i++) {
        const randomIndex = Math.floor(Math.random() * botTokens.length);
        botAssignments.push(botTokens.splice(randomIndex, 1)[0]);
    }
    // Create a message object to send to the server
    const gameSetupMessage = {
        type: 'gameStart',
        playerToken: selectedToken,
        bots: botAssignments
    };
    sendMessage(gameSetupMessage);
    // Hide setup screen and show game screen after 2s delay to simulate loading
    setTimeout(() => {
        document.getElementById('setup-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.remove('hidden');
        document.getElementById('loading-screen').classList.add('hidden');
    }, 2000);
}
