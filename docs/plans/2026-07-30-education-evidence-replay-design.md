# Education Evidence Replay Design

## Goal

Publish Education Shell agent activity through Agent Flow without turning missing
runtime facts into a simulated swarm.

## Evidence collections

The public replay keeps three evidence collections separate:

1. `book-sdk-ko` chapter runs are the redacted `recorded-runs` already used by
   the Education Shell slide runtime. Only chapters with a recorded run are
   replayable.
2. Claude SDK subagent activity comes from a normalized Education Shell session.
   An `Agent` tool call and its linked task events may create a child node, but
   this is not presented as a native Team run.
3. DashScope Team activity comes from instrumented course evidence containing
   Team creation, teammate spawn, message routing, and completion observations.

## Public data boundary

The publisher copies only fields needed by the replay:

- source and event identifiers
- observed timestamp and evidence level
- runtime, model, tool, task, and routing metadata
- redacted prompt and result summaries already present in recorded runs

It does not publish credentials, absolute local paths, hidden reasoning, full
subagent prompts, or inter-agent message bodies. Removing those fields is a
public-distribution boundary, not a claim that they were absent from the source.

Every generated collection includes its source-relative path, SHA-256 digest,
event count, and publication timestamp. A missing or invalid source fails the
publisher; it never falls back to mock data.

## Web surface

The existing Agent Flow canvas remains the renderer. `/education/` adds:

- an evidence-collection selector
- a chapter or run selector
- source identity and observation-status labels
- deterministic playback controls from the existing simulation engine
- a compact facts panel for observations that are not canvas topology

The Education route never imports `mock-scenario.ts`. It maps observed events to
the existing `SimulationEvent` contract. Unknown events remain evidence facts
and do not create agents, tasks, or message routes.

## Deployment

The web application is built as a static export with the repository base path.
The generated output is published locally to `gh-pages`; GitHub Actions is not a
dependency. The verified public URL is then recorded in the Education Shell
public resource catalog.

