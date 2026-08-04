#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const educationRoot = path.resolve(
  process.env.EDUCATION_ROOT || path.join(root, '..', 'vibe-with-claude-code-education'),
)
const bookEvidenceRoot = path.resolve(process.env.BOOK_SDK_EVIDENCE_ROOT || educationRoot)
const outputPath = path.join(root, 'web', 'public', 'education-evidence', 'catalog.json')
const recordedRoot = path.join(
  bookEvidenceRoot,
  'slide',
  '.shared-course-visual',
  'otel-course-runtime',
  'recorded-runs',
  'book-sdk-ko',
)
const claudeSessionPath = path.join(
  educationRoot,
  'observability',
  'data',
  'session-1780215073620',
  'normalized-events.json',
)
const teamEvidencePath = path.join(
  educationRoot,
  'observability',
  'course-evidence',
  '643a07f5-e18a-4e84-98a0-3d4433252403.jsonl',
)

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

async function readText(file) {
  return fs.readFile(file, 'utf8')
}

async function readJson(file) {
  return JSON.parse(await readText(file))
}

function digest(text) {
  return createHash('sha256').update(text).digest('hex')
}

function relativeSource(file) {
  for (const candidate of [educationRoot, bookEvidenceRoot]) {
    const relative = path.relative(candidate, file)
    if (relative && !relative.startsWith(`..${path.sep}`) && relative !== '..') {
      return relative.split(path.sep).join('/')
    }
  }
  throw new Error(`Evidence source is outside declared roots: ${file}`)
}

