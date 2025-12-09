import json

from toonjson import (
    json_to_toon,
    toon_to_json,
    json_file_to_toon,
    toon_file_to_json,
)


def test_roundtrip_top_level_array():
    data = [
        {"id": 1, "name": "Alice", "role": "admin"},
        {"id": 2, "name": "Bob", "role": "user"},
        {"id": 3, "name": "Carol", "role": "user"},
    ]

    toon = json_to_toon(data)
    # Basic shape check
    assert "items[3]{id,name,role}:" in toon

    back = toon_to_json(toon)
    assert back == data


def test_roundtrip_labeled_tables():
    data = {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"},
        ],
        "roles": [
            {"role_id": 1, "role": "manager"},
            {"role_id": 2, "role": "user"},
        ],
    }

    toon = json_to_toon(data)

    assert "users[2]{id,name}:" in toon
    assert "roles[2]{role_id,role}:" in toon

    back = toon_to_json(toon)
    assert back == data


def test_strings_with_commas_and_quotes():
    data = {
        "products": [
            {"id": 1, "name": "Basic T-Shirt", "price": 9.99},
            {"id": 2, "name": "Premium Hoodie, Blue", "price": 39.5},
            {"id": 3, "name": 'Mug "Best Dev"', "price": 12},
        ]
    }

    toon = json_to_toon(data)

    # The value with a comma must be quoted somewhere in the output
    assert '"Premium Hoodie, Blue"' in toon

    back = toon_to_json(toon)
    assert back == data


def test_modes_do_not_crash():
    data = {
        "config": {
            "name": "My LLM App",
            "max_tokens": 2048,
            "temperature": 0.2,
            "enabled": True,
        },
        "logs": [
            {"id": 1, "status": "ok"},
            {"id": 2, "status": "error"},
        ],
    }

    # We only guarantee full round-trip for tabular parts,
    # but all modes must at least produce a valid string.
    for mode in ("auto", "strict", "jsonlike"):
        toon = json_to_toon(data, mode=mode)
        assert isinstance(toon, str)
        assert len(toon) > 0

        # For auto + strict, `logs` should still be parsed back
        if mode in ("auto", "strict"):
            back = toon_to_json(toon)
            assert "logs" in back
            assert back["logs"] == data["logs"]


def test_file_helpers(tmp_path):
    data = {
        "users": [
            {"id": 1, "name": "Alice"},
            {"id": 2, "name": "Bob"},
        ]
    }

    # JSON file → TOON string
    json_path = tmp_path / "data.json"
    json_path.write_text(json.dumps(data), encoding="utf-8")

    toon = json_file_to_toon(json_path)
    assert "users[2]{id,name}:" in toon

    # TOON file → Python object
    toon_path = tmp_path / "data.toon"
    toon_path.write_text(toon, encoding="utf-8")

    back = toon_file_to_json(toon_path)
    assert back == data
