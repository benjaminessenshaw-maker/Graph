# Assistant Instructions / Custom Rules

When working in this repository, you must adhere to the following workflow:

1. **Task Tracking (`tasks.md`)**
   - At the beginning of a session or task, review `tasks.md` in the root directory to understand current goals.
   - Update `tasks.md` as you complete subtasks or when the user introduces new requirements.

2. **Action Logging (`changelog.md`)**
   - As you proceed with work, or before ending a session, regularly log a summary of your latest technical actions to `changelog.md`.
   - Keep the log concise but descriptive enough for context recovery in future sessions.
   - Do NOT overwrite the entire file; always PREPEND or APPEND new logs to the document chronologically.

3. **General Behavior**
   - Maintain the dual-view nature of this project (Database Admin vs Prompting Views).
   - Backend logic resides in `backend/` as a FastAPI application running on port 8000.
   - Frontend logic resides in `frontend/` as a Vite React application.
