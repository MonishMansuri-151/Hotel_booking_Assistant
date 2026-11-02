from datetime import date
from database import get_connection


def get_all_hotels():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT h.id, h.name, h.location
            FROM hotels h
            WHERE EXISTS (SELECT 1 FROM rooms r WHERE r.hotel_id = h.id)
            ORDER BY h.name
        """)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()


def find_available_rooms(hotel_name: str, check_in: str, check_out: str):
    start = date.fromisoformat(str(check_in))
    end = date.fromisoformat(str(check_out))
    if end <= start:
        raise ValueError("Check-out must be after check-in.")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT r.id AS room_id, h.id AS hotel_id, h.name AS hotel_name,
                   h.location, r.room_number, r.room_type, r.price_per_night
            FROM rooms r
            JOIN hotels h ON h.id = r.hotel_id
            WHERE h.name LIKE %s
              AND NOT EXISTS (
                  SELECT 1 FROM bookings b
                  WHERE b.room_id = r.id AND b.status = 'confirmed'
                    AND b.check_in < %s AND b.check_out > %s
              )
            ORDER BY r.price_per_night
        """, (f"%{hotel_name}%", end, start))
        rooms = cursor.fetchall()
        for room in rooms:
            room["price_per_night"] = float(room["price_per_night"])
        return rooms
    finally:
        cursor.close()
        conn.close()


def create_guest(name: str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO users (name) VALUES (%s)", (name,))
        conn.commit()
        return cursor.lastrowid
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()


def reserve_room(user_id: int, room_id: int, check_in: str, check_out: str):
    start = date.fromisoformat(str(check_in))
    end = date.fromisoformat(str(check_out))
    if end <= start:
        raise ValueError("Invalid booking dates.")

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        cursor.execute("SELECT id FROM rooms WHERE id = %s FOR UPDATE", (room_id,))
        if not cursor.fetchone():
            conn.rollback()
            return {"success": False, "message": "Room not found."}

        cursor.execute("""
            SELECT id FROM bookings
            WHERE room_id = %s AND status = 'confirmed'
              AND check_in < %s AND check_out > %s
            LIMIT 1
        """, (room_id, end, start))
        if cursor.fetchone():
            conn.rollback()
            return {"success": False, "message": "Sorry, this room has just been booked."}

        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        if not cursor.fetchone():
            conn.rollback()
            return {"success": False, "message": "Guest not found."}

        cursor.execute("""
            INSERT INTO bookings (user_id, room_id, check_in, check_out, status)
            VALUES (%s, %s, %s, %s, 'confirmed')
        """, (user_id, room_id, start, end))
        booking_id = cursor.lastrowid
        conn.commit()
        return {"success": True, "booking_id": booking_id}
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
