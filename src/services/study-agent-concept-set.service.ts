import { httpGet, httpPost } from '@/services/http-client'
import type {
  ContinueStudyAgentConceptSetSessionRequest,
  StartStudyAgentConceptSetSessionRequest,
  StudyAgentConceptSetSessionResponse,
} from '@/models/study-agent.types'

export function startStudyAgentConceptSetSession(
  request: StartStudyAgentConceptSetSessionRequest,
): Promise<StudyAgentConceptSetSessionResponse> {
  return httpPost<StudyAgentConceptSetSessionResponse>(
    '/study-agent/v1/concept-set-sessions',
    request,
  )
}

export function continueStudyAgentConceptSetSession(
  sessionId: string,
  request: ContinueStudyAgentConceptSetSessionRequest,
): Promise<StudyAgentConceptSetSessionResponse> {
  return httpPost<StudyAgentConceptSetSessionResponse>(
    `/study-agent/v1/concept-set-sessions/${encodeURIComponent(sessionId)}/messages`,
    request,
  )
}

export function requestStudyAgentConceptSetProposal(sessionId: string, targetDomain: string): Promise<{ proposal: unknown; review_revision?: number }> {
  return httpPost<{ proposal: unknown; review_revision?: number }>(
    `/study-agent/v1/concept-set-sessions/${encodeURIComponent(sessionId)}/proposal`,
    { target_domain: targetDomain },
  )
}

export interface StudyAgentConceptSetPolicyRow {
  concept_id: number
  is_excluded: boolean
  include_descendants: boolean
  include_mapped: boolean
  rationale: string
}

export function reviewStudyAgentConceptSetCandidatePolicies(
  sessionId: string,
  sourceReviewRevision: number,
  reviewedItems: StudyAgentConceptSetPolicyRow[],
): Promise<{ proposal: unknown; review_revision?: number; source_review_revision: number }> {
  return httpPost<{ proposal: unknown; review_revision?: number; source_review_revision: number }>(
    `/study-agent/v1/concept-set-sessions/${encodeURIComponent(sessionId)}/proposal/review`,
    { source_review_revision: sourceReviewRevision, reviewed_items: reviewedItems },
  )
}

export function applyStudyAgentConceptSetProposal(
  sessionId: string,
  reviewRevision: number,
): Promise<{ session_id: string; review_revision: number; expression: unknown; expression_checksum: string; validation: { status: string } }> {
  return httpPost<{ session_id: string; review_revision: number; expression: unknown; expression_checksum: string; validation: { status: string } }>(
    `/study-agent/v1/concept-set-sessions/${encodeURIComponent(sessionId)}/proposal/apply`,
    { review_revision: reviewRevision },
  )
}

export function finalizeStudyAgentConceptSetProposal(
  sessionId: string,
  reviewRevision: number,
  conceptSetId: number | string,
): Promise<{ session_id: string; concept_set_id: number; review_revision: number; expression_checksum: string }> {
  return httpPost<{ session_id: string; concept_set_id: number; review_revision: number; expression_checksum: string }>(
    `/study-agent/v1/concept-set-sessions/${encodeURIComponent(sessionId)}/proposal/finalize?conceptSetId=${encodeURIComponent(String(conceptSetId))}`,
    { review_revision: reviewRevision },
  )
}

export interface StudyAgentExternalReviewStatus {
  session_id: string
  state: 'external_review_pending' | 'external_review_accepted' | string
  concept_set_id: number
  review_revision?: number
  expression_checksum?: string
  expression?: unknown
  external_review?: {
    source?: string
    review_id?: string
    workflow_id?: string
    role_label?: string
    candidate_count?: number
    scope?: Record<string, unknown>
    candidate_summary?: Record<string, unknown>
  }
}

export type StudyAgentExternalReviewContext = NonNullable<StudyAgentExternalReviewStatus['external_review']>

export function getStudyAgentExternalReviewStatus(sessionId: string): Promise<StudyAgentExternalReviewStatus> {
  return httpGet<StudyAgentExternalReviewStatus>(
    `/study-agent/v1/concept-set-sessions/external-review/${encodeURIComponent(sessionId)}`,
  )
}

export function finalizeStudyAgentExternalReview(
  sessionId: string,
  conceptSetId: number | string,
): Promise<StudyAgentExternalReviewStatus> {
  return httpPost<StudyAgentExternalReviewStatus>(
    `/study-agent/v1/concept-set-sessions/external-review/${encodeURIComponent(sessionId)}/finalize?conceptSetId=${encodeURIComponent(String(conceptSetId))}`,
    {},
  )
}

export interface StudyAgentConceptSetProvenance {
  available: boolean
  provenance?: { goal?: string; review_revision?: number; last_active_at?: string; last_assistant_summary?: string; matches_current_expression?: boolean | null }
}

export function getStudyAgentConceptSetProvenance(conceptSetId: number | string): Promise<StudyAgentConceptSetProvenance> {
  return httpGet<StudyAgentConceptSetProvenance>(
    `/study-agent/v1/concept-set-sessions/context?conceptSetId=${encodeURIComponent(String(conceptSetId))}`,
  )
}
