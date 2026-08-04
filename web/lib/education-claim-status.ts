export interface ClaimVerdictAppearance {
  label: string
  color: string
}

const CLAIM_VERDICTS: Record<string, ClaimVerdictAppearance> = {
  configured: { label: "CONFIGURED", color: "#7dd3fc" },
  observed: { label: "OBSERVED", color: "#68e0a0" },
  inferred: { label: "INFERRED", color: "#f0c66e" },
  not_observed: { label: "NOT OBSERVED", color: "#94a3b8" },
  correction_required: { label: "CORRECTION REQUIRED", color: "#ff8f8f" },
  additional_observation_required: { label: "MORE EVIDENCE", color: "#c4b5fd" },
}

export function claimVerdictAppearance(status: string): ClaimVerdictAppearance {
  return CLAIM_VERDICTS[status] ?? {
    label: status.replaceAll("_", " ").toUpperCase(),
    color: "#94a3b8",
  }
}
