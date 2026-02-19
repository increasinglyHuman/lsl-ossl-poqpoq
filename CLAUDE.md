# poqpoq Script Engine

## Project Overview

A modular scripting engine for poqpoq World that brings TypeScript-based scripting to the open metaverse, with backward compatibility for LSL/OSSL scripts from Second Life and OpenSimulator.

**Architecture Decision Record:** See `docs/adr/ADR-001-language-and-runtime-architecture.md`

## Repository Structure

```
src/
  types/          Core type definitions (WorldScript, Vector3, Agent, etc.)
  api/            World API interfaces and implementations
  runtime/        Script sandbox (Web Worker + SES + AST transform)
  transpiler/     LSL → TypeScript transpiler
  editor/         Monaco-based script editor
tests/            Test suites (Vitest)
examples/         Example scripts (TypeScript + LSL originals)
docs/
  adr/            Architecture Decision Records
```

## Tech Stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite
- **Test:** Vitest
- **Editor:** Monaco Editor
- **Sandbox:** SES (Secure ECMAScript) + Web Workers
- **3D Engine:** Babylon.js (integration layer)
- **Package Manager:** npm

## Development Conventions

### Code Style
- TypeScript strict mode (`strict: true` in tsconfig)
- ESM modules (`"type": "module"` in package.json)
- Prefer interfaces over type aliases for public API surfaces
- Use `readonly` for immutable properties
- Barrel exports from each module directory (`index.ts`)

### Naming
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Interfaces: `PascalCase` (no `I` prefix)
- Functions/methods: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- World API methods: `camelCase` matching LSL conventions where possible

### Testing
- Test files: `*.test.ts` colocated with source
- Use Vitest `describe`/`it` blocks
- Every World API function needs a corresponding test
- Transpiler tests use snapshot testing against known LSL inputs

### LSL Function Mapping Convention
When mapping LSL functions to the World API:
- `llSay(channel, msg)` → `world.say(channel, msg)` (drop `ll` prefix, camelCase)
- `llSetPos(vec)` → `this.object.setPosition(vec)` (object methods on `this.object`)
- `llGetOwner()` → `this.owner.id` (properties where appropriate)
- `osNpcCreate(...)` → `world.npc.create(...)` (structured namespaces)

### Git Workflow
- Branch naming: `phase-N/feature-name` (e.g., `phase-1/core-types`)
- Commits: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- PRs required for main branch

### Related Projects
- **poqpoq World:** `/home/p0qp0q/blackbox/World/` — The 3D engine this scripting system targets
- **Legacy OAR Converter:** `/home/p0qp0q/blackbox/Legacy/` — Converts OpenSim archives to GLB + script sidecars
- **OpenSim Source:** `/home/p0qp0q/opensim/` — Reference OpenSimulator installation (source only, not built)

## Quick Start

```bash
npm install
npm run dev          # Start development server
npm test             # Run tests
npm run build        # Production build
```

## Port Assignments

No server ports currently assigned. Editor runs client-side only.
Future API server (if needed): TBD (coordinate with World's port assignments).
