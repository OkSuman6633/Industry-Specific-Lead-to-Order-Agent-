# Google ADK agent structure

The ADK-discoverable package is `app/agents` and exports `root_agent` from `__init__.py`.

- `agent.py`: orchestrator and allow-listed specialist sub-agents.
- `sub_agents/lead_intake/agent.py`: bounded intake triage.
- `sub_agents/qualification/agent.py`: structured requirement extraction.
- `shared_libraries/prompts.py`: shared qualification policy prompt.

Run ADK's developer UI from `backend` after installing dependencies and configuring `GOOGLE_API_KEY` (the FastAPI integration reads `GEMINI_API_KEY` and maps it to `GOOGLE_API_KEY` at runtime):

```powershell
$env:GOOGLE_API_KEY="YOUR_GEMINI_KEY"
adk web
```

The application API uses the qualification sub-agent directly through an ADK Runner. The ADK web UI is optional for agent inspection and prompt iteration; it is not required to run the React application.
