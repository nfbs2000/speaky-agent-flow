# Education Evidence Replay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a public Agent Flow replay for real Book SDK chapter, Claude SDK subagent, and DashScope Team evidence.

**Architecture:** A local publisher reads explicit Education Shell artifacts and emits a small, whitelisted static evidence catalog. A dedicated Next route converts that catalog to the existing Agent Flow simulation contract without importing demo data. Static output is published from a local build to GitHub Pages.

**Tech Stack:** Node.js, TypeScript, Next.js static export, React, existing Agent Flow canvas.

---

### Task 1: Build the evidence publisher

**Files:**
- Create: `scripts/publish-education-evidence.mjs`
- Create: `web/lib/education-evidence-types.ts`
- Modify: `package.json`

1. Read the latest `book-sdk-ko` recorded run for each available chapter.
2. Read the explicit Claude SDK normalized session and DashScope Team evidence.
3. Whitelist public fields, redact non-portable paths, calculate source digests,
   and write `web/public/education-evidence/catalog.json`.
4. Exit non-zero for missing or invalid required sources.

### Task 2: Map evidence to Agent Flow events

**Files:**
- Create: `web/lib/education-evidence-adapter.ts`

1. Map prompt, assistant, tool, and result evidence to main-agent events.
2. Create child agents only from linked Claude `Agent`/task evidence.
3. Map observed Team creation, teammate lifecycle, and routing facts.
4. Preserve unmapped facts for the evidence panel.

### Task 3: Add the public replay route

**Files:**
- Create: `web/app/education/page.tsx`
- Create: `web/components/education-replay/*`
- Modify: `web/hooks/use-agent-simulation.ts`
- Modify: `web/components/agent-visualizer/index.tsx`
- Modify: `web/app/globals.css`

1. Add an explicit event-source input to the existing simulation hook.
2. Reuse the existing canvas, panels, and playback controls.
3. Add collection/run selection and truth-status presentation.
4. Keep demo and live bridge behavior unchanged outside `/education/`.

### Task 4: Build and publish locally

**Files:**
- Modify: `web/next.config.js`
- Modify: `package.json`

1. Generate the evidence catalog.
2. Run TypeScript checks and the production static build.
3. Serve the export locally and verify collection switching, replay, and empty
   evidence behavior in a browser.
4. Publish the exact export to `gh-pages` and verify the public URL.

### Task 5: Link the Education Shell

**Files:**
- Modify: `docs/book-sdk-ko/public-resources.json` in the Education repository.

1. Add the verified Agent Flow public resource and deployment receipt.
2. Validate JSON and confirm the Education repository stages only this file.
3. Commit and push each repository independently.

