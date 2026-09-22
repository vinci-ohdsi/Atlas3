import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  applyStudyAgentConceptSetProposal,
  finalizeStudyAgentConceptSetProposal,
  continueStudyAgentConceptSetSession,
  requestStudyAgentConceptSetProposal,
  startStudyAgentConceptSetSession,
} from '@/services/study-agent-concept-set.service'
import type {
  ContinueStudyAgentConceptSetSessionRequest,
  StartStudyAgentConceptSetSessionRequest,
  StudyAgentConceptSetSessionResponse,
} from '@/models/study-agent.types'

/**
 * Transient editor state for a Study Agent-assisted concept-set draft. Durable
 * dialogue and provenance remain WebAPI-owned; this store holds only what the
 * current browser drawer needs to render.
 */
export const useStudyAgentConceptSetStore = defineStore('study-agent-concept-set', () => {
  const pendingNarrative = ref<string | null>(null)
  const session = ref<StudyAgentConceptSetSessionResponse | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const proposal = ref<unknown | null>(null)
  const appliedReviewRevision = ref<number | null>(null)

  function queueNarrative(narrative: string) {
    pendingNarrative.value = narrative
    session.value = null
    proposal.value = null
    appliedReviewRevision.value = null
    error.value = null
  }

  function consumePendingNarrative(): string | null {
    const narrative = pendingNarrative.value
    pendingNarrative.value = null
    return narrative
  }

  async function start(request: StartStudyAgentConceptSetSessionRequest) {
    loading.value = true
    error.value = null
    try {
      proposal.value = null
      appliedReviewRevision.value = null
      session.value = await startStudyAgentConceptSetSession(request)
      return session.value
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to contact /ohdsi.'
      throw caught
    } finally {
      loading.value = false
    }
  }

  async function reply(request: ContinueStudyAgentConceptSetSessionRequest) {
    if (!session.value?.session_id) {
      error.value = 'Start an /ohdsi session before continuing the dialogue.'
      return null
    }
    loading.value = true
    error.value = null
    try {
      session.value = await continueStudyAgentConceptSetSession(session.value.session_id, request)
      // A new reply can refine scope or policy. Its next proposal must not be
      // confused with the prior review material.
      proposal.value = null
      return session.value
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to contact /ohdsi.'
      throw caught
    } finally {
      loading.value = false
    }
  }

  async function requestProposal(targetDomain: string) {
    if (!session.value?.session_id) return null
    loading.value = true
    error.value = null
    try {
      const response = await requestStudyAgentConceptSetProposal(session.value.session_id, targetDomain)
      proposal.value = {
        ...(response.proposal as Record<string, unknown>),
        ...(response.review_revision !== undefined ? { review_revision: response.review_revision } : {}),
      }
      return proposal.value
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to request an /ohdsi proposal.'
      throw caught
    } finally { loading.value = false }
  }

  async function applyProposal(reviewRevision: number) {
    if (!session.value?.session_id) return null
    loading.value = true
    error.value = null
    try {
      const response = await applyStudyAgentConceptSetProposal(session.value.session_id, reviewRevision)
      appliedReviewRevision.value = response.review_revision
      return response
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to apply the /ohdsi proposal for review.'
      throw caught
    } finally { loading.value = false }
  }

  async function finalizeSavedConceptSet(conceptSetId: number | string) {
    if (!session.value?.session_id || appliedReviewRevision.value === null) return null
    loading.value = true
    error.value = null
    try {
      const response = await finalizeStudyAgentConceptSetProposal(
        session.value.session_id,
        appliedReviewRevision.value,
        conceptSetId,
      )
      appliedReviewRevision.value = null
      return response
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to record the saved /ohdsi review.'
      throw caught
    } finally { loading.value = false }
  }

  return { pendingNarrative, session, loading, error, proposal, appliedReviewRevision, queueNarrative, consumePendingNarrative, start, reply, requestProposal, applyProposal, finalizeSavedConceptSet }
})
