# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Retrieval-Augmented Generation (RAG) API** built with FastAPI. Users upload documents, which are chunked and embedded into MongoDB. Queries are answered by retrieving semantically similar chunks and passing them as context to Azure OpenAI.

## Setup & Running

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in credentials
uvicorn app.main:app --reload
```

Required environment variables (loaded via `app/config/api_keys.py`):
- `VOYAGE_API_KEY` — Voyage AI embeddings
- `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_BASE_URL` — Azure OpenAI (deployment: `gpt-5.4`)
- `MONGODB_CONNECTION_STRING` — MongoDB Atlas

There is no test suite or linter configured yet.

## Architecture

**Request flow:**

1. **Ingest** (`POST /api/v1/ingest/`) — file uploaded → stored in GridFS → parsed by llama-index → chunked (512 tokens, 50 overlap) → embedded in batches of 128 via Voyage AI (`voyage-4-large`) → chunks + embeddings stored in `chunks` collection.

2. **Query** (`POST /api/v1/query/`) — question embedded → cosine similarity search (NumPy, manual, over all chunks) → top-k chunks assembled as context → Azure OpenAI (`gpt-4o`) generates answer → returns answer + source metadata.

**Layer responsibilities:**
- `app/api/v1/` — HTTP routing only; delegates all logic to services
- `app/services/` — business logic; direct PyMongo calls (synchronous, no ORM)
- `app/models/` — Pydantic schemas for request/response validation
- `app/db/connection.py` — MongoDB client + FastAPI lifespan context manager

**MongoDB collections** (database: `rag_db`):
- `documents` — file metadata with GridFS references; filename uniqueness enforced
- `chunks` — text chunks with embeddings; indexed on `document_id`
- `users` — user records

## Key Constraints

- Accepted file types: `.pdf`, `.txt`, `.md`, `.docx`
- `top_k` range: 1–20 (validated in `QueryRequest`)
- No authentication is implemented
- All DB operations are synchronous PyMongo (not Motor/async)
- Similarity search loads all chunks into memory — not suitable for large-scale deployments without adding a vector index (e.g., MongoDB Atlas Vector Search)

## Frontend Development

A company-level frontend skill is defined at `.claude/skills/frontend-react/`. Invoke it for any frontend work on this project.

**Stack:** Vite + React 19 + JavaScript + Tailwind CSS + Ant Design + APISauce + TanStack Query + Context API + React Router + Lucide React + Vitest + React Testing Library

**Key rules from the skill:**
- Components must stay under 300 lines. Extract repeated UI into smaller components.
- No API calls directly inside components — use `src/api/` modules and fetch data in hooks or services.
- Use TanStack Query for all server state. Use Context API only for genuinely global state (auth, RBAC, layout).
- Use Ant Design for UI primitives (tables, forms, modals, etc.); use Tailwind for layout and spacing around them.
- Use Lucide React for icons. Use APISauce with a centralized `src/api/client.js` that reads `VITE_API_BASE_URL`.
- Persist route-relevant filters, search, sorting, and pagination in URL query params.
- Always cover loading, error, empty, and success states.
- Use barrel `index.js` exports at folder boundaries. Follow one-way import direction: `app → routes → pages → components/hooks/services/api/context/config`.

**Module structure for new features:**
```
src/pages/[module]/[Module]Page.jsx     # container only
src/pages/[module]/actions.js           # page-specific workflows (submit, delete, export)
src/api/[resource].js                   # backend calls only
src/services/[resource]Service.js       # DTO mapping, domain helpers
src/hooks/use[Resource].js              # data-fetching and state
src/types/[resource]Types.js            # shape definitions
src/validations/[resource]Validation.js # validation rules
```

**After every change, respond with:** what changed, why, files touched, test/lint results, assumptions, and risks.

**Reference files** (load only when needed):
- `references/architecture.md` — import rules, module boundaries, state, forms, routing, RBAC
- `references/ui-styling.md` — Tailwind/Ant Design boundary, design tokens, responsive breakpoints, data display
- `references/testing-security.md` — Vitest setup, quality commands, security rules
- `references/templates.md` — scaffolding, migration plans, review format, feature plan template
