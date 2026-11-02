import json
from datetime import date
from groq import Groq
from app.config import GROQ_API_KEY, GROQ_MODEL

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


def extract_booking_request(user_text: str, state: dict) -> dict:
    if client is None:
        raise RuntimeError("GROQ_API_KEY is missing in environment variables.")

    prompt = f'''You are a hotel booking voice assistant intent extractor.
Today's date: {date.today().isoformat()}
Current booking context: {json.dumps(state, default=str)}
User said: {user_text}

Return a JSON object with exactly these keys:
{{"intent":"hotel_list | hotel_search | general","hotel_name":null,"check_in":null,"check_out":null,"guests":1,"message":null}}

Rules:
- hotel_list: asks to list/show available hotels, without choosing one.
- hotel_search: asks to search/book rooms in a named hotel or gives dates for a selected hotel.
- general: greetings, small talk, unrelated questions.
- Never invent hotel names, availability, prices, dates, or confirmations.
- Dates must be ISO YYYY-MM-DD. Resolve relative dates using today's date.
- Use null when a date or hotel name is not clear.
- For general messages, provide a short friendly message.
'''

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": "Return only a valid JSON object. No markdown. Follow the requested schema."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    raw = response.choices[0].message.content or "{}"
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Groq returned JSON that is not an object.")
    if data.get("intent") not in {"hotel_list", "hotel_search", "general"}:
        data["intent"] = "general"
    return data
