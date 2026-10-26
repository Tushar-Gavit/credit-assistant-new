# Credit Assistant

#Documentation Link(Drive):
https://drive.google.com/drive/folders/1C3PA0eFRSN5QUftCZSlVSzrSvJeEcc2r?usp=sharing

## Run
1. PostgreSQL: `createdb credit_assistant`
2. Backend
   ```
   cd backend && python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env   # set DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
   uvicorn app.main:app --reload
   ```
   API docs: http://localhost:8000/docs
3. Frontend
   ```
   cd frontend && cp .env.example .env && npm install && npm run dev
   ```
   Open http://localhost:5173

## API
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/register, /api/auth/login | JWT auth |
| GET | /api/auth/me | Current user |
| POST | /api/metrics | Save entry; computes DTI, CUR, band, score delta |
| GET | /api/metrics, /api/metrics/latest | History / latest |
| POST | /api/advisory | Generate AI advisory from latest entry |
| GET | /api/advisory/latest | Last saved advisory |
