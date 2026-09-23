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

export interface StudyAgentConceptSetProvenance {
  available: boolean
  provenance?: { goal?: string; review_revision?: number; last_active_at?: string; last_assistant_summary?: string; matches_current_expression?: boolean | null }
}

export function getStudyAgentConceptSetProvenance(conceptSetId: number | string): Promise<StudyAgentConceptSetProvenance> {
  return httpGet<StudyAgentConceptSetProvenance>(
    `/study-agent/v1/concept-set-sessions/context?conceptSetId=${encodeURIComponent(String(conceptSetId))}`,
  )
}
