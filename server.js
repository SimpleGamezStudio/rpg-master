const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

const USERS_FILE = path.join(__dirname, 'users.json');

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves .mp3 files

// 🧑‍💻 Register a new user
app.post('/register', (req, res) => {
  const { username } = req.body;
  const users = loadUsers();

  if (users[username]) {
    return res.status(400).json({ error: 'Użytkownik już istnieje.' });
  }

  users[username] = { threadId: null };
  saveUsers(users);
  res.json({ success: true });
});

// 🔐 Login existing user
app.post('/login', (req, res) => {
  const { username } = req.body;
  const users = loadUsers();

  if (!users[username]) {
    return res.status(404).json({ error: 'Nie znaleziono użytkownika.' });
  }

  res.json({ success: true, username });
});

// 🧠 Chat route (GPT + TTS)
app.post('/chat', async (req, res) => {
  try {
    const { message, username } = req.body;
    if (!username) return res.status(400).json({ error: "Brak nazwy użytkownika" });

    const users = loadUsers();
    if (!users[username]) return res.status(404).json({ error: "Nieznany użytkownik" });

    let threadId = users[username].threadId;

    if (!threadId) {
      const threadRes = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      });

      threadId = (await threadRes.json()).id;
      users[username].threadId = threadId;
      saveUsers(users);
    }

    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'system', content: 'Jesteś Mistrzem Gry RPG. Mów tylko po polsku.' })
    });

    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'user', content: message })
    });

    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ assistant_id: ASSISTANT_ID })
    });

    const runData = await runRes.json();
    let status = 'in_progress';

    while (status === 'in_progress') {
      await new Promise(r => setTimeout(r, 1000));
      const runCheck = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runData.id}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      status = (await runCheck.json()).status;
    }

    const messageRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    const messages = await messageRes.json();
    const reply = messages?.data?.find(m => m.role === 'assistant')?.content?.[0]?.text?.value;
    if (!reply) return res.json({ reply: "Brak odpowiedzi.", audio: null });

    const voiceId = "TxGEqnHWrfWFTfGW9XjX"; // Adam
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: reply,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!ttsRes.ok) {
      console.warn("⚠️ TTS failed, sending only text");
      return res.json({ reply, audio: null });
    }

    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    const filename = `output-${Date.now()}.mp3`;
    const filepath = path.join(__dirname, 'public', filename);
    fs.writeFileSync(filepath, buffer);
    const audioUrl = `https://rpg-master.onrender.com/${filename}`;

    res.json({ reply, audio: audioUrl });
  } catch (e) {
    console.error("❌ Server error:", e);
    res.status(500).send("Internal server error");
  }
});

// 🎙️ TTS-only route
app.post('/tts', async (req, res) => {
  try {
    const text = req.body.text;
    const voiceId = "TxGEqnHWrfWFTfGW9XjX"; // Adam

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!ttsRes.ok) return res.status(500).send("TTS failed");

    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (e) {
    console.error("TTS error:", e);
    res.status(500).send("TTS error");
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
