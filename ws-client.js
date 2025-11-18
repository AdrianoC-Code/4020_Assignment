// ws-client.js

let socket = null;

function initWSChat() {
  console.log("initWSChat() called");

  // 1. Grab elements from the HTML (they exist now because contact.html was just injected)
  const output = document.getElementById("ws-output");
  const input = document.getElementById("ws-input");
  const button = document.getElementById("ws-send");

  console.log("ws elements:", { output, input, button });

  // If we’re not on the contact page, just bail
  if (!output || !input || !button) {
    console.warn("WS chat elements not found on this route.");
    return;
  }

  // 2. Helper to show messages in the chat window
  function addMessage(text, sender = "server") {
    const p = document.createElement("p");
    p.style.margin = "4px 0";
    p.textContent = (sender === "you" ? "You: " : "Server: ") + text;
    output.appendChild(p);
    output.scrollTop = output.scrollHeight; // auto-scroll
  }

  // 3. Create / reuse WebSocket
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    console.log("Creating new WebSocket connection...");
    socket = new WebSocket(`ws://${window.location.host}`);

    // When WebSocket connects
    socket.addEventListener("open", () => {
      console.log("WebSocket open");
      addMessage("Connected to server!", "server");
    });

    // When server sends a message
    socket.addEventListener("message", (event) => {
      console.log("Message from server:", event.data);
      addMessage(event.data, "server");
    });

    socket.addEventListener("close", () => {
      console.log("WebSocket closed");
      addMessage("WebSocket connection closed.", "server");
    });

    socket.addEventListener("error", (err) => {
      console.error("WebSocket error:", err);
      addMessage("WebSocket error occurred.", "server");
    });
  }

  // 4. Send handler
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      addMessage("Cannot send: WebSocket not open.", "server");
      return;
    }

    // Add your own message to screen
    addMessage(text, "you");

    // Send to server
    socket.send(text);

    input.value = "";
    input.focus();
  }

  // 5. When you click "Send"
  button.addEventListener("click", (e) => {
    e.preventDefault();
    sendMessage();
  });

  // 6. (Optional) Allow pressing Enter instead of clicking "Send"
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Expose initWSChat globally so router.js can call it
window.initWSChat = initWSChat;
