import { httpGet, httpPost } from '@/services/http-client'
import type { StudyAgentCohortCritique, StudyAgentCohortDraft, StudyAgentCohortProvenance, StudyAgentCohortRoute, StudyAgentCohortSession } from '@/models/study-agent.types'

const BASE = '/study-agent/v1/cohort-definition-sessions'

export function startStudyAgentCohortSession(narrative: string, route: StudyAgentCohortRoute): Promise<StudyAgentCohortSession> {
  return httpPost<StudyAgentCohortSession>(BASE, { narrative, route })
}

export function requestStudyAgentCohortRecommendations(sessionId: string, request: { candidate_offset?: number } = {}): Promise<{ recommendations: Record<string, unknown> }> {
  return httpPost<{ recommendations: Record<string, unknown> }>(`${BASE}/${encodeURIComponent(sessionId)}/recommendations`, request)
}

export function searchStudyAgentPhenotypeLibrary(sessionId: string, query: string): Promise<{ catalog: Record<string, unknown> }> {
  return httpPost<{ catalog: Record<string, unknown> }>(`${BASE}/${encodeURIComponent(sessionId)}/library-search`, { query })
}

export function continueStudyAgentMakeComputable(sessionId: string, request: Record<string, unknown>): Promise<{ flow: Record<string, unknown> }> {
  return httpPost<{ flow: Record<string, unknown> }>(`${BASE}/${encodeURIComponent(sessionId)}/make-computable`, request)
}

export function importStudyAgentPhenotypeDraft(sessionId: string, phenotypeId: string, recommendationContext: Record<string, unknown> = {}): Promise<StudyAgentCohortDraft> {
  return httpPost<StudyAgentCohortDraft>(`${BASE}/${encodeURIComponent(sessionId)}/phenotypes/${encodeURIComponent(phenotypeId)}/draft`, recommendationContext)
}

export function getStudyAgentCohortDraft(sessionId: string): Promise<StudyAgentCohortDraft> {
  return httpGet<StudyAgentCohortDraft>(`${BASE}/${encodeURIComponent(sessionId)}/draft`)
}

export function linkStudyAgentCohortDraft(sessionId: string, cohortDefinitionId: number): Promise<{ cohort_definition_id: number }> {
  return httpPost<{ cohort_definition_id: number }>(`${BASE}/${encodeURIComponent(sessionId)}/cohort-definition/${cohortDefinitionId}`, {})
}

export function getStudyAgentCohortProvenance(cohortDefinitionId: number): Promise<StudyAgentCohortProvenance> {
  return httpGet<StudyAgentCohortProvenance>(`/study-agent/v1/cohort-definitions/${cohortDefinitionId}/provenance`)
}

export function reviewStudyAgentCohortDefinition(cohortDefinitionId: number): Promise<{ review: StudyAgentCohortCritique }> {
  return httpPost<{ review: StudyAgentCohortCritique }>(`/study-agent/v1/cohort-definitions/${cohortDefinitionId}/review`, {})
}
