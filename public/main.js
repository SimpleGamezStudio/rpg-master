document.addEventListener("DOMContentLoaded", function () {
  const chatLog = document.getElementById("chat-log");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const startBtn = document.getElementById("start-btn");

  let recognition;

  function speak(text) {
    fetch("/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    })
    .then(res => {
      if (!res.ok) throw new Error("Błąd TTS");
      return res.json();
    })
    .then(data => {
      if (!data.url) throw new Error("Brak URL z TTS");
      const audio = new Audio(data.url);
      audio.crossOrigin = "anonymous";
      audio.play().catch(err => {
        console.error("Błąd odtwarzania:", err);
      });
    })
    .catch(err => {
      console.error("Błąd odtwarzania głosu:", err);
    });
  }

  function appendMessage(sender, text) {
    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<strong>${sender === "gm" ? "Mistrz Gry" : "Gracz"}:</strong> <span class="text"></span>`;
    chatLog.appendChild(div);
    animateText(div.querySelector(".text"), text);
    chatLog.scrollTop = chatLog.scrollHeight;

    if (sender === "gm") speak(text);
  }

  function animateText(container, text) {
    let i = 0;
    function type() {
      if (i < text.length) {
        container.textContent += text[i++];
        setTimeout(type, 25);
      }
    }
    type();
  }

  function sendMessage(message) {
    appendMessage("user", message);
    input.value = "";
    fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    })
    .then(res => res.json())
    .then(data => {
      if (data.reply) appendMessage("gm", data.reply);
    });
  }

  sendBtn.addEventListener("click", () => {
    const message = input.value.trim();
    if (message) sendMessage(message);
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendBtn.click();
  });

  if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "pl-PL";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      input.value = transcript;
      sendBtn.click();
    };
    recognition.onerror = (event) => {
      console.error("Błąd rozpoznawania mowy:", event);
    };
  }

  micBtn.addEventListener("click", () => {
    if (recognition) recognition.start();
  });

  startBtn.addEventListener("click", () => {
    startBtn.style.display = "none";
    document.getElementById("chat-log").style.display = "block";
    document.getElementById("controls").style.display = "flex";
    micBtn.style.display = "block";

    appendMessage("gm", "Witaj! Ilu graczy weźmie udział w tej kampanii? Czy chcecie zagrać w gotową przygodę, czy stworzyć własną?");
  });
});
