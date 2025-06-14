document.addEventListener("DOMContentLoaded", function () {
  const chatLog = document.getElementById("chat-log");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const startBtn = document.getElementById("start-btn");

  let recognition;

  function speakFromUrl(audioUrl) {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
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
    fetch("https://rpg-master.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    })
    .then(res => res.json())
    .then(data => {
      if (data.reply) {
        appendMessage("gm", data.reply);
        if (data.audio) speakFromUrl(data.audio);
      }
    })
    .catch(err => {
      console.error("Błąd komunikacji z serwerem:", err);
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
      console.error("❌ Błąd rozpoznawania mowy:", event);
    };
  } else {
    console.warn("🎙️ WebkitSpeechRecognition niedostępny w tej przeglądarce.");
  }

  micBtn.addEventListener("click", () => {
    if (recognition) recognition.start();
    else alert("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
  });

  startBtn.addEventListener("click", () => {
    startBtn.style.display = "none";
    document.getElementById("chat-log").style.display = "block";
    document.getElementById("controls").style.display = "flex";
    micBtn.style.display = "block";

    appendMessage("gm", "Witaj! Ilu graczy weźmie udział w tej kampanii? Czy chcecie zagrać w gotową przygodę, czy stworzyć własną?");
  });
});
