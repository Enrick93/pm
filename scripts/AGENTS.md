# Scripts

- `start.sh` / `stop.sh` (Mac, Linux), `start.ps1` / `stop.ps1` (Windows).
- Start builds the `pm-app` image from the root `Dockerfile`, replaces any running `pm-app` container, and runs it on port 8000 with `.env` (if present) and the `pm-data` volume mounted at `/app/data` for the SQLite database.
- Stop removes the container; data stays in the volume.
