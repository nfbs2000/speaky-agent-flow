export type EducationEvidenceKind = 'chapter' | 'subagents' | 'team'

export interface EducationEvidenceSource {
  path: string
  sha256: string
  verification: string
  recordedAt?: string
}

export interface EducationEvidenceEvent {
  id: string
  sequence: number
  playbackOffsetMs: number
  observedOffsetMs?: number
  observedAt?: string
  eventType: string
  actor: string
  evidenceLevel: string
  summary: string
  sourceRefs: string[]
  toolName?: string
  toolUseId?: string
  agentName?: string
  agentType?: string
  parentAgentId?: string
  taskStatus?: string
  teamName?: string
  model?: string
  routeKind?: string
  sender?: string
  target?: string
}

export interface EducationEvidenceRun {
  id: string
  title: string
  description: string
  status: 'verified_source' | 'recorded_projection' | 'source_missing'
  runtime: string
  provider: string
  model?: string
  chapterSlug?: string
  sourceEventCount: number
  publishedEventCount: number
  source: EducationEvidenceSource
  events: EducationEvidenceEvent[]
  facts: Array<{ label: string; value: string }>
}

export interface EducationEvidenceCollection {
  id: string
  label: string
  description: string
  kind: EducationEvidenceKind
  runs: EducationEvidenceRun[]
}

export interface EducationEvidenceCatalog {
  schemaVersion: 'education-agent-flow.v1'
  courseId: 'book-sdk-ko'
  generatedAt: string
  publicationPolicy: string
  collections: EducationEvidenceCollection[]
}
