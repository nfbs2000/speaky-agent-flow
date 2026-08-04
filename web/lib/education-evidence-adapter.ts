import type { SimulationEvent } from './agent-types'
import type { EducationEvidenceEvent, EducationEvidenceRun } from './education-evidence-types'

const MAIN_AGENT = 'course-orchestrator'
const TEAM_LEAD = 'team-lead'

export interface EducationReplayProjection {
  events: SimulationEvent[]
  mappedSourceEvents: number
  unmappedSourceEvents: number
}

function at(event: EducationEvidenceEvent, offset = 0): number {
  return event.playbackOffsetMs / 1000 + offset
}

function parseSummaryInput(summary: string): Record<string, unknown> | undefined {
  const start = summary.indexOf('{')
  if (start < 0) return undefined
  try {
    const parsed = JSON.parse(summary.slice(start))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined
  } catch {
    return undefined
  }
}

function toolArgs(event: EducationEvidenceEvent): string {
  const input = parseSummaryInput(event.summary)
  if (!input) return event.summary.replace(new RegExp(`^${event.toolName ?? ''}\\s*`), '').trim()
  for (const key of ['file_path', 'command', 'pattern', 'skill', 'description']) {
    if (typeof input[key] === 'string') return String(input[key])
  }
  return JSON.stringify(input)
}

function selectedToolUses(events: EducationEvidenceEvent[]): Set<number> {
  const best = new Map<string, number>()
  for (const event of events) {
    if (event.eventType !== 'tool.use' || !event.toolUseId) continue
    const current = best.get(event.toolUseId)
    if (current === undefined || events[current].summary.length <= event.summary.length) {
      best.set(event.toolUseId, event.sequence)
    }
  }
  return new Set(best.values())
}

