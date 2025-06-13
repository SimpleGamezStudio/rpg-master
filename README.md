# RPG Master Backend

This repository contains a simple Express server and static front-end used for
an AI powered game master. The `/chat` endpoint proxies requests to the OpenAI
Assistants API while `/tts` generates speech using ElevenLabs.

### Running locally

```bash
npm install
npm start
```

### Front-end notes

`public/main.js` expects the `/tts` endpoint to respond with JSON containing an
`url` field pointing to the generated `.mp3` file. The script will download that
audio and play it in the browser.
