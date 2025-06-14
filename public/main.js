document.addEventListener("DOMContentLoaded", async function () {
  const chatLog = document.getElementById("chat-log");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const startBtn = document.getElementById("start-btn");
  const statusIndicator = document.getElementById("status-indicator");

  let recognition;
  let recognitionAvailable = false;
  let isSpeaking = false;
  let username = localStorage.getItem("rpgUsername");

  async function getOrPromptUsername() {
    if (!username) {
      username = prompt("Podaj swoją nazwę gracza:");
      if (!username) {
        alert("Musisz podać nazwę!");
        return;
      }

      const loginRes = await fetch("https://rpg-master.onrender.com/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });

      if (loginRes.status === 404) {
        await fetch("https://rpg-master.onrender.com/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username })
        });
      }

      localStorage.setItem("rpgUsername", username);
    }
  }

  await getOrPromptUsername();

  function setInputEnabled(enabled) {
    input.disabled = !enabled;
    sendBtn.disabled = !enabled;
    micBtn.disabled = !enabled;
  }

  function speakFromUrl(audioUrl, callback) {
    if (!audioUrl) {
      callback?.();
      return;
    }
    const audio = new Audio(audioUrl);
    audio.onended = () => callback?.();
    audio.onerror = () => callback?.();
    audio.play().catch((err) => {
      console.error("Błąd odtwarzania głosu:", err);
      callback?.();
    });
  }

  function appendMessage(sender, text, audioUrl = null) {
    isSpeaking = true;
    setInputEnabled(false);
    statusIndicator.style.display = "block"; // ✅ Show "Mistrz Gry mówi..."

    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<strong>${sender === "gm" ? "Mistrz Gry" : "Gracz"}:</strong> <span class="text"></span>`;
    chatLog.appendChild(div);
    const textContainer = div.querySelector(".text");
    animateText(textContainer, text, () => {
      speakFromUrl(audioUrl, () => {
        isSpeaking = false;
        setInputEnabled(true);
        statusIndicator.style.display = "none"; // ✅ Hide after speaking
      });
    });
    chatLog.scrollTop = chatLog.scrollHeight;
  }

  function animateText(container, text, onComplete) {
    let i = 0;
    function type() {
      if (i < text.length) {
        container.textContent += text[i++];
        setTimeout(type, 25);
      } else {
        onComplete?.();
      }
    }
    type();
  }

  function sendMessage(message) {
    if (isSpeaking || !username) return;

    appendMessage("user", message);
    input.value = "";
    fetch("https://rpg-master.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, username })
    })
    .then(res => res.json())
    .then(data => {
      if (data.reply) {
        appendMessage("gm", data.reply, data.audio);
      }
    })
    .catch(err => {
      console.error("Błąd komunikacji z serwerem:", err);
      setInputEnabled(true);
      isSpeaking = false;
      statusIndicator.style.display = "none";
    });
  }

  sendBtn.addEventListener("click", () => {
    const message = input.value.trim();
    if (message && !isSpeaking) sendMessage(message);
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !isSpeaking) sendBtn.click();
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
      alert("Nie udało się rozpoznać mowy. Upewnij się, że mikrofon działa.");
    };

    recognitionAvailable = true;
  }

  micBtn.addEventListener("click", () => {
    if (recognitionAvailable && recognition && !isSpeaking) {
      try {
        recognition.start();
      } catch (e) {
        console.warn("⚠️ Rozpoznawanie mowy już aktywne lub błąd:", e);
      }
    } else if (isSpeaking) {
      alert("Poczekaj, aż Mistrz Gry skończy mówić.");
    } else {
      alert("Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
    }
  });

  startBtn.addEventListener("click", () => {
    startBtn.style.display = "none";
    document.getElementById("chat-log").style.display = "block";
    document.getElementById("controls").style.display = "flex";
    micBtn.style.display = "block";

    const intro = "Witaj! Ilu graczy weźmie udział w tej kampanii? Czy chcecie zagrać w gotową przygodę, czy stworzyć własną?";
    appendMessage("gm", intro);

    fetch("https://rpg-master.onrender.com/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: intro })
    })
    .then(res => {
      if (!res.ok) throw new Error("TTS request failed");
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      speakFromUrl(url, () => {
        isSpeaking = false;
        setInputEnabled(true);
        statusIndicator.style.display = "none";
      });
    })
    .catch(err => {
      console.error("Błąd odtwarzania wstępu:", err);
      isSpeaking = false;
      setInputEnabled(true);
      statusIndicator.style.display = "none";
    });
  });
});