function chapterProjection(run: EducationEvidenceRun): EducationReplayProjection {
  const events: SimulationEvent[] = [
    {
      time: 0,
      type: 'agent_spawn',
      payload: {
        name: MAIN_AGENT,
        isMain: true,
        task: run.title,
        model: run.model,
      },
    },
  ]
  const selectedUses = selectedToolUses(run.events)
  const toolNameById = new Map<string, string>()
  let mapped = 0

  for (const source of run.events) {
    if (source.eventType === 'sdk.init') {
      if (run.model) {
        events.push({
          time: at(source),
          type: 'model_detected',
          payload: { agent: MAIN_AGENT, model: run.model },
        })
        mapped++
      }
      continue
    }
    if (source.eventType === 'prompt.submitted') {
      events.push({
        time: at(source),
        type: 'message',
        payload: { agent: MAIN_AGENT, role: 'user', content: source.summary },
      })
      mapped++
      continue
    }
    if (source.eventType === 'assistant.text' || source.eventType === 'result.completed') {
      events.push({
        time: at(source),
        type: 'message',
        payload: { agent: MAIN_AGENT, role: 'assistant', content: source.summary },
      })
      mapped++
      continue
    }
    if (source.eventType === 'tool.use' && selectedUses.has(source.sequence) && source.toolName) {
      if (source.toolUseId) toolNameById.set(source.toolUseId, source.toolName)
      events.push({
        time: at(source),
        type: 'tool_call_start',
        payload: {
          agent: MAIN_AGENT,
          tool: source.toolName,
          args: toolArgs(source),
          inputData: parseSummaryInput(source.summary),
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'tool.result') {
      const toolName = (source.toolUseId ? toolNameById.get(source.toolUseId) : undefined)
        ?? source.toolName
      if (!toolName) continue
      events.push({
        time: at(source),
        type: 'tool_call_end',
        payload: {
          agent: MAIN_AGENT,
          tool: toolName,
          result: source.isError
            ? `Observed denial/error (${source.sourceRefs[0] ?? source.id})`
            : `Observed result (${source.sourceRefs[0] ?? source.id})`,
          isError: source.isError === true,
          errorMessage: source.isError ? source.summary : undefined,
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'workspace.snapshot') {
      const state = source.marker
        ?? (source.targetExists === false ? 'target absent' : 'target state observed')
      const digest = source.sha256 ? ` · SHA-256 ${source.sha256.slice(0, 12)}...` : ''
      events.push({
        time: at(source),
        type: 'message',
        payload: {
          agent: MAIN_AGENT,
          role: 'assistant',
          content: `Workspace ${source.phase ?? 'snapshot'}: ${state}${digest}`,
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'runtime.warning') {
      events.push({
        time: at(source),
        type: 'message',
        payload: {
          agent: MAIN_AGENT,
          role: 'assistant',
          content: `Runtime warning: ${source.warningCategory ?? source.summary}`,
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'permission.denied') {
      events.push({
        time: at(source),
        type: 'message',
        payload: {
          agent: MAIN_AGENT,
          role: 'assistant',
          content: `권한 거부: ${source.toolName ?? 'tool'} · 판정 ${source.decisionReasonType ?? 'recorded'}`,
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'assistant.claim' && source.claimStatus === 'correction_required') {
      events.push({
        time: at(source),
        type: 'message',
        payload: {
          agent: MAIN_AGENT,
          role: 'assistant',
          content: `수정 필요: ${source.summary}`,
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'permission.request') {
      events.push({
        time: at(source),
        type: 'permission_requested',
        payload: { agent: MAIN_AGENT, tool: source.toolName ?? 'tool' },
      })
      mapped++
    }
  }

  const end = (run.events.at(-1)?.playbackOffsetMs ?? 0) / 1000 + 0.8
  events.push({ time: end, type: 'agent_complete', payload: { name: MAIN_AGENT } })
  return {
    events: events.sort((a, b) => a.time - b.time),
    mappedSourceEvents: mapped,
    unmappedSourceEvents: run.publishedEventCount - mapped,
  }
}

function subagentProjection(run: EducationEvidenceRun): EducationReplayProjection {
  const events: SimulationEvent[] = [
    {
      time: 0,
      type: 'agent_spawn',
      payload: { name: MAIN_AGENT, isMain: true, task: run.title, model: run.model },
    },
  ]
  const completed = new Set<string>()
  let mapped = 0

  for (const source of run.events) {
    if (source.eventType === 'prompt.submitted') {
      events.push({
        time: at(source),
        type: 'message',
        payload: { agent: MAIN_AGENT, role: 'user', content: source.summary },
      })
      mapped++
      continue
    }
    if (source.eventType === 'assistant.text' || source.eventType === 'result.completed') {
      events.push({
        time: at(source),
        type: 'message',
        payload: { agent: MAIN_AGENT, role: 'assistant', content: source.summary },
      })
      mapped++
      continue
    }
    if (source.eventType === 'subagent.started' && source.agentName) {
      events.push(
        {
          time: at(source),
          type: 'subagent_dispatch',
          payload: { parent: MAIN_AGENT, child: source.agentName, task: source.summary },
        },
        {
          time: at(source, 0.02),
          type: 'agent_spawn',
          payload: {
            name: source.agentName,
            parent: MAIN_AGENT,
            task: source.summary,
            model: source.model,
          },
        },
      )
      mapped++
      continue
    }
    if (source.eventType === 'task.activity' && source.agentName) {
      events.push({
        time: at(source),
        type: 'message',
        payload: { agent: source.agentName, role: 'assistant', content: source.summary },
      })
      mapped++
      continue
    }
    if (source.eventType === 'subagent.completed' && source.agentName && !completed.has(source.agentName)) {
      completed.add(source.agentName)
      events.push(
        {
          time: at(source),
          type: 'subagent_return',
          payload: { parent: MAIN_AGENT, child: source.agentName, summary: source.summary },
        },
        {
          time: at(source, 0.02),
          type: 'agent_complete',
          payload: { name: source.agentName },
        },
      )
      mapped++
    }
  }

  const end = (run.events.at(-1)?.playbackOffsetMs ?? 0) / 1000 + 0.8
  events.push({ time: end, type: 'agent_complete', payload: { name: MAIN_AGENT } })
  return {
    events: events.sort((a, b) => a.time - b.time),
    mappedSourceEvents: mapped,
    unmappedSourceEvents: run.publishedEventCount - mapped,
  }
}

function teamProjection(run: EducationEvidenceRun): EducationReplayProjection {
  const events: SimulationEvent[] = [
    {
      time: 0,
      type: 'agent_spawn',
      payload: { name: TEAM_LEAD, isMain: true, task: run.title, model: run.model },
    },
  ]
  const spawned = new Set<string>()
  const completed = new Set<string>()
  let mapped = 0

  const ensureMember = (source: EducationEvidenceEvent) => {
    const name = source.agentName
    if (!name || name === TEAM_LEAD || spawned.has(name)) return
    spawned.add(name)
    events.push(
      {
        time: at(source),
        type: 'subagent_dispatch',
        payload: { parent: TEAM_LEAD, child: name, task: source.summary },
      },
      {
        time: at(source, 0.02),
        type: 'agent_spawn',
        payload: {
          name,
          parent: TEAM_LEAD,
          task: source.agentType || source.summary,
          model: source.model,
        },
      },
    )
  }

  for (const source of run.events) {
    if (source.eventType === 'team.created') {
      events.push({
        time: at(source),
        type: 'message',
        payload: {
          agent: TEAM_LEAD,
          role: 'assistant',
          content: `${source.summary} Team: ${source.teamName ?? 'observed'}.`,
        },
      })
      mapped++
      continue
    }
    if (source.eventType === 'subagent.configured' || source.eventType === 'teammate.spawned') {
      ensureMember(source)
      if (source.agentName) {
        events.push({
          time: at(source, 0.04),
          type: 'message',
          payload: { agent: source.agentName, role: 'assistant', content: source.summary },
        })
      }
      mapped++
      continue
    }
    if (source.eventType === 'message.routed') {
      const sender = source.sender || (source.actor === 'teammate' ? source.agentName : TEAM_LEAD)
      const target = source.target
      if (sender && sender !== TEAM_LEAD && !spawned.has(sender)) ensureMember({ ...source, agentName: sender })
      if (target && target !== TEAM_LEAD && !spawned.has(target)) ensureMember({ ...source, agentName: target })
      if (sender && target) {
        const isReturn = target === TEAM_LEAD
        events.push({
          time: at(source, 0.05),
          type: isReturn ? 'subagent_return' : 'subagent_dispatch',
          payload: isReturn
            ? { parent: TEAM_LEAD, child: sender, summary: `${source.routeKind}: body not stored` }
            : { parent: sender, child: target, task: `${source.routeKind}: body not stored` },
        })
        events.push({
          time: at(source, 0.07),
          type: 'message',
          payload: {
            agent: sender,
            role: 'assistant',
            content: `Observed ${source.routeKind ?? 'message'} route to ${target}; message body was not stored.`,
          },
        })
      }
      mapped++
      continue
    }
    if (source.eventType === 'subagent.completed' && source.agentName && !completed.has(source.agentName)) {
      ensureMember(source)
      completed.add(source.agentName)
      events.push(
        {
          time: at(source, 0.05),
          type: 'subagent_return',
          payload: { parent: TEAM_LEAD, child: source.agentName, summary: source.summary },
        },
        {
          time: at(source, 0.07),
          type: 'agent_complete',
          payload: { name: source.agentName },
        },
      )
      mapped++
    }
  }

  const end = (run.events.at(-1)?.playbackOffsetMs ?? 0) / 1000 + 0.8
  events.push({ time: end, type: 'agent_complete', payload: { name: TEAM_LEAD } })
  return {
    events: events.sort((a, b) => a.time - b.time),
    mappedSourceEvents: mapped,
    unmappedSourceEvents: run.publishedEventCount - mapped,
  }
}

export function buildEducationReplay(run: EducationEvidenceRun): EducationReplayProjection {
  if (run.runtime === 'claude-agent-sdk' && run.chapterSlug) return chapterProjection(run)
  if (run.runtime === 'claude-agent-sdk') return subagentProjection(run)
  return teamProjection(run)
}
