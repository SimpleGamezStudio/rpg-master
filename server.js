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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 🎮 Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    const threadId = (await threadRes.json()).id;

    // System & user messages
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

    const messagesData = await messageRes.json();
    const reply = messagesData?.data?.find(m => m.role === 'assistant')?.content?.[0]?.text?.value;

    if (!reply) return res.status(500).json({ error: 'No assistant reply' });

    res.json({ reply });
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({ error: 'Chat server error' });
  }
});

// 🔊 TTS endpoint
app.post('/tts', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const voiceId = "TxGEqnHWrfWFTfGW9XjX"; // Polish voice
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

    if (!ttsRes.ok) {
      const errorText = await ttsRes.text();
      return res.status(500).json({ error: 'TTS failed', details: errorText });
    }

    const buffer = Buffer.from(await ttsRes.arrayBuffer());
    const filename = `output-${Date.now()}.mp3`;
    const filepath = path.join(__dirname, 'public', filename);
    fs.writeFileSync(filepath, buffer);

    res.json({ audioUrl: `https://rpg-master.onrender.com/${filename}` });
  } catch (err) {
    console.error("❌ TTS error:", err);
    res.status(500).json({ error: 'TTS server error' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
