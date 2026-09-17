import json
import os
import time
import urllib.request
import xml.etree.ElementTree as ET

DATA_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "draws.json"
)


def get_latest_draw_id():
    url = "https://www.national-lottery.co.uk/results/lotto/draw-history/xml"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    
    try:
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
        root = ET.fromstring(xml_data)
        latest_draw = root.find(".//draw")
        
        if latest_draw is not None:
            return int(latest_draw.find("draw-number").text.strip())
    except Exception as e:
        print(f"[ERROR] Failed to fetch latest draw ID: {e}")
        
    return None


def fetch_draw(draw_id):
    url = f"https://www.national-lottery.co.uk/results/lotto/draw-history/{draw_id}/xml"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    try:
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
    except Exception as e:
        print(f"[ERROR] HTTP request failed for draw #{draw_id}: {e}")
        return None

    try:
        root = ET.fromstring(xml_data)
    except Exception as e:
        print(f"[ERROR] XML parse failed for draw #{draw_id}: {e}")
        return None

    latest_draw = root.find(".//draw")
    if latest_draw is None:
        print(f"[WARN] No <draw> node found for draw #{draw_id}")
        return None

    draw_number = int(latest_draw.find("draw-number").text.strip())
    if draw_number != draw_id:
        print(
            f"[WARN] Requested #{draw_id}, but XML returned draw #{draw_number}"
        )
        return None

    draw_date = latest_draw.find("draw-date").text.strip()

    ball_nodes = root.findall(".//balls")
    parsed_draws = []

    for node in ball_nodes:
        ball_tags = node.findall("ball")
        sorted_balls = sorted(ball_tags, key=lambda b: int(b.get("number", 0)))
        main_numbers = [int(b.text.strip()) for b in sorted_balls if b.text]

        bonus_tag = node.find("bonus-ball")
        bonus_number = (
            int(bonus_tag.text.strip())
            if (bonus_tag is not None and bonus_tag.text)
            else 0
        )

        if len(main_numbers) == 6:
            parsed_draws.append(main_numbers + [bonus_number])

    d1 = parsed_draws[0] if len(parsed_draws) > 0 else [0, 0, 0, 0, 0, 0, 0]
    d2 = parsed_draws[1] if len(parsed_draws) > 1 else [0, 0, 0, 0, 0, 0, 0]

    return {
        "draw_number": draw_number,
        "draw_date": draw_date,
        "draw1": {"numbers": d1[:6], "bonus": d1[6]},
        "draw2": {"numbers": d2[:6], "bonus": d2[6]},
    }


def backfill():
    latest_id = get_latest_draw_id()
    if not latest_id:
        print("[ERROR] Cannot proceed with backfill: unable to determine latest draw ID.")
        return

    start_id = latest_id - 49
    end_id = latest_id

    existing_draws = {}
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            try:
                draws_list = json.load(f)
                existing_draws = {d["draw_number"]: d for d in draws_list}
            except json.JSONDecodeError:
                existing_draws = {}

    print(f"Starting backfill for the 50 most recent draws (IDs {start_id} to {end_id} inclusive)...")
    for draw_id in range(start_id, end_id + 1):
        print(f"Fetching draw #{draw_id}...")
        data = fetch_draw(draw_id)
        if data:
            existing_draws[draw_id] = data
            print(f"-> Successfully processed draw #{draw_id}")
        time.sleep(0.3)

    sorted_draws = sorted(
        existing_draws.values(), key=lambda x: x["draw_number"], reverse=True
    )

    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(sorted_draws, f, indent=2)

    print(
        f"Backfill complete! Saved {len(sorted_draws)} draws to {DATA_FILE}"
    )


if __name__ == "__main__":
    backfill()
