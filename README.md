# rpg-master

This project provides a simple voice-controlled RPG game master using Express and OpenAI's assistants API. The server returns both text responses and generated speech audio using ElevenLabs.

## Environment Variables

- `OPENAI_API_KEY` – API key for OpenAI.
- `ELEVEN_API_KEY` – API key for ElevenLabs text‑to‑speech.
- `ASSISTANT_ID` – ID of your OpenAI assistant.
- `WIX_ENDPOINT` – *(optional)* URL of a Wix HTTP function that should receive the generated text and audio URL. If provided, each response will be POSTed to this endpoint as JSON `{ text, audio }`.

Run the server with:

```bash
npm start
```

The client files are served from the `public` directory.
