<template>
  <section class="study-agent-concept-set-tab">
    <div class="study-agent-concept-set-tab__intro">
      <h2>/ohdsi assistant</h2>
      <p>
        Describe the concept-set goal with <code>/ohdsi</code>. Suggestions are advisory;
        they do not change the selected expression.
      </p>
    </div>

    <template v-if="!hasSession">
      <AtlasAlert
        v-if="priorProvenance?.available && priorProvenance.provenance"
        :severity="priorProvenance.provenance.matches_current_expression === false ? 'warning' : 'info'"
        class="mb-4"
      >
        <strong>Previous /ohdsi context</strong>
        <p>Last goal: {{ priorProvenance.provenance.goal }}</p>
        <p v-if="priorProvenance.provenance.review_revision !== undefined">
          Last recorded review: revision {{ priorProvenance.provenance.review_revision }}.
        </p>
        <p v-if="priorProvenance.provenance.matches_current_expression === false">
          The current Selected expression differs from that reviewed revision. Start a new /ohdsi refinement to review and record the changed policy.
        </p>
        <p v-else>
          Start a new /ohdsi dialogue to refine this saved expression; the prior goal is provided as background, not as an active instruction.
        </p>
      </AtlasAlert>
      <AtlasTextField
        v-model="narrative"
        label="Concept-set goal"
        placeholder="/ohdsi help me find standard RxNorm concepts for bolus insulin"
        :disabled="assistant.loading"
        multiline
        :rows="4"
        variant="outlined"
        hide-details
      />

      <div class="study-agent-concept-set-tab__actions">
        <AtlasButton
          :disabled="!canSubmit || assistant.loading"
          :loading="assistant.loading"
          @click="submit"
        >
          Start /ohdsi
        </AtlasButton>
      </div>
    </template>

    <p
      v-else
      class="study-agent-concept-set-tab__goal"
    >
      <strong>Concept-set goal:</strong> {{ assistant.session?.narrative || narrative }}
    </p>

    <AtlasAlert
      v-if="assistant.error"
      severity="danger"
      class="mt-4"
    >
      {{ assistant.error }}
    </AtlasAlert>

    <div
      v-if="dialogueHistory.length"
      class="study-agent-concept-set-tab__transcript"
    >
      <h3>Dialogue</h3>
      <div
        v-for="(entry, index) in dialogueHistory"
        :key="`${entry.actor}-${index}`"
        class="study-agent-concept-set-tab__transcript-entry"
        :class="`study-agent-concept-set-tab__transcript-entry--${entry.actor}`"
      >
        <strong>{{ entry.actor === 'user' ? 'You' : '/ohdsi' }}</strong>
        <p>{{ entry.message }}</p>
      </div>
    </div>

    <div
      v-if="dialogue?.questions?.length"
      class="study-agent-concept-set-tab__response"
    >
      <h3>Clarify scope</h3>
      <div
        v-for="question in dialogue.questions"
        :key="question.id"
        class="study-agent-concept-set-tab__question"
      >
        <AtlasSelect
          v-model="answers[question.id]"
          :label="question.prompt"
          :items="question.options"
          :disabled="assistant.loading"
          clearable
          variant="outlined"
          hide-details
        />
      </div>
      <div class="study-agent-concept-set-tab__actions">
        <AtlasButton
          :disabled="!hasStructuredAnswers || assistant.loading"
          :loading="assistant.loading"
          @click="reply"
        >
          Submit scope to /ohdsi
        </AtlasButton>
      </div>
    </div>

    <div
      v-if="showComposer"
      ref="composerPanel"
      class="study-agent-concept-set-tab__follow-up"
    >
      <AtlasTextField
        v-model="followUp"
        :label="proposalAppliedForReview ? 'Ask /ohdsi about this review' : 'Continue /ohdsi dialogue'"
        :placeholder="proposalAppliedForReview
          ? 'For example: I reviewed Included and want to exclude these concepts.'
          : 'For example: include clinical drugs and exclude products containing protamine.'"
        :disabled="assistant.loading"
        multiline
        :rows="3"
        variant="outlined"
        hide-details
      />
      <div class="study-agent-concept-set-tab__actions">
        <AtlasButton
          :disabled="!canContinue || assistant.loading"
          :loading="assistant.loading"
          @click="reply"
        >
          {{ hasStructuredAnswers ? 'Submit answers to /ohdsi' : 'Continue /ohdsi' }}
        </AtlasButton>
        <AtlasButton
          v-if="proposalReviewAvailable"
          variant="secondary"
          class="ml-2"
          :disabled="assistant.loading"
          @click="hideDialogueComposer"
        >
          Return to proposal review
        </AtlasButton>
      </div>
    </div>
    <div
      v-if="proposalActionAvailable || (!proposalAppliedForReview && assistant.proposal)"
      class="study-agent-concept-set-tab__follow-up"
    >
      <AtlasSelect
        v-if="proposalActionAvailable"
        v-model="proposalDomain"
        label="Proposal domain"
        :items="proposalDomains"
        variant="outlined"
        hide-details
      />
      <p
        v-if="proposalActionAvailable"
        class="study-agent-concept-set-tab__proposal-choice"
      >
        Let <code>/ohdsi</code> search the local vocabulary and prepare a reviewable proposal, or continue the dialogue to refine the scope first.
      </p>
      <AtlasButton
        v-if="proposalActionAvailable"
        class="mt-4"
        :loading="assistant.loading"
        :disabled="assistant.loading || !proposalDomain"
        @click="requestProposal"
      >
        Request /ohdsi proposal
      </AtlasButton>
      <AtlasButton
        v-if="proposalActionAvailable && !showDialogueComposer"
        variant="secondary"
        class="mt-2"
        @click="showDialogueComposerForFollowUp"
      >
        Ask /ohdsi a follow-up instead
      </AtlasButton>
      <AtlasAlert
        v-if="assistant.proposal"
        severity="info"
        class="mt-4"
      >
        Proposal retrieved for review. It has not changed the concept set.
      </AtlasAlert>
      <div
        v-if="proposalData"
        class="study-agent-concept-set-tab__proposal-review"
      >
        <h3>Retrieved candidates ({{ proposalCandidates.length }} returned)</h3>
        <p class="study-agent-concept-set-tab__retrieval-note">
          This is a bounded retrieval slice, not a complete concept-set definition.
        </p>
        <ul
          v-if="retrievalRuns.length"
          class="study-agent-concept-set-tab__retrieval-runs"
        >
          <li
            v-for="run in retrievalRuns"
            :key="run.key"
          >
            <code>{{ run.term }}</code>: {{ run.returnedCount }} returned{{ run.matchedCount !== null ? ` of ${run.matchedCount} matched` : '' }} (request limit {{ run.limit }}).
          </li>
        </ul>
        <table v-if="proposalCandidates.length">
          <thead><tr><th>Concept ID</th><th>Name</th><th>Vocabulary</th><th>Domain</th><th>Class</th></tr></thead>
          <tbody>
            <tr
              v-for="candidate in proposalCandidates"
              :key="String(candidate.conceptId)"
            >
              <td>{{ candidate.conceptId }}</td><td>{{ candidate.conceptName }}</td><td>{{ candidate.vocabularyId }}</td><td>{{ candidate.domainId }}</td><td>{{ candidate.conceptClassId }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="extensionDiff">
          <h3>Proposed saved-set changes</h3>
          <p class="study-agent-concept-set-tab__retrieval-note">
            {{ extensionDiff.base_item_count }} saved policy rows are retained as the base. Only the validated changes below will be merged.
          </p>
          <ul class="study-agent-concept-set-tab__retrieval-runs">
            <li><strong>Additions:</strong> {{ extensionAdditions.length }}</li>
            <li><strong>Policy flag changes:</strong> {{ extensionPolicyChanges.length }}</li>
            <li><strong>Removals:</strong> {{ extensionRemovals.length }} (none are made implicitly)</li>
          </ul>
        </div>
        <h3 v-if="proposalItems.length">
          Provisional policy
        </h3>
        <table v-if="proposalItems.length">
          <thead><tr><th>Concept ID</th><th>Policy</th><th>Rationale</th></tr></thead>
          <tbody>
            <tr
              v-for="item in proposalItems"
              :key="String(item.concept_id)"
            >
              <td>{{ item.concept_id }}</td><td>{{ item.is_excluded ? 'Exclude' : 'Include' }}{{ item.include_descendants ? ' + descendants' : '' }}{{ item.include_mapped ? ' + mapped' : '' }}</td><td>{{ item.rationale }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="assistant.proposal"
        class="study-agent-concept-set-tab__proposal-note"
      >
        Review the candidate and policy details above. Selected has not changed.
      </p>
      <AtlasAlert
        v-if="canApplyProposal"
        severity="warning"
        class="mt-4"
      >
        <p>
          {{ props.mode === 'extension'
            ? 'Would you like to merge these validated changes into the saved expression in Selected, then review the resolved extension in Included?'
            : 'Would you like to initialize this new draft in Selected and review its resolved extension in Included?' }}
        </p>
        <AtlasButton
          :loading="assistant.loading"
          :disabled="assistant.loading"
          @click="applyProposal"
        >
          {{ props.mode === 'extension' ? 'Merge validated changes into Selected for review' : 'Apply validated proposal to Selected for review' }}
        </AtlasButton>
      </AtlasAlert>
      <AtlasAlert
        v-else-if="applyUnavailableReason && !proposalAppliedForReview"
        severity="warning"
        class="mt-4"
      >
        <p>{{ applyUnavailableReason }}</p>
        <AtlasButton
          v-if="!showDialogueComposer"
          variant="secondary"
          @click="showDialogueComposerForFollowUp"
        >
          Refine this proposal with /ohdsi
        </AtlasButton>
      </AtlasAlert>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { AtlasAlert, AtlasButton, AtlasSelect, AtlasTextField } from '@/components/ui'
import { useStudyAgentConceptSetStore } from '@/stores/study-agent-concept-set'
import { atlasConceptSetInteractionProfile } from '@/models/study-agent.types'
import { getStudyAgentConceptSetProvenance, type StudyAgentConceptSetProvenance } from '@/services/study-agent-concept-set.service'

interface Props {
  active: boolean
  mode: 'new' | 'extension'
  conceptSetId?: number | string
  sourceKey?: string
  expressionSummary?: Record<string, unknown>
}

const props = defineProps<Props>()
const emit = defineEmits<{ proposalApplied: [expression: unknown] }>()
const assistant = useStudyAgentConceptSetStore()
const narrative = ref('')
const followUp = ref('')
const answers = ref<Record<string, string>>({})
const proposalDomain = ref('')
const proposalAppliedForReview = ref(false)
const showDialogueComposer = ref(false)
const composerPanel = ref<HTMLElement | null>(null)
const priorProvenance = ref<StudyAgentConceptSetProvenance | null>(null)
const proposalDomains = ['Drug', 'Condition', 'Measurement', 'Procedure', 'Observation']
const canSubmit = computed(() => narrative.value.trim().toLowerCase().startsWith('/ohdsi '))
const hasSession = computed(() => !!assistant.session?.session_id)
watch(
  () => [props.active, props.mode, props.conceptSetId] as const,
  async ([active, mode, conceptSetId]) => {
    if (!active || mode !== 'extension' || conceptSetId === undefined || hasSession.value) return
    try { priorProvenance.value = await getStudyAgentConceptSetProvenance(conceptSetId) }
    catch { priorProvenance.value = null }
  },
  { immediate: true },
)

const dialogue = computed(() => assistant.session?.dialogue)
const canReply = computed(() => assistant.session?.allowed_actions?.includes('reply') ?? false)
const canRequestProposal = computed(() => canReply.value && !(dialogue.value?.questions?.length))
const proposalActionAvailable = computed(() => canRequestProposal.value && !assistant.proposal && !proposalAppliedForReview.value)
const proposalReviewAvailable = computed(() => !!assistant.proposal && !proposalAppliedForReview.value)
const showComposer = computed(() => canReply.value && !dialogue.value?.questions?.length && (
  showDialogueComposer.value || (!proposalActionAvailable.value && !proposalReviewAvailable.value)
))
const proposalData = computed(() => assistant.proposal as Record<string, unknown> | null)
const proposalCandidates = computed(() => Array.isArray(proposalData.value?.candidates) ? proposalData.value.candidates as Array<Record<string, unknown>> : [])
const proposalItems = computed(() => Array.isArray(proposalData.value?.proposed_items) ? proposalData.value.proposed_items as Array<Record<string, unknown>> : [])
const proposalValidationPassed = computed(() => (proposalData.value?.validation as Record<string, unknown> | undefined)?.status === 'passed')
const reviewRevision = computed(() => typeof proposalData.value?.review_revision === 'number' ? proposalData.value.review_revision : null)
const retrievalRuns = computed(() => {
  const provenance = proposalData.value?.candidate_provenance as Record<string, unknown> | undefined
  const perTerm = Array.isArray(provenance?.per_term) ? provenance.per_term as Array<Record<string, unknown>> : []
  return perTerm.map((run, index) => ({
    key: `${String(run.term ?? 'query')}-${index}`,
    term: String(run.term ?? 'query'),
    returnedCount: Number(run.returned_count ?? 0),
    matchedCount: typeof run.matched_count === 'number' ? run.matched_count : null,
    limit: Number(run.limit ?? 0),
  }))
})
const applyUnavailableReason = computed(() => {
  if (!assistant.proposal) return ''
  if (!proposalItems.value.length) {
    return 'No provisional policy was validated from this retrieval slice, so there is nothing safe to apply to Selected. Refine the scope or request another bounded proposal.'
  }
  if (!proposalValidationPassed.value) {
    return 'This provisional policy did not pass technical validation, so it cannot be applied to Selected.'
  }
  if (reviewRevision.value === null) {
    return 'This proposal has not been persisted as a review revision, so it cannot be applied to Selected.'
  }
  if (props.mode === 'new' && Number(props.expressionSummary?.selected_item_count ?? 0) !== 0) {
    return 'Applying a proposal to a new draft requires an empty Selected expression.'
  }
  if (props.mode === 'extension' && !extensionDiff.value) {
    return 'This proposal was not grounded in the saved concept-set expression. Refine it or request a new bounded proposal before merging changes.'
  }
  return ''
})
const extensionDiff = computed(() => {
  const value = proposalData.value?.extension_diff
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
})
const extensionAdditions = computed(() => Array.isArray(extensionDiff.value?.additions) ? extensionDiff.value.additions : [])
const extensionPolicyChanges = computed(() => Array.isArray(extensionDiff.value?.policy_changes) ? extensionDiff.value.policy_changes : [])
const extensionRemovals = computed(() => Array.isArray(extensionDiff.value?.removals) ? extensionDiff.value.removals : [])
const canApplyProposal = computed(() => (
  (props.mode === 'new' ? Number(props.expressionSummary?.selected_item_count ?? 0) === 0 : !!extensionDiff.value)
  && proposalItems.value.length > 0
  && proposalValidationPassed.value
  && reviewRevision.value !== null
))
const dialogueHistory = computed(() => {
  const history = [...(assistant.session?.dialogue_history ?? [])]
  if (proposalAppliedForReview.value) {
    history.push({
      actor: 'assistant' as const,
      message: 'The validated proposal is now in Selected. Review the policy rows and the Included extension. You can edit normally, or ask /ohdsi about the reviewed expression.',
    })
  }
  return history
})
const structuredAnswers = computed(() => Object.fromEntries(
  Object.entries(answers.value).filter(([, answer]) => answer.trim()),
))
const hasStructuredAnswers = computed(() => Object.keys(structuredAnswers.value).length > 0)
const canContinue = computed(() => !!followUp.value.trim() || hasStructuredAnswers.value)

async function showDialogueComposerForFollowUp() {
  showDialogueComposer.value = true
  await nextTick()
  composerPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const input = composerPanel.value?.querySelector('textarea, input') as HTMLInputElement | HTMLTextAreaElement | null
  input?.focus()
}

function hideDialogueComposer() {
  showDialogueComposer.value = false
  followUp.value = ''
}

async function submit() {
  if (!canSubmit.value) return
  try {
    await assistant.start({
      command: '/ohdsi',
      message: narrative.value.trim().slice('/ohdsi'.length).trim(),
      ui_context: {
        route: 'concepts',
        tab: 'concept-set-editor',
        mode: props.mode,
        ...(props.conceptSetId !== undefined ? { concept_set_id: props.conceptSetId } : {}),
        ...(props.sourceKey ? { source_key: props.sourceKey } : {}),
        interaction_profile: atlasConceptSetInteractionProfile,
      },
    })
  } catch {
    // The store retains a user-facing error; avoid a second unhandled UI error.
  }
}

async function reply() {
  const wasReviewGuidance = proposalAppliedForReview.value
  const answerSummary = Object.entries(structuredAnswers.value)
    .map(([questionId, answer]) => `${questionId}: ${answer}`)
    .join('; ')
  const message = followUp.value.trim() || `Clarification responses: ${answerSummary}`
  try {
    await assistant.reply({
      message,
      ...(hasStructuredAnswers.value ? { answers: structuredAnswers.value } : {}),
      ui_context: {
        route: 'concepts',
        tab: 'concept-set-editor',
        mode: props.mode,
        ...(props.conceptSetId !== undefined ? { concept_set_id: props.conceptSetId } : {}),
        ...(props.sourceKey ? { source_key: props.sourceKey } : {}),
        expression_summary: props.expressionSummary ?? { selected_item_count: 0, selected_items: [] },
      },
    })
    followUp.value = ''
    answers.value = {}
    // A fresh ACP response is now grounded in the populated Selected summary,
    // so replace the deterministic transition card with that context-aware guidance.
    if (wasReviewGuidance) proposalAppliedForReview.value = false
  } catch {
    // The store retains a user-facing error; avoid a second unhandled UI error.
  }
}

async function requestProposal() {
  proposalAppliedForReview.value = false
  showDialogueComposer.value = false
  try { await assistant.requestProposal(proposalDomain.value) } catch { /* store holds the user-facing error */ }
}

async function applyProposal() {
  if (!canApplyProposal.value || reviewRevision.value === null) return
  try {
    const result = await assistant.applyProposal(reviewRevision.value)
    if (result?.validation?.status === 'passed') {
      proposalAppliedForReview.value = true
      emit('proposalApplied', result.expression)
    }
  } catch {
    // The store retains a user-facing error; avoid a second unhandled UI error.
  }
}

watch(
  () => props.active,
  async active => {
    if (!active) return
    const queued = assistant.consumePendingNarrative()
    if (!queued) return
    narrative.value = queued
  },
  { immediate: true },
)
</script>

<style scoped>
.study-agent-concept-set-tab { max-width: 860px; padding: 24px; }
.study-agent-concept-set-tab__intro h2, .study-agent-concept-set-tab__response h3, .study-agent-concept-set-tab__transcript h3 { color: rgb(var(--v-theme-primary)); }
.study-agent-concept-set-tab__intro p { color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-concept-set-tab__actions { margin-top: 16px; }
.study-agent-concept-set-tab__goal { margin-top: 20px; padding: 12px 16px; border-radius: 4px; background: rgb(var(--v-theme-surface-variant)); }
.study-agent-concept-set-tab__transcript { margin-top: 24px; }
.study-agent-concept-set-tab__transcript-entry { margin-top: 12px; padding: 12px 16px; border-left: 3px solid rgb(var(--v-theme-primary)); background: rgb(var(--v-theme-surface-variant)); }
.study-agent-concept-set-tab__transcript-entry--user { border-left-color: rgb(var(--v-theme-secondary)); }
.study-agent-concept-set-tab__transcript-entry p { margin: 4px 0 0; white-space: pre-wrap; }
.study-agent-concept-set-tab__response { margin-top: 24px; border-top: 1px solid rgb(var(--v-theme-outline-variant)); padding-top: 20px; }
.study-agent-concept-set-tab__question { margin-top: 16px; }
.study-agent-concept-set-tab__proposal-review { margin-top: 16px; overflow: auto; }
.study-agent-concept-set-tab__proposal-review table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.study-agent-concept-set-tab__proposal-review th, .study-agent-concept-set-tab__proposal-review td { padding: 8px; border-bottom: 1px solid rgb(var(--v-theme-outline-variant)); text-align: left; vertical-align: top; }
.study-agent-concept-set-tab__proposal-note { margin-top: 12px; font-weight: 600; }
.study-agent-concept-set-tab__proposal-choice { margin: 12px 0 0; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-concept-set-tab__retrieval-note { margin: 8px 0 0; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-concept-set-tab__retrieval-runs { margin: 8px 0 16px; padding-left: 20px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-concept-set-tab__follow-up { margin-top: 24px; border-top: 1px solid rgb(var(--v-theme-outline-variant)); padding-top: 20px; }
</style>
