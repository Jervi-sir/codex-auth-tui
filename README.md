# codex-chat

Use your **ChatGPT Pro/Plus subscription** to chat with Codex models — zero API fees.

## Requirements

- [Bun](https://bun.sh) installed
- A ChatGPT Pro or Plus subscription

## Setup

```bash
cd codex-chat
bun install
```

## Usage

### Terminal (Ink TUI)

```bash
# Start chat (auto-opens browser for login on first run)
bun run tui

# Start chat in watch mode and reload on file changes
bun run tui:dev

# Force re-login (browser)
bun run login

# Login without a browser (headless/SSH)
bun run login:headless

# Logout / clear session
bun run logout
```

**TUI commands (inside chat):**
| Command | Action |
|---------|--------|
| `/exit` | Quit |
| `/clear` | Start a new conversation |
| `/model` | Switch model |
| `/logout` | Clear session |
| `Shift+Enter` | Newline |

`bun run tui:dev` uses Bun watch mode, so changes under `src/` restart the TUI automatically.

### Web UI

```bash
bun run web
# → http://localhost:3000
```

- Full streaming chat in the browser
- Model switcher in the header
- Minimal markdown rendering (code blocks, inline code)
- Session is shared with the Ink TUI (same `~/.codex-chat/tokens.json`)

## Authentication flow

1. **Browser (default):** Opens `https://auth.openai.com/oauth/authorize` with PKCE.
   A temporary server on port 1455 catches the callback and exchanges the code for tokens.

2. **Headless/device flow:** Displays a short code — you visit the URL on any device,
   enter the code, and the CLI polls until it's approved.

Tokens are saved to `~/.codex-chat/tokens.json` and refreshed automatically.

## Models

| ID | Notes |
|----|-------|
| `gpt-5.3-codex` | Default, best for coding |
| `gpt-5.1-codex` | Previous gen |
| `gpt-5.1-codex-mini` | Faster |
| `gpt-5.4` | General purpose |

## Project structure

```
src/
  auth.ts    OAuth PKCE + device flow, token persistence
  api.ts     Streaming API client → chatgpt.com/backend-api/codex
  tui.tsx    Ink terminal chat interface
  server.ts  Bun HTTP server + inlined React web UI
```

## Caveats

- Uses ChatGPT's **internal** `backend-api` — not the public API. OpenAI can change it.
- Relies on the same OAuth client ID as the opencode project.
- May violate ChatGPT ToS if used heavily outside of its intended context.
- This is a personal/experimental tool, not production software.
