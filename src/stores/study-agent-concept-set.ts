import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  continueStudyAgentConceptSetSession,
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

  function queueNarrative(narrative: string) {
    pendingNarrative.value = narrative
    session.value = null
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
      return session.value
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : 'Unable to contact /ohdsi.'
      throw caught
    } finally {
      loading.value = false
    }
  }

  return { pendingNarrative, session, loading, error, queueNarrative, consumePendingNarrative, start, reply }
})