function sanitizeText(value, maxLength = 1200) {
  if (typeof value !== 'string') return ''
  return value
    .replaceAll(educationRoot, '<education-repo>')
    .replace(/\/Users\/[^/\s]+\/Documents\//g, '<workspace>/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function sourceRefs(value) {
  if (!Array.isArray(value)) return []
  return value.filter((item) => typeof item === 'string').slice(0, 12)
}

function observedModel(events) {
  const init = events.find((event) => event.eventType === 'sdk.init')
  return typeof init?.attributes?.model === 'string'
    ? init.attributes.model
    : init?.summary?.match(/model=([^\s]+)/)?.[1]
}

function monotonicPlaybackOffset(events, minimumGapMs = 220) {
  let cursor = 0
  return events.map((event, sequence) => {
    const observed = Number.isFinite(event.observedOffsetMs) ? event.observedOffsetMs : undefined
    cursor = Math.max(cursor + minimumGapMs, observed ?? 0)
    return {
      ...event,
      sequence,
      playbackOffsetMs: cursor,
    }
  })
}

function compactChapterEvent(event) {
  const attributes = event?.attributes && typeof event.attributes === 'object' ? event.attributes : {}
  return {
    id: String(event.id),
    observedOffsetMs: Number.isFinite(event.timestampOffsetMs) ? event.timestampOffsetMs : undefined,
    eventType: String(event.eventType),
    actor: String(event.actor),
    evidenceLevel: String(event.evidenceLevel),
    summary: sanitizeText(event.summary),
    sourceRefs: sourceRefs(event.sourceRefs),
    toolName: typeof attributes.toolName === 'string' ? attributes.toolName : undefined,
    toolUseId: typeof attributes.toolUseId === 'string' ? attributes.toolUseId : undefined,
    attemptId: typeof attributes.attemptId === 'string' ? attributes.attemptId : undefined,
    caseId: typeof attributes.caseId === 'string' ? attributes.caseId : undefined,
    annotationMode: typeof attributes.annotationMode === 'string' ? attributes.annotationMode : undefined,
    outcome: typeof attributes.outcome === 'string' ? attributes.outcome : undefined,
    phase: typeof attributes.phase === 'string' ? attributes.phase : undefined,
    marker: typeof attributes.marker === 'string' ? attributes.marker : undefined,
    sha256: typeof attributes.sha256 === 'string' ? attributes.sha256 : undefined,
    characters: Number.isInteger(attributes.characters) ? attributes.characters : undefined,
    containsU202E: typeof attributes.containsU202E === 'boolean'
      ? attributes.containsU202E
      : undefined,
    originalModel: typeof attributes.originalModel === 'string'
      ? attributes.originalModel
      : undefined,
    fallbackModel: typeof attributes.fallbackModel === 'string'
      ? attributes.fallbackModel
      : undefined,
    targetExists: typeof attributes.targetExists === 'boolean' ? attributes.targetExists : undefined,
    warningCategory: typeof attributes.category === 'string' ? attributes.category : undefined,
    decisionReasonType: typeof attributes.decisionReasonType === 'string'
      ? attributes.decisionReasonType
      : undefined,
    isError: typeof attributes.isError === 'boolean' ? attributes.isError : undefined,
    terminalReason: typeof attributes.terminalReason === 'string' ? attributes.terminalReason : undefined,
    claimId: typeof attributes.claimId === 'string' ? attributes.claimId : undefined,
    claimStatus: typeof attributes.status === 'string' ? attributes.status : undefined,
  }
}

function compactChapterClaim(event) {
  const compact = compactChapterEvent(event)
  return {
    id: compact.claimId || compact.id,
    status: compact.claimStatus || 'unknown',
    evidenceLevel: compact.evidenceLevel,
    summary: compact.summary,
    sourceRefs: compact.sourceRefs,
  }
}

async function optionalJson(file) {
  return fs.stat(file)
    .then((stat) => stat.isFile() ? readJson(file) : null)
    .catch(() => null)
}

async function latestTraceFiles(chapterDir) {
  const entries = await fs.readdir(chapterDir, { withFileTypes: true })
  const runDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  invariant(runDirs.length > 0, `No recorded runs found in ${chapterDir}`)
  const runDir = path.join(chapterDir, runDirs.at(-1))
  return {
    tracePath: path.join(runDir, 'trace.json'),
    manifestPath: path.join(runDir, 'manifest.json'),
  }
}

async function buildChapterRuns() {
  const entries = await fs.readdir(recordedRoot, { withFileTypes: true })
  const chapterDirs = entries
    .filter((entry) => entry.isDirectory() && /^ch\d+[a-z]*$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort()

  const runs = []
  for (const chapterSlug of chapterDirs) {
    const { tracePath, manifestPath } = await latestTraceFiles(path.join(recordedRoot, chapterSlug))
    const traceText = await readText(tracePath)
    const trace = JSON.parse(traceText)
    const manifest = await readJson(manifestPath)
    invariant(Array.isArray(trace.events), `${relativeSource(tracePath)} is missing events[]`)
    invariant(manifest.kind === 'book-try-chat-recorded-run', `${relativeSource(manifestPath)} has an unexpected kind`)

    const sourceArtifactDir = typeof manifest.sourceArtifactPath === 'string'
      ? path.join(bookEvidenceRoot, manifest.sourceArtifactPath)
      : null
    const sourceArtifactAvailable = sourceArtifactDir
      ? await fs.stat(sourceArtifactDir).then((stat) => stat.isDirectory()).catch(() => false)
      : false
    const sourceSummary = sourceArtifactDir
      ? await optionalJson(path.join(sourceArtifactDir, 'run-summary.json'))
      : null
    const status = manifest.sourceVerification === 'verified-source-artifact'
      ? 'verified_source'
      : sourceArtifactAvailable
        ? 'recorded_projection'
        : 'source_missing'
    const verification = manifest.sourceVerification === 'verified-source-artifact'
      ? manifest.sourceVerification
      : sourceArtifactAvailable
        ? 'legacy-recorded-run; source artifacts present'
        : 'legacy-recorded-run; source artifact unavailable'

    const events = monotonicPlaybackOffset(trace.events.map(compactChapterEvent))
    const claims = trace.events
      .filter((event) => event.eventType === 'assistant.claim')
      .map(compactChapterClaim)
    const eventCounts = new Map()
    for (const event of events) {
      eventCounts.set(event.eventType, (eventCounts.get(event.eventType) ?? 0) + 1)
    }

    const sourceEventCount = Number.isFinite(sourceSummary?.source_event_count)
      ? sourceSummary.source_event_count
      : trace.events.length
    const actualModels = Array.isArray(sourceSummary?.actual_models)
      ? sourceSummary.actual_models.filter((model) => typeof model === 'string')
      : []
    const replayModels = Array.isArray(sourceSummary?.source_attempts)
      ? [...new Set(sourceSummary.source_attempts
        .filter((attempt) => attempt?.projection_role === 'replayed')
        .map((attempt) => attempt?.actual_model)
        .filter((model) => typeof model === 'string'))]
      : []
    const observedClaims = claims.filter((claim) => claim.status === 'observed').length
    const configuredClaims = claims.filter((claim) => claim.status === 'configured').length
    const inferredClaims = claims.filter((claim) => claim.status === 'inferred').length
    const notObservedClaims = claims.filter((claim) => claim.status === 'not_observed').length
    const pendingClaims = claims.filter((claim) => claim.status === 'additional_observation_required').length
    const invalidAttemptCount = Array.isArray(sourceSummary?.invalid_attempts)
      ? sourceSummary.invalid_attempts.length
      : 0

    runs.push({
      id: chapterSlug,
      title: trace.title || manifest.attempt?.chapterTitle || chapterSlug,
      description: `Education Shell recorded run ${manifest.sourceRunId}`,
      status,
      runtime: 'claude-agent-sdk',
      provider: 'claude',
      model: replayModels[0] || actualModels[0] || observedModel(trace.events),
      replayModels,
      citedModels: actualModels,
      chapterSlug,
      sourceEventCount,
      publishedEventCount: events.length,
      source: {
        path: relativeSource(tracePath),
        sha256: digest(traceText),
        verification,
        recordedAt: trace.recordedRun?.recordedAt || manifest.createdAt,
      },
      events,
      facts: [
        { label: 'raw source events', value: String(sourceEventCount) },
        { label: 'public projection', value: String(events.length) },
        { label: 'tool uses', value: String(eventCounts.get('tool.use') ?? 0) },
        { label: 'tool results', value: String(eventCounts.get('tool.result') ?? 0) },
        { label: 'observed claims', value: String(observedClaims) },
        ...(configuredClaims || inferredClaims || notObservedClaims
          ? [
              { label: 'configured claims', value: String(configuredClaims) },
              { label: 'inferred claims', value: String(inferredClaims) },
              { label: 'not observed', value: String(notObservedClaims) },
            ]
          : []),
        { label: 'needs observation', value: String(pendingClaims) },
        { label: 'invalid attempts', value: String(invalidAttemptCount) },
        { label: 'proof gate', value: String(sourceSummary?.proof_gate || 'not recorded') },
      ],
      claims,
    })
  }
  return runs
}

function extractField(text, field) {
  return text.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`))?.[1]
}

function claudePublicEvents(sourceEvents) {
  const agentByToolUseId = new Map()
  for (const event of sourceEvents) {
    if (event.eventType !== 'tool.use' || event.toolName !== 'Agent') continue
    const name = extractField(event.inputFocus || '', 'name')
    if (!name) continue
    agentByToolUseId.set(event.toolUseId, {
      name,
      description: extractField(event.inputFocus || '', 'description') || name,
      agentType: extractField(event.inputFocus || '', 'subagent_type') || 'subagent',
    })
  }

  const publicEvents = []
  for (const event of sourceEvents) {
    const common = {
      id: String(event.id),
      eventType: String(event.eventType),
      actor: String(event.actor),
      evidenceLevel: String(event.level || 'observed'),
      sourceRefs: sourceRefs(event.sourceEventIds),
    }

    if (event.eventType === 'prompt.submitted') {
      publicEvents.push({ ...common, summary: sanitizeText(event.inputFocus) })
      continue
    }
    if (event.eventType === 'assistant.text' || event.eventType === 'result.completed') {
      publicEvents.push({ ...common, summary: sanitizeText(event.resultPreview) })
      continue
    }
    if (event.eventType === 'tool.use' && event.toolName === 'Agent') {
      const agent = agentByToolUseId.get(event.toolUseId)
      if (!agent || publicEvents.some((candidate) => candidate.toolUseId === event.toolUseId && candidate.eventType === 'subagent.started')) continue
      publicEvents.push({
        ...common,
        eventType: 'subagent.started',
        summary: agent.description,
        toolName: 'Agent',
        toolUseId: event.toolUseId,
        agentName: agent.name,
        agentType: agent.agentType,
      })
      continue
    }
    if (event.eventType !== 'task.event') continue
    const agent = agentByToolUseId.get(event.toolUseId)
    if (!agent) continue
    const result = sanitizeText(event.resultPreview)
    const summary = sanitizeText(event.inputFocus || result)
    const completed = /Agent ".+" completed/.test(result) || /"status":"completed"/.test(result)
    publicEvents.push({
      ...common,
      eventType: completed ? 'subagent.completed' : 'task.activity',
      summary,
      toolUseId: event.toolUseId,
      agentName: agent.name,
      agentType: agent.agentType,
      taskStatus: completed ? 'completed' : 'observed',
    })
  }

  return monotonicPlaybackOffset(publicEvents, 420)
}

async function buildClaudeSubagentRun() {
  const sourceText = await readText(claudeSessionPath)
  const source = JSON.parse(sourceText)
  invariant(Array.isArray(source.events), `${relativeSource(claudeSessionPath)} is missing events[]`)
  const events = claudePublicEvents(source.events)
  const agentCount = new Set(events.map((event) => event.agentName).filter(Boolean)).size

  return {
    id: source.runId,
    title: 'Claude SDK subagent analysis',
    description: 'An observed Education Shell session using Claude Agent tool delegation.',
    status: 'recorded_projection',
    runtime: 'claude-agent-sdk',
    provider: 'claude',
    model: 'sonnet',
    sourceEventCount: source.events.length,
    publishedEventCount: events.length,
    source: {
      path: relativeSource(claudeSessionPath),
      sha256: digest(sourceText),
      verification: 'normalized-runtime-artifact',
    },
    events,
    facts: [
      { label: 'source events', value: String(source.events.length) },
      { label: 'observed subagents', value: String(agentCount) },
      { label: 'public events', value: String(events.length) },
      { label: 'topology claim', value: 'subagent delegation, not native Team' },
    ],
  }
}

function teamEventType(observation) {
  if (observation.includes('team was created')) return 'team.created'
  if (observation.includes('teammate agent was spawned')) return 'teammate.spawned'
  if (observation.includes('message routing')) return 'message.routed'
  if (observation.includes('finished')) return 'subagent.completed'
  if (observation.includes('configured')) return 'subagent.configured'
  return 'team.observation'
}

function teamPublicEvents(records) {
  const selected = records.filter((record) => record.concept === 'agent_task_orchestration')
  const firstTimestamp = Math.min(...selected.map((record) => Date.parse(record.ts)).filter(Number.isFinite))
  const events = selected.map((record, sequence) => {
    const data = record.data && typeof record.data === 'object' ? record.data : {}
    const observedAtMs = Date.parse(record.ts)
    return {
      id: `team-${sequence}-${digest(JSON.stringify(record)).slice(0, 10)}`,
      observedOffsetMs: Number.isFinite(observedAtMs) ? observedAtMs - firstTimestamp : undefined,
      observedAt: record.ts,
      eventType: teamEventType(record.observation || ''),
      actor: String(data.runtimeActorKind || 'runtime'),
      evidenceLevel: String(record.evidenceLevel || 'observed'),
      summary: sanitizeText(record.observation),
      sourceRefs: [`${record.sourceFile}:${record.sourceFunction}`],
      agentName: typeof data.runtimeActorName === 'string'
        ? data.runtimeActorName
        : typeof data.agentId === 'string'
          ? data.agentId.split('@')[0]
          : undefined,
      agentType: typeof data.agentType === 'string' ? data.agentType : undefined,
      parentAgentId: typeof data.runtimeParentActorId === 'string' ? data.runtimeParentActorId : undefined,
      teamName: typeof data.runtimeTeamName === 'string'
        ? data.runtimeTeamName
        : typeof data.teamName === 'string'
          ? data.teamName
          : undefined,
      model: typeof data.model === 'string' ? data.model : undefined,
      routeKind: typeof data.routeKind === 'string' ? data.routeKind : undefined,
      sender: typeof data.sender === 'string' ? data.sender : undefined,
      target: typeof data.target === 'string' ? data.target : undefined,
      taskStatus: typeof data.agentRunStatus === 'string' ? data.agentRunStatus : undefined,
    }
  })
  return monotonicPlaybackOffset(events, 260)
}

async function buildTeamRun() {
  const sourceText = await readText(teamEvidencePath)
  const records = sourceText.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  const events = teamPublicEvents(records)
  invariant(events.some((event) => event.eventType === 'team.created'), 'Team evidence is missing team.created')
  invariant(events.some((event) => event.eventType === 'message.routed'), 'Team evidence is missing message.routed')
  const members = new Set(events.map((event) => event.agentName).filter(Boolean))
  const teamName = events.find((event) => event.teamName)?.teamName

  return {
    id: 'dashscope-team-live-verify',
    title: 'DashScope native Team execution',
    description: 'Observed Team creation, teammate lifecycle, and message-routing evidence.',
    status: 'recorded_projection',
    runtime: 'dashscope-claude-compatible',
    provider: 'dashscope',
    model: 'qwen3.7-max',
    sourceEventCount: records.length,
    publishedEventCount: events.length,
    source: {
      path: relativeSource(teamEvidencePath),
      sha256: digest(sourceText),
      verification: 'instrumented-course-evidence',
      recordedAt: events[0]?.observedAt,
    },
    events,
    facts: [
      { label: 'team', value: teamName || 'observed team' },
      { label: 'observed members', value: String(members.size) },
      { label: 'routing events', value: String(events.filter((event) => event.eventType === 'message.routed').length) },
      { label: 'message bodies', value: 'not stored by source policy' },
    ],
  }
}

async function main() {
  const chapterRuns = await buildChapterRuns()
  invariant(chapterRuns.length > 0, 'No chapter evidence was published')
  const claudeSubagentRun = await buildClaudeSubagentRun()
  const teamRun = await buildTeamRun()

  const catalog = {
    schemaVersion: 'education-agent-flow.v1',
    courseId: 'book-sdk-ko',
    generatedAt: new Date().toISOString(),
    publicationPolicy: 'Whitelisted normalized evidence only; no mock fallback.',
    collections: [
      {
        id: 'book-sdk-ko',
        label: 'Book SDK chapter replay',
        description: 'Latest verified Education Shell recorded run for each available chapter.',
        kind: 'chapter',
        runs: chapterRuns,
      },
      {
        id: 'claude-sdk-subagents',
        label: 'Claude SDK Subagents',
        description: 'Agent tool delegation observed in one Education Shell session.',
        kind: 'subagents',
        runs: [claudeSubagentRun],
      },
      {
        id: 'dashscope-team',
        label: 'DashScope Team',
        description: 'Native Team runtime observations with message bodies intentionally absent.',
        kind: 'team',
        runs: [teamRun],
      },
    ],
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`)
  process.stdout.write(
    `Published ${catalog.collections.length} collections and ${
      catalog.collections.reduce((count, collection) => count + collection.runs.length, 0)
    } runs to ${path.relative(root, outputPath)}\n`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
