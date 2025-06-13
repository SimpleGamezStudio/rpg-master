const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVEN_API_KEY = process.env.ELEVEN_API_KEY;
const ASSISTANT_ID = process.env.ASSISTANT_ID;

// Only allow your Wix site, adjust as needed
const ALLOWED_ORIGIN = 'https://scanmepoland.wixsite.com/my-site-1'; // <-- CHANGE THIS

app.use(cors({
  origin: ALLOWED_ORIGIN,
  credentials: true
}));
app.use(express.json({ limit: '2mb' })); // Increase if expecting large payloads

// Handle preflight for /chat
app.options('/chat', cors({
  origin: ALLOWED_ORIGIN,
  credentials: true
}));

// 🎮 Chat endpoint with text + TTS voice (base64)
app.post('/chat', async (req, res) => {
  // Set CORS headers explicitly for all responses
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    const userMessage = req.body.message;
    console.log("📥 User message:", userMessage);

    // 1. Create new thread
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

    // 2. Add system message
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'system', content: 'Jesteś Mistrzem Gry RPG. Mów tylko po polsku.' })
    });

    // 3. Add user message
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'user', content: userMessage })
    });

    // 4. Run assistant
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

    // 5. Get reply message
    const messageRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });

    const messages = await messageRes.json();
    const reply = messages?.data?.find(m => m.role === 'assistant')?.content?.[0]?.text?.value;

    if (!reply) {
      res.status(500).json({ error: "No assistant reply received.", audio: null });
      return;
    }

    // 6. Generate TTS using ElevenLabs
    const voiceId = "TxGEqnHWrfWFTfGW9XjX";
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
      const errText = await ttsRes.text();
      console.error("⚠️ TTS error:", errText);
      res.json({ reply, audio: null });
      return;
    }

    const audioBuffer = await ttsRes.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);
    const base64Audio = `data:audio/mpeg;base64,${buffer.toString("base64")}`;

    res.json({ reply, audio: base64Audio });

  } catch (e) {
    console.error("❌ Chat error:", e);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: "Server error.", audio: null });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
