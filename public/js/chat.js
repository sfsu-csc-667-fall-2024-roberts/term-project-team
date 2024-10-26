"use strict";
// Define or import currentUser at the top of the file
const currentUser = { username: 'defaultUser' }; // Replace with actual user data
const chatInput = document.getElementById('chatInput');
const messagesDiv = document.getElementById('messages');
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        const message = {
            type: 'chat',
            content: chatInput.value.trim(),
            username: currentUser.username,
        };
        sendMessage(message);
        chatInput.value = '';
    }
});
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'chat') {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${data.username}: ${data.content}`;
        if (messagesDiv) {
            messagesDiv.appendChild(messageElement);
        }
    }
});
