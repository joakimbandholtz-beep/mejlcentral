# Mejlcentralen

Public-submission-ready MCP server + ChatGPT UI for a clickable email task workflow.

## What it does
The `show_mail_center` tool accepts structured email tasks and renders a component with five actions:
- Svara
- Klar
- Vänta
- Bevaka
- Påminn

The server itself does **not** connect to Gmail, Outlook, Todoist, or other external accounts. UI actions are returned to ChatGPT as model-visible follow-up messages so the host can use tools the user has already authorized.

## Local test
```bash
npm install
npm start
```
Open `http://localhost:8787/health` and connect MCP Inspector to `http://localhost:8787/mcp`.

## Production URLs
- `/` website
- `/mcp` MCP endpoint
- `/privacy` privacy policy
- `/terms` terms
- `/support` support
- `/health` health check
- `/.well-known/openai-apps-challenge` OpenAI domain verification token (from env var `OPENAI_APPS_CHALLENGE`)

See `SUBMISSION.md` for directory listing text, starter prompts, test cases and release notes.
