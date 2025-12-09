# toonjson (Python)

`toonjson` is a small Python library to convert between [JSON](https://www.json.org/json-en.html) and [TOON](https://github.com/toon-format/toon).  
It is the backend companion of the JSON ⟷ TOON web playground and follows the same conversion rules and modes.

Use it to:

- Generate TOON from Python data structures before sending prompts to an LLM.
- Parse TOON tabular output (e.g. `users[3]{id,name}: ...`) back into Python lists/dicts.
- Work directly with JSON / TOON files from disk.
- Experiment locally with the same behaviour as the web demo.

---

## Installation

From PyPI:

```bash
pip install toonjson
```

From a local checkout of this repo:

```bash
cd python
pip install .
```

## Quick start

```python
from toonjson import json_to_toon, toon_to_json

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

# JSON/dict → TOON
toon = json_to_toon(data, mode="auto")
print(toon)
# users[2]{id,name}:
#   1,Alice
#   2,Bob
# roles[2]{role_id,role}:
#   1,manager
#   2,user

# TOON → JSON/dict
back = toon_to_json(toon)
print(back)
# {
#   "users": [...],
#   "roles": [...]
# }
```

You can also pass JSON strings directly:

```python
json_str = """
[
  { "id": 1, "name": "Alice", "role": "admin" },
  { "id": 2, "name": "Bob", "role": "user" }
]
"""

toon = json_to_toon(json_str)
items = toon_to_json(toon)  # returns a Python list
```

## File helpers

If you work with files a lot, you can skip the manual open() / read() boilerplate and use:

```python
from toonjson import json_file_to_toon, toon_file_to_json

# JSON file → TOON string
toon_text = json_file_to_toon("data/example.json", mode="auto")

# TOON file → Python object (list or dict)
obj = toon_file_to_json("data/example.toon")
```

These are thin wrappers around json_to_toon and toon_to_json, using UTF-8 by default.

## Conversion modes

json_to_toon supports three modes that match the web UI:

```python
json_to_toon(data, mode="auto")
json_to_toon(data, mode="strict")
json_to_toon(data, mode="jsonlike")
```

**auto** (default)

Detects tabular arrays (list[dict] with consistent keys).

Strings with commas are quoted, others are left bare.

**strict**

Same layout as auto, but more JSON-like: values are quoted more aggressively.

Good when you want to be extra explicit or debug model behaviour.

**jsonlike**

Disables the table header syntax.

Arrays are rendered as dash lists, closer to YAML/pretty JSON.

Useful when you want readability but not the TOON table sugar.

## What toon_to_json supports

The current parser focuses on the tabular TOON syntax, the same subset used in the web demo:

    users[2]{id,name}:
        1,Alice
        2,Bob
    roles[2]{role_id,role}:
        1,manager
        2,user

Behaviour:

- When one or more labeled tables are present (users[...], roles[...]), it returns a dict like:

```python
{
"users": [...],
"roles": [...]
}
```

- When only items[...] is used at top level, it returns a plain list:

```text
  items[3]{id,name,role}:
    1,Alice,admin
    2,Bob,user
    3,Carol,user
```

→ toon_to_json(...) → [{...}, {...}, {...}]

- Non-tabular / YAML-like parts are currently ignored by the parser.
  The goal is to make the tabular round-trip reliable first.

## CLI example (optional pattern)

You can easily wrap the API into a small CLI, for example:

```python
# cli.py
import argparse
import json
from pathlib import Path

from toonjson import json_to_toon, toon_to_json

parser = argparse.ArgumentParser()
parser.add_argument("input", help="Input file (JSON or TOON)")
parser.add_argument("--reverse", action="store_true", help="TOON → JSON")
parser.add_argument("--mode", default="auto", choices=["auto", "strict", "jsonlike"])
args = parser.parse_args()

text = Path(args.input).read_text(encoding="utf-8")

if args.reverse:
    obj = toon_to_json(text)
    print(json.dumps(obj, indent=2, ensure_ascii=False))
else:
    toon = json_to_toon(text, mode=args.mode)
    print(toon)
```

## Support

If this library saves you some tokens or time and you want to say thanks:

👉 https://www.buymeacoffee.com/santirbb
[Buy me a beer](https://www.buymeacoffee.com/santirbb)
