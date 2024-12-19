const form = document.querySelector<HTMLFormElement>("#chat-section form")!;
const input = document.querySelector<HTMLInputElement>("input#chat-message")!;
const messageArea =
  document.querySelector<HTMLUListElement>("#chat-section ul")!;
const messageTemplate = document.querySelector<HTMLTemplateElement>(
  "#chat-message-template",
)!;

//Determines socket room number before assigning
if(window.gameData === undefined) {
  window.roomId = -1;
  console.log("roomId = " + window.roomId + "(undefined gameId)");
} else {
  window.roomId = window.gameData.gameId;
  console.log("roomId(gameId) = " + window.gameData.gameId);
}

//Joins the respective chat room
/*fetch(`/chat/join/${window.roomId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" }
}).then((response) => {
  if(response.status !== 200) {
      console.error("Error:", response);
  }
})*/

form.addEventListener("submit", (e) => {
    e.preventDefault();
  
    const message = input.value;
    input.value = "";

    //replace fetch with /chat/${window.roomId} after implementing sockets/sessions/etc
    fetch(`/chat/${window.roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })

    }).then((response) => {
        if(response.status !== 200) {
            console.error("Error:", response);
        }
    })
  });

  window.socket.on(
    `message:${window.roomId}`,
    ({
      message,
      sender,
    }: {
      message: string;
      sender: string;
      timestamp: string;
    }) => {
      const messageElement = messageTemplate.content.cloneNode(
        true,
      ) as HTMLElement;  
      const span = messageElement.querySelector("span")!;
      span.textContent = message;
  
      if (sender === "system") {
        span.classList.add("text-red-500");
      }
  
      messageArea.appendChild(messageElement);
      messageArea.scrollTo(0, messageArea.scrollHeight);
    },
  );