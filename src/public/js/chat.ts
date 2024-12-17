const form = document.querySelector<HTMLFormElement>("#chat-section form")!;
const input = document.querySelector<HTMLInputElement>("input#chat-message")!;

form.addEventListener("submit", (e) => {
    e.preventDefault();
  
    const message = input.value;
    input.value = "";

    fetch(`/chat/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })

    }).then((response) => {
        if(response.status !== 200) {
            console.error("Error:", response);
        }
    })
  
    /*fetch(`/chat/${window.roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).then((response) => {
      if (response.status !== 200) {
        console.error("Error:", response);
      }
    });*/
  });