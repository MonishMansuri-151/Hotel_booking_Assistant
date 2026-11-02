import base64
import logging
import traceback
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import BASE_DIR, GROQ_API_KEY, ELEVENLABS_API_KEY, MAX_AUDIO_BYTES, STATIC_DIR, TEMPLATES_DIR
from app.state import sessions
from app.services.booking_service import process_booking
from app.services.ai_service import extract_booking_request
from app.services.voice_service import transcribe_audio, synthesize_audio
from app.services.hotel_service import get_all_hotels

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voiceassistant")
app = FastAPI(title="Voice Assistant Hotel Booking")

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR)) if TEMPLATES_DIR.exists() else None


# @app.get("/", response_class=HTMLResponse)
# async def home(request: Request):
#     if templates is None:
#         return HTMLResponse("Templates directory is missing.", status_code=500)
#     return templates.TemplateResponse(request=request, name="index.html", context={})

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={}
    )

@app.get("/health")
async def health():
    return {"status": "ok", "groq_configured": bool(GROQ_API_KEY),
            "elevenlabs_configured": bool(ELEVENLABS_API_KEY)}


@app.post("/api/voice")
async def voice_assistant(audio: UploadFile = File(...), conversation_id: str = Form("default")):
    if not ELEVENLABS_API_KEY:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY is missing.")
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is missing.")

    raw_audio = await audio.read()
    if not raw_audio:
        raise HTTPException(status_code=400, detail="Audio is empty.")
    if len(raw_audio) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio file too large. Maximum size is 15 MB.")

    try:
        user_text = transcribe_audio(raw_audio)
        if not user_text:
            raise HTTPException(status_code=400, detail="Speech could not be understood.")

        state = sessions[conversation_id]
        # Date collection: ask Groq to extract dates, but preserve the selected hotel.
        if state.get("stage") == "awaiting_dates":
            data = extract_booking_request(user_text, state)
            if data.get("intent") == "general":
                reply = data.get("message") or "Hello! How can I help you today?"
            elif data.get("intent") == "hotel_list":
                reply, _ = process_booking(user_text, state)
            else:
                if data.get("check_in"):
                    state["check_in"] = data["check_in"]
                if data.get("check_out"):
                    state["check_out"] = data["check_out"]
                if state.get("check_in") and state.get("check_out"):
                    reply, _ = process_booking(user_text, state)
                else:
                    reply = "Please provide both check-in and check-out dates, for example, 25 October to 26 October."
        else:
            reply, _ = process_booking(user_text, state)

        audio_bytes = synthesize_audio(reply)
        if not audio_bytes:
            raise HTTPException(status_code=502, detail="ElevenLabs did not return audio.")
        return {"transcript": user_text, "reply": reply,
                "audio_base64": base64.b64encode(audio_bytes).decode("utf-8"),
                "audio_mime_type": "audio/mpeg"}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Voice API failed")
        raise HTTPException(status_code=502, detail=f"Voice request failed: {str(exc)}") from exc
