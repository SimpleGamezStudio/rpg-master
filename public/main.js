document.addEventListener("DOMContentLoaded", async function () {
  const chatLog = document.getElementById("chat-log");
  const input = document.getElementById("user-input");
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const startBtn = document.getElementById("start-btn");
  const statusIndicator = document.getElementById("status-indicator");
  const controls = document.getElementById("controls");

  let recognition;
  let recognitionAvailable = false;
  let isSpeaking = false;
  let username = localStorage.getItem("rpgUsername");

  chatLog.style.display = "none";
  micBtn.style.display = "none";
  controls.style.display = "none";
  statusIndicator.style.display = "none";

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

    const div = document.createElement("div");
    div.className = "message";
    div.innerHTML = `<strong>${sender === "gm" ? "Mistrz Gry" : "Gracz"}:</strong> <span class="text"></span>`;
    chatLog.appendChild(div);
    const textContainer = div.querySelector(".text");

    animateText(textContainer, text, () => {
      // 🔓 Odblokuj UI zaraz po animacji tekstu
      if (controls.style.display === "none") {
        controls.style.display = "flex";
        micBtn.style.display = "block";
      }
      setInputEnabled(true);

      speakFromUrl(audioUrl, () => {
        isSpeaking = false;
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
      });
  }

  sendBtn.addEventListener("click", () => {
    const message = input.value.trim();
    if (message && !isSpeaking) sendMessage(message);
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !isSpeaking) sendBtn.click();
  });

  // 🎙️ Mikrofon
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

  // 🎲 Rozpocznij grę — skrócone intro i wcześniejsze odblokowanie inputu
  startBtn.addEventListener("click", () => {
    const playerCount = document.getElementById("player-count").value;
    const difficulty = document.getElementById("difficulty").value;
    const characterChoice = document.getElementById("character-choice").value;
    const campaignChoice = document.getElementById("campaign-choice").value;

    document.getElementById("setup-form").style.display = "none";
    startBtn.style.display = "none";
    chatLog.style.display = "block";
    controls.style.display = "none";
    micBtn.style.display = "none";
    statusIndicator.style.display = "block";
    setInputEnabled(false);

    const intro = `Rozpocznij grę RPG dla ${playerCount} graczy na poziomie trudności "${difficulty}". ` +
      `Gracze wybrali: ${characterChoice}, kampania: ${campaignChoice}. ` +
      `Przywitaj ich krótkim wprowadzeniem i zadaj pytanie, co chcą zrobić jako pierwsze. Nie pisz zbyt długo.`;

    fetch("https://rpg-master.onrender.com/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: intro, username })
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
  });
});
