// Tiny output helper so every read command can speak both to humans and to an
// agent. `--json` makes coded a queryable state store: a session can parse the
// state directly instead of scraping human text.

let jsonMode = false;

export function setJsonMode(on: boolean): void {
  jsonMode = Boolean(on);
}

export function isJsonMode(): boolean {
  return jsonMode;
}

// Print a payload as pretty JSON (when --json) or run the human-text renderer.
export function emit(payload: unknown, renderHuman: () => void): void {
  if (jsonMode) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    renderHuman();
  }
}
