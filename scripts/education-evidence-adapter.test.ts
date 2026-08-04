import assert from 'node:assert/strict'
import test from 'node:test'

import { buildEducationReplay } from '../web/lib/education-evidence-adapter'
import type { EducationEvidenceRun } from '../web/lib/education-evidence-types'

test('chapter replay preserves permission mutation, warning, denial, and correction', () => {
  const run: EducationEvidenceRun = {
    id: 'ch16',
    title: '16장 권한 시스템',
    description: 'actual evidence',
    status: 'verified_source',
    runtime: 'claude-agent-sdk',
    provider: 'anthropic',
    model: 'claude-opus-5',
    chapterSlug: 'ch16',
    sourceEventCount: 20,
    publishedEventCount: 7,
    source: { path: 'trace.json', sha256: 'a'.repeat(64), verification: 'verified' },
    facts: [],
    events: [
      event(0, 'tool.use', { toolName: 'Edit', toolUseId: 'edit-1' }),
      event(1, 'workspace.snapshot', {
        phase: 'before', marker: 'CH16_BEFORE', sha256: 'b'.repeat(64), targetExists: true,
      }),
      event(2, 'tool.result', { toolName: 'Edit', toolUseId: 'edit-1', isError: false }),
      event(3, 'workspace.snapshot', {
        phase: 'after', marker: 'CH16_AFTER_ACCEPT_EDITS', sha256: 'c'.repeat(64), targetExists: true,
      }),
      event(4, 'runtime.warning', { warningCategory: 'CanUseToolShadowedWarning' }),
      event(5, 'tool.use', {
        toolName: 'mcp__permission__controlled', toolUseId: 'deny-1',
      }),
      event(6, 'permission.denied', {
        toolName: 'mcp__permission__controlled', toolUseId: 'deny-1', decisionReasonType: 'rule',
      }),
      event(7, 'tool.result', {
        toolName: 'mcp__permission__controlled', toolUseId: 'deny-1', isError: true,
      }),
      event(8, 'assistant.claim', {
        claimStatus: 'correction_required',
        summary: 'Terminal success는 모든 도구의 승인을 뜻하지 않는다.',
      }),
    ],
  }

  const projection = buildEducationReplay(run)
  const messages = projection.events.filter((item) => item.type === 'message')
  const toolEnds = projection.events.filter((item) => item.type === 'tool_call_end')

  assert.equal(projection.mappedSourceEvents, 9)
  assert.ok(messages.some((item) => String(item.payload.content).includes('CH16_BEFORE')))
  assert.ok(messages.some((item) => String(item.payload.content).includes('CH16_AFTER_ACCEPT_EDITS')))
  assert.ok(messages.some((item) => String(item.payload.content).includes('CanUseToolShadowedWarning')))
  assert.ok(messages.some((item) => String(item.payload.content).includes('권한 거부')))
  assert.ok(messages.some((item) => String(item.payload.content).includes('rule')))
  assert.ok(messages.some((item) => String(item.payload.content).includes('수정 필요')))
  assert.ok(toolEnds.some((item) => item.payload.isError === true))
})

function event(
  sequence: number,
  eventType: string,
  values: Record<string, unknown>,
) {
  return {
    id: `event-${sequence}`,
    sequence,
    playbackOffsetMs: sequence * 220,
    eventType,
    actor: 'runtime',
    evidenceLevel: 'Observed',
    summary: typeof values.summary === 'string' ? values.summary : eventType,
    sourceRefs: [`attempt:source:${sequence}`],
    ...values,
  }
}
