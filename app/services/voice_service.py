import io
from elevenlabs.client import ElevenLabs
from app.config import ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID

client = ElevenLabs(api_key=ELEVENLABS_API_KEY) if ELEVENLABS_API_KEY else None


def transcribe_audio(raw_audio: bytes) -> str:
    if client is None:
        raise RuntimeError("ELEVENLABS_API_KEY is missing.")
    result = client.speech_to_text.convert(file=io.BytesIO(raw_audio), model_id="scribe_v1")
    return (getattr(result, "text", "") or "").strip()


def synthesize_audio(text: str) -> bytes:
    if client is None:
        raise RuntimeError("ELEVENLABS_API_KEY is missing.")
    chunks = client.text_to_speech.convert(
        text=text,
        voice_id=ELEVENLABS_VOICE_ID,
        model_id="eleven_flash_v2_5",
        output_format="mp3_44100_128",
    )
    return b"".join(chunks)
