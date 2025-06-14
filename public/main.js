document.addEventListener("DOMContentLoaded", function () {
  const chatLog = document.getElementById("chat-log");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const startBtn = document.getElementById("start-btn");
  const status = document.getElementById("status-indicator");

  let recognition;
  let recognitionAvailable = false;
  let isSpeaking = false;

  function setInputEnabled(enabled) {
    input.disabled = !enabled;
    sendBtn.disabled = !enabled;
    micBtn.disabled = !enabled;

    if (enabled) {
      status.textContent = "🟢 Możesz odpowiedzieć";
      status.style.opacity = "1";
    } else {
      status.textContent = "⏳ Mistrz Gry mówi...";
      status.style.opacity = "0.6";
    }
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

    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<strong>${sender === "gm" ? "Mistrz Gry" : "Gracz"}:</strong> <span class="text"></span>`;
    chatLog.appendChild(div);
    const textContainer = div.querySelector(".text");

    animateText(textContainer, text, () => {
      speakFromUrl(audioUrl, () => {
        isSpeaking = false;
        setInputEnabled(true);
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
    if (isSpeaking) return;

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
        appendMessage("gm", data.reply, data.audio);
      }
    })
    .catch(err => {
      console.error("Błąd komunikacji z serwerem:", err);
      setInputEnabled(true);
      isSpeaking = false;
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
      alert("⏳ Poczekaj, aż Mistrz Gry skończy mówić.");
    } else {
      alert("🎙️ Twoja przeglądarka nie obsługuje rozpoznawania mowy.");
    }
  });

  startBtn.addEventListener("click", () => {
    startBtn.style.display = "none";
    document.getElementById("chat-log").style.display = "block";
    document.getElementById("controls").style.display = "flex";
    micBtn.style.display = "block";
    status.style.display = "block";

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
      });
    })
    .catch(err => {
      console.error("Błąd odtwarzania wstępu:", err);
      isSpeaking = false;
      setInputEnabled(true);
    });
  });
});
