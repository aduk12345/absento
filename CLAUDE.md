# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Memory Bank Integration

### Required Reading
**MANDATORY**: Read ALL memory bank files at the start of EVERY SINGLE PROMPT/REQUEST that relates to this project:

**NEVER SKIP THIS STEP** - Before responding to ANY project-related user request, you MUST:
1. Read `memory-bank/projectbrief.md` - Project foundation and scope
2. Read `memory-bank/productContext.md` - Product goals and user experience
3. Read `memory-bank/systemPatterns.md` - Architecture and technical patterns
4. Read `memory-bank/techContext.md` - Technologies and constraints
5. Read `memory-bank/activeContext.md` - Current work focus and decisions
6. Read `memory-bank/progress.md` - Phase tracking and task status

**This applies to:**
- Every new user prompt/question about the project
- Every request for code changes
- Every request for project information
- Every planning discussion about the project
- Every debugging session within the project
- Every project-related interaction without exception

**No exceptions**: Even for simple project questions, read Memory Bank first to understand full context.

**Not required for**: General programming questions, unrelated technical discussions, or prompts that don't involve this specific project.

### Memory Bank Maintenance
- Update memory bank files after significant changes
- Maintain phase-based progress tracking with checklists
- Document new patterns and decisions immediately
- Keep activeContext.md current with latest work focus
- Use structured formats for consistency across sessions

### Session Protocol
1. Read memory bank files first (non-negotiable)
2. Update progress.md with current phase status
3. Execute requested tasks
4. Update relevant memory bank files with new information
5. Commit changes with clear documentation

Remember: Memory resets between sessions - memory bank is the ONLY continuity mechanism.

## Operating Modes

### Default Mode: Act Mode
All interactions default to **Act Mode** unless explicitly switched to Plan Mode.

### /plan Mode
**Purpose**: Strategic discussion and preparation
**Use when**: Need to analyze, strategize, or plan before implementation

**Workflow**:
1. **FIRST**: Read all Memory Bank files for context (mandatory for every project prompt)
2. Analyze current situation and requirements
3. Develop comprehensive strategy
4. Present approach for user approval
5. Document planning decisions

**Characteristics**:
- No code execution or file modifications
- Focus on analysis and strategy
- Extensive discussion of approach
- Clear presentation of implementation plan

### /act Mode
**Purpose**: Implementation and execution
**Use when**: Ready to implement, modify code, or execute tasks

**Workflow**:
1. **FIRST**: Read ALL Memory Bank files for current context (mandatory for every project prompt)
2. Update documentation as needed
3. Execute the requested task
4. Document changes made
5. Update Memory Bank with new information

**Characteristics**:
- Direct implementation and execution
- Code modifications and file changes
- Minimal discussion, maximum action
- Real-time updates to Memory Bank

### Mode Commands
- `/plan` - Switch to Plan Mode for strategic discussion
- `/act` - Switch to Act Mode for implementation (default)
- No prefix - Defaults to Act Mode

## Project Information
- **Project Name**: eh-absence
- **Type**: Web application (PWA), aplikasi absensi karyawan
- **Primary Language**: JavaScript/TypeScript (Next.js)

## Development Commands
*(Belum ada — project belum di-scaffold. Akan diisi setelah `npx create-next-app` dijalankan.)*

## Architecture Overview
Lihat `memory-bank/systemPatterns.md` dan `memory-bank/techContext.md` untuk detail lengkap. Ringkasan:
- Next.js (frontend + API routes) sebagai satu-satunya server, tanpa backend terpisah.
- Firestore (Firebase) sebagai database, diakses **hanya** lewat API routes (Firebase Admin SDK) — tidak ada akses client langsung karena login custom (bukan Firebase Authentication).
- Cloudinary untuk penyimpanan foto (upload signed langsung dari client, URL disimpan ke Firestore lewat API route).
- Dua route utama: `/` (karyawan) dan `/admin` (admin/HR).

## Related Documentation
Detail keputusan & alasan arsitektur ada di `docs/`:
- `docs/tech-stack.md`
- `docs/features.md`
- `docs/database-schema.md`
- `docs/cloudinary-schema.md`

---
*This CLAUDE.md was initialized by /cline-init command.*
