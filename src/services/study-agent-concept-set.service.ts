import { httpPost } from '@/services/http-client'
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
