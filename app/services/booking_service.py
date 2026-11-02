import re
from app.services.ai_service import extract_booking_request
from app.services.hotel_service import get_all_hotels, find_available_rooms, create_guest, reserve_room


def _hotel_list_text(hotels):
    if not hotels:
        return "There are currently no hotels with rooms in our database."
    options = [
        f"Option {i}: {hotel['name']}, {hotel.get('location') or 'Location not specified'}."
        for i, hotel in enumerate(hotels, 1)
    ]
    return "Here are the hotels in our database. " + " ".join(options)


def _room_list_text(rooms):
    return " ".join(
        f"Option {i}: {room['room_type']}, room {room['room_number']}, Rs. {room['price_per_night']:.2f} per night."
        for i, room in enumerate(rooms, 1)
    )


def _select_room(text, rooms):
    normalized = text.strip().lower()
    match = re.search(r"\b(?:option|room|number|no\.?)\s*(\d+)\b", normalized)
    if match:
        n = int(match.group(1))
        if 1 <= n <= len(rooms):
            return rooms[n - 1]
    number_words = {"first": 1, "one": 1, "second": 2, "two": 2, "third": 3, "three": 3,
                    "pehla": 1, "पहला": 1, "doosra": 2, "दूसरा": 2, "teesra": 3, "तीसरा": 3}
    for word, n in number_words.items():
        if re.search(rf"\b{re.escape(word)}\b", normalized) and n <= len(rooms):
            return rooms[n - 1]
    matches = [r for r in rooms if str(r.get("room_type", "")).lower() in normalized]
    return matches[0] if len(matches) == 1 else None


def process_booking(user_text: str, state: dict):
    stage = state.get("stage")

    if stage == "awaiting_hotel_choice":
        hotels = state.get("hotel_options", [])
        text = user_text.strip().lower()
        match = re.search(r"\b(?:option|number|hotel)\s*(\d+)\b", text)
        selected = None
        if match:
            n = int(match.group(1))
            if 1 <= n <= len(hotels):
                selected = hotels[n - 1]
        if selected is None:
            matches = [h for h in hotels if h["name"].lower() in text]
            if len(matches) == 1:
                selected = matches[0]
        if selected is None:
            return "Please say the hotel name or its option number from the list.", None
        state.clear()
        state.update({"hotel_name": selected["name"], "stage": "awaiting_dates"})
        return f"You selected {selected['name']}. What are your check-in and check-out dates?", None

    if stage == "awaiting_room":
        room = _select_room(user_text, state.get("rooms", []))
        if not room:
            return "Please tell me the option number or room type you want to book.", None
        state["selected_room"] = room
        state["stage"] = "awaiting_name"
        return (f"You selected {room['room_type']}, room {room['room_number']}, at Rs. "
                f"{room['price_per_night']:.2f} per night. Please tell me the guest name."), None

    if stage == "awaiting_name":
        name = user_text.strip()
        if len(name) < 2 or len(name) > 100:
            return "Please tell me a valid guest name.", None
        state["guest_name"] = name
        state["stage"] = "awaiting_confirmation"
        room = state["selected_room"]
        return (f"Please confirm: {state['hotel_name']}, {room['room_type']}, check-in {state['check_in']}, "
                f"check-out {state['check_out']}, guest {name}. Should I confirm this booking? Say yes or no."), None

    if stage == "awaiting_confirmation":
        answer = user_text.strip().lower()
        if answer in {"no", "cancel", "nahi", "nahin", "mat karo"}:
            state.clear()
            return "Okay, I have not made the booking.", None
        if answer not in {"yes", "confirm", "haan", "han", "ha", "kar do", "book it", "ji haan", "yes book"}:
            return "Please say yes to confirm or no to cancel.", None
        try:
            user_id = create_guest(state["guest_name"])
            result = reserve_room(user_id, state["selected_room"]["room_id"], state["check_in"], state["check_out"])
            if not result["success"]:
                state.clear()
                return result["message"], None
            booking_id = result["booking_id"]
            state.clear()
            return f"Your booking is confirmed. Your booking ID is {booking_id}. Thank you!", {"booking_id": booking_id}
        except Exception:
            state.clear()
            raise

    data = extract_booking_request(user_text, state)
    intent = data.get("intent", "general")
    if intent == "general":
        return str(data.get("message") or "Hello! I can help you find hotels and book rooms."), None
    if intent == "hotel_list":
        state.clear()
        hotels = get_all_hotels()
        if not hotels:
            return _hotel_list_text(hotels), None
        state.update({"hotel_options": hotels, "stage": "awaiting_hotel_choice"})
        return _hotel_list_text(hotels) + " Which hotel would you like to explore or book?", None
    if intent != "hotel_search":
        return "I can show hotels or help you book a room. What would you like to do?", None

    hotel_name = data.get("hotel_name") or state.get("hotel_name")
    check_in = data.get("check_in") or state.get("check_in")
    check_out = data.get("check_out") or state.get("check_out")
    if not hotel_name:
        state.clear()
        return "Which hotel's room would you like to book?", None
    state["hotel_name"] = str(hotel_name)
    if not check_in or not check_out:
        state.update({"check_in": check_in, "check_out": check_out, "stage": "awaiting_dates"})
        return f"What are your check-in and check-out dates for {hotel_name}?", None

    rooms = find_available_rooms(hotel_name, check_in, check_out)
    if not rooms:
        state.clear()
        return f"Sorry, no available rooms were found at {hotel_name} between {check_in} and {check_out}.", None
    state.update({"hotel_name": hotel_name, "check_in": str(check_in), "check_out": str(check_out),
                  "rooms": rooms, "stage": "awaiting_room"})
    return (f"I found {len(rooms)} available rooms at {hotel_name}. {_room_list_text(rooms)} "
            "Please say the option number or room type you prefer."), None
