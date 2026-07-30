"use client"

import { MOCK_SCENARIO } from "@/lib/mock-scenario"
import { AgentVisualizer } from "."

export function DemoAgentVisualizer() {
  return <AgentVisualizer demoEvents={MOCK_SCENARIO} />
}
