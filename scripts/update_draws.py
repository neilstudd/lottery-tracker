import json
import os
import urllib.request
import xml.etree.ElementTree as ET

DATA_FILE = os.path.join(
    os.path.dirname(__file__), "..", "data", "draws.json"
)


def fetch_latest_draw():
    url = "https://www.national-lottery.co.uk/results/lotto/draw-history/xml"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})

    with urllib.request.urlopen(req) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    latest_draw = root.find(".//draw")

    if latest_draw is None:
        print("No draw element found in XML.")
        return None

    draw_number = int(latest_draw.find("draw-number").text.strip())
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

    d1 = (
        parsed_draws[0] if len(parsed_draws) > 0 else [0, 0, 0, 0, 0, 0, 0]
    )
    d2 = (
        parsed_draws[1] if len(parsed_draws) > 1 else [0, 0, 0, 0, 0, 0, 0]
    )

    return {
        "draw_number": draw_number,
        "draw_date": draw_date,
        "draw1": {"numbers": d1[:6], "bonus": d1[6]},
        "draw2": {"numbers": d2[:6], "bonus": d2[6]},
    }


def update_json_file():
    draw_data = fetch_latest_draw()
    if not draw_data:
        return

    existing_draws = {}
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            try:
                draws_list = json.load(f)
                existing_draws = {d["draw_number"]: d for d in draws_list}
            except json.JSONDecodeError:
                existing_draws = {}

    existing_draws[draw_data["draw_number"]] = draw_data

    sorted_draws = sorted(
        existing_draws.values(), key=lambda x: x["draw_number"], reverse=True
    )

    os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
    with open(DATA_FILE, "w") as f:
        json.dump(sorted_draws, f, indent=2)

    print(f"Successfully updated draws.json with draw #{draw_data['draw_number']}")


if __name__ == "__main__":
    update_json_file()