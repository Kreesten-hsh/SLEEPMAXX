# Sleepmaxx Constitution

## Core Principles

### I. Source of Truth Supremacy
`docs/PRD.md` is the durable, authoritative source of truth. All implementation, architectural, and design choices must adhere strictly to the product definition, scoring logic, archetypes, and constraints recorded in `docs/PRD.md`. Any conflict between new requests and the PRD must be explicitly surfaced and resolved before writing code.

### II. Pure, Zero-Dependency Scoring Engine
The core scoring logic must remain pure, deterministic, synchronous, and 100% testable without DOM, network, or third-party runtime dependencies. Mathematical correctness and input sanitization (safeguarding against negative, NaN, and non-finite values) are non-negotiable.

### III. Test-Driven & Regression Gates
All scoring engine changes and critical path features must be backed by comprehensive automated tests with zero failing tests. Vitest tests (`npm test`) and TypeScript strict compilation (`npm run build`) must succeed before any commit or delivery.

### IV. Zero-Budget & Local-First Architecture
The product must operate with zero per-user backend/API costs in V1. Calculations and state persistence must happen client-side (`localStorage`). No AI in the critical path, no mandatory accounts, no heavyweight backend services unless explicitly approved.

### V. Non-Clinical Wellness Positioning
Sleepmaxx is strictly a gamified wellness routine application. All user-facing copy must comply with health/safety boundaries: no medical diagnosis, no hormone/cortisol/melatonin measurement claims, no disease prevention claims, and no clinical dashboard aesthetics.

## Technology Standards & Governance
* **Stack**: React 19, TypeScript, Vite, Native CSS, `vite-plugin-pwa`, Vitest.
* **Paradigm**: Functional, strict typing (zero `any`), early returns, immutable state updates.
* **Specification Framework**: GitHub Spec Kit workflow (`constitution` → `specify` → `plan` → `tasks` → `implement` → `converge`).
* **Code Intelligence**: Graphify for structural code graph indexing and semantic querying without API overhead.

**Version**: 1.0.0 | **Ratified**: 2026-09-17 | **Last Amended**: 2026-09-17
