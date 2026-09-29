/**
 * Ephemeral browser handoff from a cohort building block to the existing
 * concept-set drawer. Durable state remains WebAPI's cohort specification;
 * this only carries navigation context while the user reviews one asset.
 */
export interface StudyAgentCohortConceptSetHandoff {
  cohortSessionId: string
  slotId: string
  label: string
  domain: string
  criterionRole: string
}

const STORAGE_KEY = 'study-agent-cohort-concept-set-handoff'

export function setStudyAgentCohortConceptSetHandoff(value: StudyAgentCohortConceptSetHandoff) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function getStudyAgentCohortConceptSetHandoff(): StudyAgentCohortConceptSetHandoff | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<StudyAgentCohortConceptSetHandoff>
    if (!value.cohortSessionId || !value.slotId || !value.label || !value.domain || !value.criterionRole) return null
    return {
      cohortSessionId: value.cohortSessionId,
      slotId: value.slotId,
      label: value.label,
      domain: value.domain,
      criterionRole: value.criterionRole,
    }
  } catch {
    return null
  }
}

export function clearStudyAgentCohortConceptSetHandoff() {
  sessionStorage.removeItem(STORAGE_KEY)
}
