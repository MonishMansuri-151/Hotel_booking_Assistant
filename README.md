# Voice Assistant Hotel Booking — modular backend

This package is a modular backend replacement based on the `main.py` code shared in chat. It switches Gemini to Groq and keeps ElevenLabs STT/TTS plus the existing MySQL booking schema.

## Expected existing files
Keep your existing `database.py`, `static/`, and `templates/` in the project root. `database.py` must expose `get_connection()` and return a MySQL connection compatible with `cursor(dictionary=True)`.

## Structure
- `main.py`: FastAPI routes
- `app/config.py`: environment configuration
- `app/services/ai_service.py`: Groq JSON extraction
- `app/services/voice_service.py`: ElevenLabs speech-to-text and text-to-speech
- `app/services/hotel_service.py`: hotel/room queries and transactional booking
- `app/services/booking_service.py`: conversation state machine
- `app/state.py`: temporary in-memory conversation state

## Setup
1. Copy these files into your existing project, preserving `database.py`, `static/`, and `templates/`.
2. Add the variables from `.env.example` to your local `.env`; do not commit `.env`.
3. Ensure your existing DB variables are still present and match `database.py`.
4. Install dependencies: `pip install -r requirements.txt` (or add `groq` to your current requirements while preserving any other packages your project needs).
5. For Vercel, set `GROQ_API_KEY`, `GROQ_MODEL`, ElevenLabs variables, and all existing DB variables in Project → Settings → Environment Variables. Redeploy.

## Important deployment notes
- Do not use `uvicorn ...` on Vercel; that command is only for optional local testing.
- Vercel serverless instances do not reliably preserve Python in-memory `sessions`. For reliable multi-turn booking, move `sessions` to Redis or a database before production.
- This bundle does not include or modify your frontend JavaScript, HTML, or `database.py`, because those source files were not included in the latest pasted code. Keep them and share the browser console error if the JS still fails.
- Check `/health` after deployment. It reports whether API keys are configured, not whether external providers or the database are reachable.
