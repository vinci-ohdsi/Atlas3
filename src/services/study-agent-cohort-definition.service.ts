import { httpGet, httpPost } from '@/services/http-client'
import type { StudyAgentCohortCritique, StudyAgentCohortDraft, StudyAgentCohortRefinementDialogue, StudyAgentCohortProvenance, StudyAgentCohortRoute, StudyAgentCohortSession, StudyAgentCohortSpecificationComponent, StudyAgentCohortSpecificationRevision, StudyAgentCohortPlanSummary } from '@/models/study-agent.types'

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

export function continueStudyAgentMakeComputable(sessionId: string, request: Record<string, unknown>): Promise<{ flow: Record<string, unknown>; cohort_specification?: StudyAgentCohortSpecificationRevision }> {
  return httpPost<{ flow: Record<string, unknown>; cohort_specification?: StudyAgentCohortSpecificationRevision }>(`${BASE}/${encodeURIComponent(sessionId)}/make-computable`, request)
}

export function getStudyAgentCohortSpecification(sessionId: string): Promise<{ cohort_specification: StudyAgentCohortSpecificationRevision }> {
  return httpGet<{ cohort_specification: StudyAgentCohortSpecificationRevision }>(`${BASE}/${encodeURIComponent(sessionId)}/specification`)
}

export function archiveStudyAgentCohortPlan(sessionId: string): Promise<{ session_id: string; state: 'archived' }> {
  return httpPost<{ session_id: string; state: 'archived' }>(`${BASE}/${encodeURIComponent(sessionId)}/archive`, {})
}

export function listStudyAgentCohortPlans(): Promise<{ plans: StudyAgentCohortPlanSummary[] }> {
  return httpGet<{ plans: StudyAgentCohortPlanSummary[] }>(`${BASE}/specifications`)
}

export function createStudyAgentMultiComponentSpecification(sessionId: string, scope: Record<string, unknown>, components: StudyAgentCohortSpecificationComponent[]): Promise<{ cohort_specification: StudyAgentCohortSpecificationRevision }> {
  return httpPost<{ cohort_specification: StudyAgentCohortSpecificationRevision }>(`${BASE}/${encodeURIComponent(sessionId)}/specification`, { scope, components })
}

export function attachStudyAgentCohortConceptSetSnapshot(sessionId: string, slotId: string, conceptSetId: number | string): Promise<{ cohort_specification: StudyAgentCohortSpecificationRevision }> {
  return httpPost<{ cohort_specification: StudyAgentCohortSpecificationRevision }>(`${BASE}/${encodeURIComponent(sessionId)}/specification/slots/${encodeURIComponent(slotId)}/concept-set/${encodeURIComponent(conceptSetId)}`, {})
}

export function confirmStudyAgentCohortSpecificationLogic(sessionId: string, review: { relationships: Record<string, string>; supporting_windows?: Record<string, { start_days: number | null; end_days: number | null }>; exit_strategy?: string | { type: 'fixed'; index: string; offset_days: number | null }; supporting_operator: 'ALL' | 'ANY'; confirm_bindings: boolean; confirm_logic: boolean }): Promise<{ cohort_specification: StudyAgentCohortSpecificationRevision }> {
  return httpPost<{ cohort_specification: StudyAgentCohortSpecificationRevision }>(`${BASE}/${encodeURIComponent(sessionId)}/specification/logic-review`, review)
}

export function reopenStudyAgentCohortSpecificationLogic(sessionId: string): Promise<{ cohort_specification: StudyAgentCohortSpecificationRevision }> {
  return httpPost<{ cohort_specification: StudyAgentCohortSpecificationRevision }>(`${BASE}/${encodeURIComponent(sessionId)}/specification/reopen-logic-review`, {})
}

export function projectStudyAgentCohortSpecification(sessionId: string): Promise<StudyAgentCohortDraft> {
  return httpPost<StudyAgentCohortDraft>(`${BASE}/${encodeURIComponent(sessionId)}/specification/project`, {})
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

export function continueStudyAgentCohortRefinementDialogue(cohortDefinitionId: number, message: string): Promise<{ dialogue: StudyAgentCohortRefinementDialogue }> {
  return httpPost<{ dialogue: StudyAgentCohortRefinementDialogue }>(`/study-agent/v1/cohort-definitions/${cohortDefinitionId}/review-dialogue`, { message })
}
