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
  questions?: StudyAgentConceptSetQuestion[]
  artifact_requests?: string[]
}

export interface StudyAgentConceptSetQuestion {
  id: string
  prompt: string
  options: string[]
}

export interface StudyAgentConceptSetDialogueMessage {
  actor: 'user' | 'assistant'
  message: string
}

export interface StudyAgentConceptSetSessionResponse {
  session_id: string
  state: string
  narrative?: string
  assistant_message?: string
  dialogue?: StudyAgentConceptSetDialogue
  dialogue_history?: StudyAgentConceptSetDialogueMessage[]
  allowed_actions?: string[]
}

export interface StudyAgentConceptSetInteractionProfile {
  bounded_proposal: {
    available: boolean
    local_vocabulary_search: boolean
    application: 'selected_review'
  }
  manual_concept_search: {
    available: boolean
  }
}

export const atlasConceptSetInteractionProfile: StudyAgentConceptSetInteractionProfile = {
  bounded_proposal: {
    available: true,
    local_vocabulary_search: true,
    application: 'selected_review',
  },
  manual_concept_search: {
    available: true,
  },
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
    interaction_profile: StudyAgentConceptSetInteractionProfile
  }
}

export interface ContinueStudyAgentConceptSetSessionRequest {
  message: string
  answers?: Record<string, string>
  ui_context?: Record<string, unknown>
}
