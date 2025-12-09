## JSON ⟷ TOON Converter

This project is a small web app that lets you convert between JSON and [TOON](https://github.com/toon-format/toon) directly in the browser. It is meant as a playground to see how much token savings you can get when you switch from verbose JSON to a token oriented format that is more friendly for LLM prompts.

You paste JSON on the left, get TOON on the right, or do the reverse with a single click. The app also shows live estimates of characters, approximate tokens and line counts for both sides, so you can immediately see the impact.

### Features

- JSON to TOON and TOON to JSON conversion
- Automatic detection of tabular arrays and rendering as `label[n]{columns}:` syntax
- Three conversion modes
  - Auto tabular (recommended)
  - Strict TOON (more quoting and explicit values)
  - JSON like (no table header syntax)
- Approximate token and character statistics for JSON and TOON
- Token savings badge that highlights how much you save compared to JSON
- Built in rotating examples for both JSON and TOON to quickly test the format in different scenarios

The app is fully client side, uses no backend and does not send your data anywhere. You can host it on any static site provider.
