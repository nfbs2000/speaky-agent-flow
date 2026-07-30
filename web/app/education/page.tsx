import { promises as fs } from "node:fs"
import path from "node:path"
import { EducationReplay } from "@/components/education-replay/education-replay"
import type { EducationEvidenceCatalog } from "@/lib/education-evidence-types"

export default async function EducationPage() {
  const catalogPath = path.join(process.cwd(), "public", "education-evidence", "catalog.json")
  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8")) as EducationEvidenceCatalog
  return <EducationReplay catalog={catalog} />
}
