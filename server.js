const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID || 'asst_Tj32dGAoXW97HpxgrBiHu3R4';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log("📥 User message:", userMessage);

    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    const threadData = await threadRes.json();
    const threadId = threadData.id;

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
      body: JSON.stringify({ role: 'user', content: userMessage })
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
      await new Promise(r => setTimeout(r, 1500));
      const runCheck = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runData.id}`, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      const runStatus = await runCheck.json();
      status = runStatus.status;
    }

    const messageRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    const messages = await messageRes.json();

    console.log("🧠 Full response from OpenAI:", JSON.stringify(messages, null, 2));

    const reply = messages?.data?.find(m => m.role === 'assistant')?.content?.[0]?.text?.value;

    if (!reply) {
      return res.status(500).send("No assistant reply received.");
    }

    res.json({ reply });

  } catch (e) {
    console.error("Server error:", e);
    res.status(500).send('Something went wrong.');
  }
});

app.post("/tts", async (req, res) => {
  try {
    const { text } = req.body;
    const voiceId = "h83JI5fjWWu9AOKOVRYh";

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      return res.status(500).send("TTS Error: " + errText);
    }

    const buffer = await ttsRes.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("TTS server error:", e);
    res.status(500).send("Server error.");
  }
});

// Optional health check route
app.get("/ping", (req, res) => {
  res.send("✅ RPG Game Master is running!");
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
