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
app.use(express.static('public')); // Serve mp3 files

// 💬 Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    console.log("📥 User message:", userMessage);

    // Create thread
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

    // Add system message
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'system', content: 'Jesteś Mistrzem Gry RPG. Mów tylko po polsku.' })
    });

    // Add user message
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'user', content: userMessage })
    });

    // Run assistant
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
      const runCheck = await fetch(`https://api.openai.com/v1/
