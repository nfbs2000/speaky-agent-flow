"use client"

import { useEffect, useMemo, useState } from "react"
import { AgentVisualizer } from "@/components/agent-visualizer"
import { PublicSiteNav } from "@/components/public-site-nav"
import { buildEducationReplay } from "@/lib/education-evidence-adapter"
import type {
  EducationEvidenceCatalog,
  EducationEvidenceCollection,
  EducationEvidenceRun,
} from "@/lib/education-evidence-types"

const STATUS = {
  verified_source: {
    label: "SOURCE VERIFIED",
    color: "#68e0a0",
    border: "rgba(104, 224, 160, 0.38)",
  },
  recorded_projection: {
    label: "RECORDED PROJECTION",
    color: "#f0c66e",
    border: "rgba(240, 198, 110, 0.38)",
  },
  source_missing: {
    label: "SOURCE MISSING · TRACE ONLY",
    color: "#ff8f8f",
    border: "rgba(255, 143, 143, 0.42)",
  },
} as const

function defaultSelection(catalog: EducationEvidenceCatalog) {
  const fallbackCollection = catalog.collections[0]
  return {
    collectionId: fallbackCollection?.id ?? "",
    runId: fallbackCollection?.runs[0]?.id ?? "",
  }
}

function findCollection(catalog: EducationEvidenceCatalog, id: string): EducationEvidenceCollection {
  return catalog.collections.find((collection) => collection.id === id) ?? catalog.collections[0]
}

function findRun(collection: EducationEvidenceCollection, id: string): EducationEvidenceRun {
  return collection.runs.find((run) => run.id === id) ?? collection.runs[0]
}

function EvidenceOverlay({
  catalog,
  collection,
  run,
  mapped,
  unmapped,
  onCollectionChange,
  onRunChange,
}: {
  catalog: EducationEvidenceCatalog
  collection: EducationEvidenceCollection
  run: EducationEvidenceRun
  mapped: number
  unmapped: number
  onCollectionChange: (id: string) => void
  onRunChange: (id: string) => void
}) {
  const status = STATUS[run.status]
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""

  return (
    <>
      <header
        data-testid="education-replay-header"
        className="absolute left-3 right-3 top-3 z-[220] flex min-h-20 flex-wrap items-center gap-x-5 gap-y-2 border border-cyan-300/15 bg-[#050910]/95 px-4 py-3 font-mono shadow-2xl"
        style={{ borderRadius: 6 }}
      >
        <div className="min-w-[14rem] flex-1">
          <div className="text-[10px] font-semibold tracking-widest text-cyan-300">
            EDUCATION AGENT FLOW
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-100">{run.title}</div>
          <div className="mt-1 line-clamp-1 text-[10px] text-slate-500">{run.description}</div>
        </div>

        <label className="grid gap-1 text-[9px] uppercase tracking-wider text-slate-500">
          Evidence collection
          <select
            data-testid="education-collection-select"
            value={collection.id}
            onChange={(event) => onCollectionChange(event.target.value)}
            className="h-8 min-w-[14rem] border border-slate-700 bg-black px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
          >
            {catalog.collections.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-[9px] uppercase tracking-wider text-slate-500">
          Recorded run
          <select
            data-testid="education-run-select"
            value={run.id}
            onChange={(event) => onRunChange(event.target.value)}
            className="h-8 min-w-[13rem] border border-slate-700 bg-black px-2 text-[11px] text-slate-200 outline-none focus:border-cyan-500"
          >
            {collection.runs.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.chapterSlug ? `${candidate.chapterSlug} · ` : ""}{candidate.title}
              </option>
            ))}
          </select>
        </label>

        <div
          data-testid="education-evidence-status"
          className="border px-2 py-1 text-[9px] font-semibold tracking-wider"
          style={{ color: status.color, borderColor: status.border, borderRadius: 4 }}
        >
          {status.label}
        </div>
      </header>

      <aside
        data-testid="education-evidence-facts"
        className="absolute right-3 top-[224px] z-[210] w-[min(22rem,calc(100vw-1.5rem))] border border-cyan-300/15 bg-[#050910]/94 p-3 font-mono shadow-xl md:top-[108px]"
        style={{ borderRadius: 6 }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2">
          <span className="text-[10px] font-semibold tracking-widest text-cyan-300">OBSERVED FACTS</span>
          <a
            href={`${basePath}/education-evidence/catalog.json`}
            className="text-[9px] text-slate-500 underline decoration-slate-700 underline-offset-2 hover:text-cyan-300"
          >
            source JSON
          </a>
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[9px]">
          <dt className="text-slate-600">runtime</dt>
          <dd className="truncate text-slate-300">{run.runtime} · {run.model ?? "model not recorded"}</dd>
          <dt className="text-slate-600">events</dt>
          <dd className="text-slate-300">
            {run.sourceEventCount} source · {run.publishedEventCount} public · {mapped} mapped · {unmapped} facts
          </dd>
          <dt className="text-slate-600">source</dt>
          <dd className="truncate text-slate-400" title={run.source.path}>{run.source.path}</dd>
          <dt className="text-slate-600">sha256</dt>
          <dd className="text-slate-400">{run.source.sha256.slice(0, 16)}</dd>
          <dt className="text-slate-600">verification</dt>
          <dd className="text-slate-400">{run.source.verification}</dd>
          {run.facts.map((fact) => (
            <div key={`${fact.label}:${fact.value}`} className="contents">
              <dt className="text-slate-600">{fact.label}</dt>
              <dd className="text-slate-300">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </>
  )
}

export function EducationReplay({ catalog }: { catalog: EducationEvidenceCatalog }) {
  const initial = useMemo(() => defaultSelection(catalog), [catalog])
  const [collectionId, setCollectionId] = useState(initial.collectionId)
  const [runId, setRunId] = useState(initial.runId)
  const [queryRestored, setQueryRestored] = useState(false)
  const collection = findCollection(catalog, collectionId)
  const run = findRun(collection, runId)
  const projection = useMemo(() => buildEducationReplay(run), [run])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedCollection = catalog.collections.find(
      (candidate) => candidate.id === params.get("collection"),
    )
    const nextCollection = requestedCollection ?? findCollection(catalog, initial.collectionId)
    const requestedRun = nextCollection.runs.find((candidate) => candidate.id === params.get("run"))
    setCollectionId(nextCollection.id)
    setRunId(requestedRun?.id ?? nextCollection.runs[0]?.id ?? "")
    setQueryRestored(true)
  }, [catalog, initial.collectionId])

  useEffect(() => {
    if (!queryRestored) return
    const params = new URLSearchParams(window.location.search)
    params.set("collection", collection.id)
    params.set("run", run.id)
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`)
  }, [collection.id, queryRestored, run.id])

  const handleCollectionChange = (nextId: string) => {
    const nextCollection = findCollection(catalog, nextId)
    setCollectionId(nextCollection.id)
    setRunId(nextCollection.runs[0]?.id ?? "")
  }

  return (
    <>
      <AgentVisualizer
        key={`${collection.id}:${run.id}`}
        replayEvents={projection.events}
        emptyTitle="NO OBSERVED REPLAY EVENTS"
        emptyDescription="The selected source did not produce a drawable Agent Flow topology."
        replayOverlay={(
          <EvidenceOverlay
            catalog={catalog}
            collection={collection}
            run={run}
            mapped={projection.mappedSourceEvents}
            unmapped={projection.unmappedSourceEvents}
            onCollectionChange={handleCollectionChange}
            onRunChange={setRunId}
          />
        )}
      />
      <PublicSiteNav />
    </>
  )
}
