# SolopreneurWriter — PRD

## Original Problem Statement
Build a personal article workspace for a solopreneur who writes on Medium. Features: Ideas dashboard, article workspace with split panels, Gemini prompt drawer, tags/filtering, screenshot upload via Emergent Object Storage, auto-save, JWT auth.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind + Shadcn UI
- **Auth**: JWT httpOnly cookies (bcrypt, PyJWT)
- **Storage**: Emergent Object Storage for screenshots
- **Database**: MongoDB (users, articles, prompts, login_attempts)

## User Personas
- Solopreneur/content creator who writes on Medium
- Uses Gemini AI gems externally (copy-paste workflow)
- Needs a personal, distraction-free writing environment

## Core Requirements
- Ideas dashboard with card grid, status badges, tags, filtering
- Split-panel article workspace (scratchpad + Medium-style editor)
- Auto-save every 30 seconds
- Gemini prompt drawer with 2 editable templates
- Screenshot upload with drag-drop
- Tag and status filtering on dashboard
- JWT authentication (login/register)

## What's Been Implemented (April 18, 2026)
- [x] Full JWT auth (register, login, logout, refresh, brute force protection)
- [x] Admin seeding with default credentials
- [x] Articles CRUD (create, list, get, update, delete)
- [x] Prompts CRUD with 2 seeded default templates
- [x] File upload/download via Emergent Object Storage
- [x] Ideas dashboard with card grid, search, status/tag filters
- [x] Article workspace with split panels (scratchpad + editor)
- [x] Prompt drawer (Sheet component, copy-to-clipboard, edit/save)
- [x] Screenshot uploader (drag-drop, thumbnails)
- [x] Auto-save every 30 seconds
- [x] Word count in editor
- [x] Reference links (up to 5, with labels)
- [x] Tags input (comma-separated, pill display)
- [x] Status dropdown (idea/draft/ready/published)
- [x] Warm beige design (Manrope + Lora fonts, Claude/Hemingway aesthetic)
- [x] Testing: 14/14 backend, 20/20 frontend (100% pass rate)

## Prioritized Backlog
### P0 (Critical) — All complete
### P1 (High)
- [ ] Article delete from dashboard (context menu or card action)
- [ ] Search within article content (not just titles)
### P2 (Medium)
- [ ] Dark mode toggle
- [ ] Export article as Markdown
- [ ] Keyboard shortcuts (Cmd+S to save, Cmd+K for links)
- [ ] Article sorting options (by date, title, status)
- [ ] Bulk tag management
### P3 (Nice to Have)
- [ ] Markdown support in editor
- [ ] Reading time estimate
- [ ] Version history / draft snapshots
- [ ] Password reset flow (backend ready, frontend not implemented)

## Next Tasks
1. Add article delete action from dashboard cards
2. Implement article search within content
3. Add export-to-markdown feature
4. Consider keyboard shortcuts for power users
