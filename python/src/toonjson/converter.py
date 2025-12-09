from __future__ import annotations

import csv
import json
import re
from io import StringIO
from typing import Any, Dict, List, Union

JsonLike = Union[Dict[str, Any], List[Any]]


# ==============================
# Helpers: detection & rendering
# ==============================


def _is_tabular_array(data: Any) -> bool:
    """Return True if data is a list of dicts with the same keys."""
    if not isinstance(data, list) or not data:
        return False

    first = data[0]
    if not isinstance(first, dict):
        return False

    keys = list(first.keys())
    if not keys:
        return False

    for item in data:
        if not isinstance(item, dict):
            return False
        item_keys = list(item.keys())
        if len(item_keys) != len(keys):
            return False
        if set(item_keys) != set(keys):
            return False

    return True


def _render_tabular_array(
    data: List[Dict[str, Any]],
    indent: int,
    header_label: str,
    mode: str,
) -> str:
    """Render a list of dicts as `label[n]{col1,col2}:` TOON table."""
    space = " " * indent
    keys = list(data[0].keys())

    lines: List[str] = [f"{space}{header_label}[{len(data)}]{{{','.join(keys)}}}:"]

    for row in data:
        row_fields: List[str] = []
        for key in keys:
            value = row.get(key)

            if isinstance(value, str):
                safe_val = value.replace('"', '\\"')

                if mode == "strict":
                    # Always quote strings in strict mode
                    row_fields.append(f'"{safe_val}"')
                else:
                    # Only quote when needed
                    if "," in safe_val:
                        row_fields.append(f'"{safe_val}"')
                    else:
                        row_fields.append(safe_val)
            else:
                if mode == "strict":
                    row_fields.append(json.dumps(value))
                else:
                    row_fields.append(str(value))

        lines.append(f"{space}  {','.join(row_fields)}")

    return "\n".join(lines)


def _format_primitive(value: Any, mode: str) -> str:
    """Format a primitive value for non-tabular TOON output."""
    if value is None:
        return "null"

    if isinstance(value, str):
        if mode == "strict":
            return json.dumps(value)
        return value

    if isinstance(value, bool):
        # lower-case JSON style
        return "true" if value else "false"

    if isinstance(value, (int, float)):
        return str(value)

    # Fallback for weird types
    try:
        return json.dumps(value)
    except TypeError:
        return str(value)


def _stringify(data: Any, indent: int, mode: str, allow_tabular: bool) -> str:
    """Recursive renderer used by json_to_toon."""
    space = " " * indent

    # Top-level or nested tabular arrays
    if allow_tabular and _is_tabular_array(data):
        header_label = "items"
        return _render_tabular_array(data, indent, header_label, mode)

    # Lists
    if isinstance(data, list):
        lines: List[str] = []
        for item in data:
            item_str = _stringify(item, indent + 2, mode, allow_tabular)
            item_lines = item_str.splitlines() or [""]

            # First line with a dash
            first_line = f"{space}- {item_lines[0].lstrip()}"
            lines.append(first_line)

            # Continuation lines aligned under the value
            for line in item_lines[1:]:
                lines.append(" " * (indent + 2) + line.lstrip())

        return "\n".join(lines)

    # Dicts / objects
    if isinstance(data, dict):
        lines = []
        for key, value in data.items():
            # Nested tabular arrays use their key as header label
            if allow_tabular and _is_tabular_array(value):
                lines.append(_render_tabular_array(value, indent, key, mode))
                continue

            if isinstance(value, (list, dict)):
                lines.append(f"{space}{key}:")
                lines.append(_stringify(value, indent + 2, mode, allow_tabular))
            else:
                lines.append(f"{space}{key}: {_format_primitive(value, mode)}")

        return "\n".join(lines)

    # Primitives
    return _format_primitive(data, mode)


# ===================
# Public API: JSON → TOON
# ===================


def json_to_toon(data: Union[str, JsonLike], mode: str = "auto") -> str:
    """
    Convert JSON (string) or a Python dict/list into TOON.

    Parameters
    ----------
    data:
        Either a JSON string or a Python object (dict / list).
    mode:
        - "auto"     → detect tabular arrays and render them as tables.
        - "strict"   → same as auto, but more aggressively quoted / JSON-like.
        - "jsonlike" → disables table syntax, produces a more YAML-ish layout.

    Returns
    -------
    str
        A TOON-formatted string.
    """
    if isinstance(data, str):
        obj: Any = json.loads(data)
    else:
        obj = data

    effective_mode = mode or "auto"
    allow_tabular = effective_mode != "jsonlike"

    return _stringify(obj, indent=0, mode=effective_mode, allow_tabular=allow_tabular)


# ===================
# Public API: TOON → JSON
# ===================

_HEADER_RE = re.compile(r"^(.+?)\[\d+\]\{([^}]*)\}:")

_NUMBER_RE = re.compile(r"-?\d+(?:\.\d+)?$")


def _parse_number_or_string(val: str) -> Any:
    """Convert numeric-looking strings to int/float; leave others as str."""
    if _NUMBER_RE.match(val):
        if "." in val:
            return float(val)
        return int(val)
    return val


def toon_to_json(toon_str: str) -> JsonLike:
    """
    Convert a TOON string into a Python object.

    Currently this parser focuses on the *tabular* TOON syntax:

        label[n]{col1,col2,...}:
          v11,v12,...
          v21,v22,...
          ...

    Behavior
    --------
    - When one or more labeled tables are present (e.g. `users[...]`, `roles[...]`),
      it returns a dict: `{"users": [...], "roles": [...]}`.
    - When only `items[...]` is used at top level, it returns a list.
    - Non-tabular lines are ignored (same limitation as the web demo).

    This is enough to support the JSON ⟷ TOON round-trip for the tabular
    cases you’re showcasing in the web UI.
    """
    lines = toon_str.strip().splitlines()

    current_keys: List[str] | None = None
    current_array: List[Dict[str, Any]] | None = None
    current_label: str | None = None

    root_object: Dict[str, Any] = {}
    root_array: List[Dict[str, Any]] | None = None
    has_labeled_tables = False

    for raw_line in lines:
        trimmed = raw_line.strip()
        if not trimmed:
            continue

        # Header: label[n]{id,name,role}:
        match = _HEADER_RE.match(trimmed)
        if match:
            current_label = match.group(1).strip()
            keys_str = match.group(2)

            current_keys = [k.strip() for k in keys_str.split(",") if k.strip()]
            current_array = []

            if current_label and current_label != "items":
                # Labeled tables go into an object
                root_object[current_label] = current_array
                has_labeled_tables = True
            else:
                # `items[...]` → treat as a plain array
                root_array = current_array

            continue

        # Ignore lines until we have a header
        if not current_keys or current_array is None:
            continue

        # CSV parse with support for quotes and escaping (\,")
        reader = csv.reader(
            StringIO(trimmed),
            delimiter=",",
            quotechar='"',
            escapechar="\\",
        )
        row = next(reader, [])

        obj: Dict[str, Any] = {}

        for key, raw_val in zip(current_keys, row):
            val = raw_val.strip()

            if val == "":
                obj[key] = ""
            elif val == "true":
                obj[key] = True
            elif val == "false":
                obj[key] = False
            elif val == "null":
                obj[key] = None
            else:
                obj[key] = _parse_number_or_string(val)

        current_array.append(obj)

    if has_labeled_tables:
        return root_object

    if root_array is not None and root_array:
        return root_array

    # Nothing recognized as table
    return []
