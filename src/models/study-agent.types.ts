/**
 * Browser-facing contract for the review-gated Study Agent concept-set
 * assistant. The browser communicates only with WebAPI; ACP details are
 * deliberately absent from these types.
 */
export interface StudyAgentConceptSetDialogue {
  plan?: string
  answer?: string
  current_step_guidance?: string | string[]
  cautions?: string[]
  suggested_next_actions?: string[]
  follow_up_plan?: string
  artifact_requests?: string[]
}

export interface StudyAgentConceptSetSessionResponse {
  session_id: string
  state: string
  assistant_message?: string
  dialogue?: StudyAgentConceptSetDialogue
  allowed_actions?: string[]
}

export interface StartStudyAgentConceptSetSessionRequest {
  command: '/ohdsi'
  message: string
  ui_context: {
    route: 'concepts'
    tab: 'search' | 'concept-set-editor'
    mode: 'new' | 'extension'
    concept_set_id?: number | string
    source_key?: string
  }
}

export interface ContinueStudyAgentConceptSetSessionRequest {
  message: string
  answers?: Record<string, string>
}
