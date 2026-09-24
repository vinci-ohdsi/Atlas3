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


/** Browser-facing cohort-definition acquisition contract. WebAPI owns sessions and proxies ACP. */
export type StudyAgentCohortRoute = 'ai_search' | 'library' | 'make_computable'

export interface StudyAgentPhenotypeCandidate {
  phenotype_id: string
  phenotype_name: string
  source_dataset?: string
  short_description?: string
  justification?: string
  confidence?: number | null
  computability_status: 'circe_available' | 'conversion_required' | 'not_computable'
  executable_definition_status?: string
  execution_readiness_score?: number | null
  source_status?: string
  signals?: string[]
  adaptation_notes?: string
  long_description?: string
  methodology_summary?: string
  recommendation_summary?: string
}

export interface StudyAgentCohortSession {
  session_id: string
  route: StudyAgentCohortRoute
  narrative: string
  state: string
}

export interface StudyAgentCohortDraft {
  session_id: string
  review_revision: number
  name: string
  expression: import('@/models/circe-types').CohortExpression
  expression_checksum: string
}

/** Read-only link between a saved cohort and its original /ohdsi review. */
export interface StudyAgentCohortCritiqueFinding {
  id?: string
  severity?: 'low' | 'medium' | 'high' | string
  impact?: string
  message?: string
}

export interface StudyAgentCohortCritiquePatchNote {
  path?: string
  value?: {
    summary?: string
    details?: string
  }
}

export interface StudyAgentCohortCritiquePatch {
  artifact?: string
  type?: string
  ops?: StudyAgentCohortCritiquePatchNote[]
}

export interface StudyAgentCohortCritique {
  plan?: string
  findings?: StudyAgentCohortCritiqueFinding[]
  patches?: StudyAgentCohortCritiquePatch[]
  risk_notes?: string[]
}

export interface StudyAgentCohortProvenance {
  linked: boolean
  review_revision?: number
  source_type?: string
  acquisition_route?: StudyAgentCohortRoute
  phenotype_id?: string | null
  phenotype_name?: string | null
  computability_status?: string
  expression_checksum?: string
  expression_matches_review?: boolean
  narrative?: string
  created_at?: string
  approved_at?: string
}
