<template>
  <AtlasDialog
    v-model="open"
    eyebrow="/ohdsi"
    title="Start cohort-definition authoring"
    max-width="860"
    @close="reset"
  >
    <p class="study-agent-cohort-dialog__hint">
      Describe the cohort you want to define. Choose how you want to acquire a reviewable starting definition.
    </p>
    <AtlasTextField
      v-model="narrative"
      label="Cohort narrative"
      multiline
      :rows="4"
      variant="outlined"
      :disabled="loading"
      data-testid="study-agent-cohort-narrative"
    />
    <div class="study-agent-cohort-dialog__routes">
      <button
        v-for="option in routes"
        :key="option.value"
        type="button"
        class="study-agent-cohort-dialog__route"
        :class="{ 'study-agent-cohort-dialog__route--selected': route === option.value }"
        :disabled="loading"
        @click="route = option.value"
      >
        <strong>{{ option.title }}</strong><span>{{ option.detail }}</span>
      </button>
    </div>
    <AtlasAlert
      v-if="error"
      severity="danger"
      density="compact"
      class="mt-3"
    >
      {{ error }}
    </AtlasAlert>
    <AtlasAlert
      v-if="route === 'make_computable'"
      severity="info"
      density="compact"
      class="mt-3"
    >
      New computable definition authoring is review-gated. /ohdsi will first collect scope decisions; no candidate policy or Circe draft is emitted at this step.
    </AtlasAlert>
    <section
      v-if="scopeQuestions.length"
      class="study-agent-cohort-dialog__scope"
    >
      <h3>Clarify scope before candidate review</h3>
      <p>
        The new computable-definition path is review-gated. Answer these decisions before any vocabulary candidates, concept policies, or Circe draft can be produced.
      </p>
      <ul>
        <li
          v-for="question in scopeQuestions"
          :key="question"
        >
          {{ question }}
        </li>
      </ul>
      <div class="study-agent-cohort-dialog__scope-grid">
        <AtlasTextField
          v-model="scope.indexEvent"
          label="Index event (your clinical term)"
          variant="outlined"
        />
        <AtlasSelect
          v-model="scope.domain"
          label="OMOP domain"
          :items="domains"
          variant="outlined"
        />
        <AtlasSelect
          v-model="scope.entryLimit"
          label="Entry-event rule"
          :items="['First', 'All']"
          variant="outlined"
        />
        <AtlasTextField
          :model-value="scope.priorObservation ?? undefined"
          label="Prior continuous observation (days)"
          type="number"
          min="0"
          variant="outlined"
          @update:model-value="(value) => { scope.priorObservation = value === '' || value == null ? null : Number(value) }"
        />
        <AtlasSelect
          v-model="scope.indexDayBoundary"
          label="Index-day boundary"
          :items="['included', 'excluded']"
          variant="outlined"
        />
        <AtlasSelect
          v-model="scope.exitStrategy"
          label="Exit strategy"
          :items="['observation', 'end_of_observation']"
          variant="outlined"
        />
      </div>
      <AtlasCheckbox
        v-model="scope.windowsNone"
        class="study-agent-cohort-dialog__confirm"
        label="I confirm this v1 definition uses no additional temporal windows."
      />
      <AtlasCheckbox
        v-model="scope.confirmed"
        class="study-agent-cohort-dialog__confirm"
        label="I confirm these scope choices are intentional and ready for candidate retrieval."
      />
      <AtlasButton
        class="mt-3"
        :disabled="!canRequestCandidateReview || loading"
        :loading="loading"
        @click="requestCandidateReview"
      >
        Request candidate review
      </AtlasButton>
    </section>
    <section
      v-if="conceptCandidates.length"
      class="study-agent-cohort-dialog__results"
    >
      <h3>Review vocabulary candidates</h3>
      <p>This is a bounded retrieval slice, not a complete concept set. Select only the policies you approve; no choice is inferred.</p>
      <article
        v-for="candidate in conceptCandidates"
        :key="candidate.concept_id"
        class="study-agent-cohort-dialog__candidate"
      >
        <div><strong>{{ candidate.concept_name }}</strong><p>{{ candidate.vocabulary_id }} · {{ candidate.domain_id }} · {{ candidate.concept_class_id }}</p></div>
        <div class="study-agent-cohort-dialog__policy">
          <AtlasCheckbox
            :model-value="candidate.include"
            label="Include"
            hide-details
            @update:model-value="(value) => setIncludePolicy(candidate, value)"
          />
          <AtlasCheckbox
            v-model="candidate.descendants"
            :disabled="!candidate.include"
            label="Descendants"
            hide-details
          />
          <AtlasCheckbox
            v-model="candidate.mapped"
            :disabled="!candidate.include"
            label="Mapped"
            hide-details
          />
          <AtlasCheckbox
            :model-value="candidate.exclude"
            label="Exclude"
            hide-details
            @update:model-value="(value) => setExcludePolicy(candidate, value)"
          />
        </div>
      </article>
      <AtlasButton
        class="mt-3"
        :disabled="!hasReviewedPolicies || loading"
        @click="showPolicyConfirmation = true"
      >
        Review selected policies
      </AtlasButton>
      <AtlasAlert
        v-if="showPolicyConfirmation"
        severity="info"
        density="compact"
        class="mt-3"
      >
        You selected {{ selectedPolicyCount }} policy row{{ selectedPolicyCount === 1 ? '' : 's' }}. Confirming sends this exact reviewed policy to /ohdsi for technical validation and creates an unsaved Atlas draft; it does not save a cohort definition.
        <AtlasButton
          class="ml-2"
          :disabled="loading"
          :loading="loading"
          @click="createComputableDraft"
        >
          Confirm policies and create draft
        </AtlasButton>
      </AtlasAlert>
    </section>
    <section
      v-if="candidates.length"
      class="study-agent-cohort-dialog__results"
    >
      <h3>{{ route === 'library' ? 'Phenotype library matches' : 'AI-supported shortlist' }}</h3>
      <details
        v-if="route === 'ai_search'"
        class="study-agent-cohort-dialog__label-help"
      >
        <summary>About these recommendation labels</summary>
        <p><strong>Circe available:</strong> a native OHDSI cohort definition can be opened as an unsaved Atlas draft. It still requires local clinical and technical review.</p>
        <p><strong>Conversion required:</strong> the source contributes narrative or code evidence, but does not provide an executable OHDSI/Circe definition.</p>
        <p><strong>Not computable:</strong> no executable definition is linked to this source record.</p>
        <p><strong>In review:</strong> the source record is marked as pending or otherwise not final. It is not a clinical-validity endorsement.</p>
        <p>The shortlist is intentionally opinionated. You can inspect the other ranked candidates below, browse the library, or search again.</p>
      </details>
      <article
        v-for="candidate in candidates"
        :key="candidate.phenotype_id"
        class="study-agent-cohort-dialog__candidate"
      >
        <div>
          <strong>{{ candidate.phenotype_name }}</strong>
          <p v-if="candidate.short_description">
            {{ candidate.short_description }}
          </p>
          <small
            v-if="candidate.source_dataset"
            class="study-agent-cohort-dialog__candidate-source"
          >Source: {{ sourceLabel(candidate.source_dataset) }}</small>
          <details
            v-if="hasCandidateDetails(candidate)"
            class="study-agent-cohort-dialog__candidate-details"
          >
            <summary>Details</summary>
            <p v-if="sourceStatusLabel(candidate.source_status)">
              Source review status: {{ sourceStatusLabel(candidate.source_status) }}
            </p>
            <p v-if="candidate.long_description">
              <strong>Description:</strong> {{ candidate.long_description }}
            </p>
            <p v-if="candidate.methodology_summary">
              <strong>Methodology:</strong> {{ candidate.methodology_summary }}
            </p>
            <p v-if="candidate.recommendation_summary">
              <strong>Recommendation context:</strong> {{ candidate.recommendation_summary }}
            </p>
            <p v-if="candidate.adaptation_notes">
              {{ candidate.adaptation_notes }}
            </p>
          </details>
        </div>
        <div class="study-agent-cohort-dialog__candidate-actions">
          <AtlasChip
            size="sm"
            :tone="candidate.computability_status === 'circe_available' ? 'success' : 'warning'"
          >
            {{ label(candidate.computability_status) }}
          </AtlasChip>
          <AtlasChip
            v-if="sourceStatusLabel(candidate.source_status)"
            size="sm"
            tone="warning"
          >
            {{ sourceReviewLabel(candidate.source_status) }}
          </AtlasChip>
          <AtlasButton
            v-if="candidate.computability_status === 'circe_available'"
            size="sm"
            :loading="importingId === candidate.phenotype_id"
            @click="importDraft(candidate)"
          >
            Open unsaved draft
          </AtlasButton>
        </div>
      </article>
      <AtlasButton
        v-if="route === 'ai_search' && rankedCandidates.length"
        variant="secondary"
        class="mt-3"
        @click="showRankedCandidates = !showRankedCandidates"
      >
        {{ showRankedCandidates ? 'Hide agent-planned alternatives' : `Show ${rankedCandidates.length} agent-planned alternative${rankedCandidates.length === 1 ? '' : 's'}` }}
      </AtlasButton>
      <section
        v-if="route === 'ai_search' && showRankedCandidates"
        class="study-agent-cohort-dialog__ranked"
      >
        <h4>Other agent-planned candidates</h4>
        <p>These were considered during /ohdsi planning but were not promoted into the final recommendations.</p>
        <article
          v-for="candidate in rankedCandidates"
          :key="candidate.phenotype_id"
          class="study-agent-cohort-dialog__candidate"
        >
          <div>
            <strong>{{ candidate.phenotype_name }}</strong>
            <p v-if="candidate.short_description">
              {{ candidate.short_description }}
            </p>
            <small
              v-if="candidate.source_dataset"
              class="study-agent-cohort-dialog__candidate-source"
            >Source: {{ sourceLabel(candidate.source_dataset) }}</small>
            <details
              v-if="hasCandidateDetails(candidate)"
              class="study-agent-cohort-dialog__candidate-details"
            >
              <summary>Details</summary>
              <p v-if="sourceStatusLabel(candidate.source_status)">
                Source review status: {{ sourceStatusLabel(candidate.source_status) }}
              </p>
              <p v-if="candidate.long_description">
                <strong>Description:</strong> {{ candidate.long_description }}
              </p>
              <p v-if="candidate.methodology_summary">
                <strong>Methodology:</strong> {{ candidate.methodology_summary }}
              </p>
              <p v-if="candidate.recommendation_summary">
                <strong>Recommendation context:</strong> {{ candidate.recommendation_summary }}
              </p>
              <p v-if="candidate.adaptation_notes">
                {{ candidate.adaptation_notes }}
              </p>
            </details>
          </div>
          <div class="study-agent-cohort-dialog__candidate-actions">
            <AtlasChip
              size="sm"
              :tone="candidate.computability_status === 'circe_available' ? 'success' : 'warning'"
            >
              {{ label(candidate.computability_status) }}
            </AtlasChip>
            <AtlasButton
              v-if="candidate.computability_status === 'circe_available'"
              size="sm"
              :loading="importingId === candidate.phenotype_id"
              @click="importDraft(candidate)"
            >
              Open unsaved draft
            </AtlasButton>
          </div>
        </article>
      </section>
      <AtlasButton
        v-if="route === 'ai_search' && retrievalCandidates.length"
        variant="secondary"
        class="mt-3"
        @click="showRetrievalCandidates = !showRetrievalCandidates"
      >
        {{ showRetrievalCandidates ? 'Hide retrieval-ranked alternatives' : `Show ${retrievalCandidates.length} retrieval-ranked alternative${retrievalCandidates.length === 1 ? '' : 's'}` }}
      </AtlasButton>
      <section
        v-if="route === 'ai_search' && showRetrievalCandidates"
        class="study-agent-cohort-dialog__ranked"
      >
        <h4>More retrieval-ranked alternatives</h4>
        <p>These are high-ranking retrieval results. /ohdsi did not promote them into its agent-planned or final recommendations.</p>
        <article
          v-for="candidate in retrievalCandidates"
          :key="candidate.phenotype_id"
          class="study-agent-cohort-dialog__candidate"
        >
          <div>
            <strong>{{ candidate.phenotype_name }}</strong>
            <p v-if="candidate.short_description">
              {{ candidate.short_description }}
            </p>
            <small
              v-if="candidate.source_dataset"
              class="study-agent-cohort-dialog__candidate-source"
            >Source: {{ sourceLabel(candidate.source_dataset) }}</small>
            <details
              v-if="hasCandidateDetails(candidate)"
              class="study-agent-cohort-dialog__candidate-details"
            >
              <summary>Details</summary>
              <p v-if="sourceStatusLabel(candidate.source_status)">
                Source review status: {{ sourceStatusLabel(candidate.source_status) }}
              </p>
              <p v-if="candidate.long_description">
                <strong>Description:</strong> {{ candidate.long_description }}
              </p>
              <p v-if="candidate.methodology_summary">
                <strong>Methodology:</strong> {{ candidate.methodology_summary }}
              </p>
              <p v-if="candidate.recommendation_summary">
                <strong>Recommendation context:</strong> {{ candidate.recommendation_summary }}
              </p>
              <p v-if="candidate.adaptation_notes">
                {{ candidate.adaptation_notes }}
              </p>
            </details>
          </div>
          <div class="study-agent-cohort-dialog__candidate-actions">
            <AtlasChip
              size="sm"
              :tone="candidate.computability_status === 'circe_available' ? 'success' : 'warning'"
            >
              {{ label(candidate.computability_status) }}
            </AtlasChip>
            <AtlasButton
              v-if="candidate.computability_status === 'circe_available'"
              size="sm"
              :loading="importingId === candidate.phenotype_id"
              @click="importDraft(candidate)"
            >
              Open unsaved draft
            </AtlasButton>
          </div>
        </article>
      </section>
      <AtlasButton
        v-if="route === 'ai_search'"
        variant="secondary"
        class="mt-3"
        :disabled="loading"
        :loading="loading"
        @click="loadNextRankedWindow"
      >
        Load next ranked window
      </AtlasButton>
    </section>
    <template #actions>
      <AtlasButton
        variant="ghost"
        :disabled="loading"
        @click="reset"
      >
        Cancel
      </AtlasButton>
      <AtlasButton
        v-if="!scopeQuestions.length && !conceptCandidates.length"
        :disabled="!narrative.trim() || loading"
        :loading="loading"
        data-testid="study-agent-cohort-start"
        @click="run"
      >
        {{ primaryActionLabel }}
      </AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AtlasAlert, AtlasButton, AtlasCheckbox, AtlasChip, AtlasDialog, AtlasSelect, AtlasTextField } from '@/components/ui'
import { importStudyAgentPhenotypeDraft, requestStudyAgentCohortRecommendations, searchStudyAgentPhenotypeLibrary, startStudyAgentCohortSession, continueStudyAgentMakeComputable } from '@/services/study-agent-cohort-definition.service'
import type { StudyAgentCohortRoute, StudyAgentPhenotypeCandidate } from '@/models/study-agent.types'

const open = defineModel<boolean>({ required: true })
const router = useRouter()
const narrative = ref('')
const route = ref<StudyAgentCohortRoute>('ai_search')
const loading = ref(false)
const importingId = ref<string | null>(null)
const error = ref('')
const candidates = ref<StudyAgentPhenotypeCandidate[]>([])
const rankedCandidates = ref<StudyAgentPhenotypeCandidate[]>([])
const retrievalCandidates = ref<StudyAgentPhenotypeCandidate[]>([])
const showRankedCandidates = ref(false)
const showRetrievalCandidates = ref(false)
const candidateOffset = ref(0)
const lastSearchedNarrative = ref('')
const scopeQuestions = ref<string[]>([])
const scope = ref({ indexEvent: '', domain: '', entryLimit: '', priorObservation: null as number | null, indexDayBoundary: '', exitStrategy: '', windowsNone: false, confirmed: false })
const conceptCandidates = ref<Array<{ concept_id: number; concept_name: string; vocabulary_id: string; domain_id: string; concept_class_id: string; include: boolean; descendants: boolean; mapped: boolean; exclude: boolean }>>([])
const showPolicyConfirmation = ref(false)
const domains = ['Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Visit', 'Device']
let sessionId = ''
const routes: Array<{ value: StudyAgentCohortRoute; title: string; detail: string }> = [
  { value: 'ai_search', title: 'AI-supported search', detail: 'Rank likely existing phenotype definitions for review.' },
  { value: 'library', title: 'Browse phenotype library', detail: 'Search the local library directly without AI ranking.' },
  { value: 'make_computable', title: 'Create a new computable definition', detail: 'Begin a review-gated narrative-to-Circe workflow.' },
]
function label(value: string) { return value === 'circe_available' ? 'Circe available' : value === 'conversion_required' ? 'Conversion required' : 'Not computable' }
function sourceLabel(value: string) {
  return value === 'ohdsi_phenotype_library' ? 'OHDSI Phenotype Library'
    : value === 'va_cipher' ? 'VA CIPHER'
      : value.replace(/_/g, ' ')
}
function sourceStatusLabel(value: string | undefined) {
  const normalized = String(value ?? '').trim()
  // CIPHER's numeric catalog status has no versioned display mapping in this client.
  // Do not show opaque codes as if they were a human review state.
  return /^\d+$/.test(normalized) ? '' : normalized
}
function sourceReviewLabel(value: string | undefined) {
  const status = sourceStatusLabel(value)
  return status === 'Pending' || status === 'Pending peer review' ? 'In review' : status
}
function hasCandidateDetails(candidate: StudyAgentPhenotypeCandidate) {
  return Boolean(
    sourceStatusLabel(candidate.source_status)
    || candidate.long_description
    || candidate.methodology_summary
    || candidate.recommendation_summary
    || candidate.adaptation_notes,
  )
}
function statusFromSignals(signals: unknown): string {
  return Array.isArray(signals)
    ? String(signals.find(signal => String(signal).toLowerCase().startsWith('status:')) ?? '').split(':').slice(1).join(':').trim()
    : ''
}
function candidateFromUnknown(value: unknown): StudyAgentPhenotypeCandidate | null {
  if (!value || typeof value !== 'object' || typeof (value as Record<string, unknown>).phenotype_id !== 'string') return null
  const row = value as Record<string, unknown>
  const executable = String(row.executable_definition_status ?? '')
  return {
    phenotype_id: String(row.phenotype_id),
    phenotype_name: String(row.phenotype_name ?? row.name ?? ''),
    source_dataset: typeof row.source_dataset === 'string' ? row.source_dataset : '',
    short_description: typeof row.short_description === 'string' ? row.short_description : '',
    justification: typeof row.justification === 'string' ? row.justification : '',
    computability_status: row.computability_status === 'circe_available' || row.computability_status === 'conversion_required' || row.computability_status === 'not_computable'
      ? row.computability_status
      : executable === 'native_ohdsi' ? 'circe_available'
        : ['codes_only', 'narrative_only', 'non_ohdsi_logic_only'].includes(executable) ? 'conversion_required' : 'not_computable',
    executable_definition_status: executable,
    execution_readiness_score: typeof row.execution_readiness_score === 'number' ? row.execution_readiness_score : null,
    source_status: typeof row.source_status === 'string' ? row.source_status : statusFromSignals(row.signals),
    signals: Array.isArray(row.signals) ? row.signals.filter((signal): signal is string => typeof signal === 'string') : [],
    adaptation_notes: typeof row.adaptation_notes === 'string' ? row.adaptation_notes : '',
    long_description: typeof row.long_description === 'string' ? row.long_description : '',
    methodology_summary: typeof row.methodology_summary === 'string' ? row.methodology_summary : '',
    recommendation_summary: typeof row.recommendation_summary === 'string' ? row.recommendation_summary : '',
  }
}
function normalize(response: Record<string, unknown>, selectedRoute: StudyAgentCohortRoute): StudyAgentPhenotypeCandidate[] {
  const source = selectedRoute === 'library' ? response.catalog : response.recommendations
  const payload = source && typeof source === 'object' ? source as Record<string, unknown> : {}
  const rows = (payload.candidates ?? payload.phenotype_recommendations ?? (payload.recommendations as Record<string, unknown> | undefined)?.phenotype_recommendations)
  return Array.isArray(rows) ? rows.map(candidateFromUnknown).filter((row): row is StudyAgentPhenotypeCandidate => row !== null) : []
}
function responseRecommendation(response: Record<string, unknown>) {
  const recommendation = response.recommendations
  return recommendation && typeof recommendation === 'object' ? recommendation as Record<string, unknown> : undefined
}
function normalizeRankedCandidates(response: Record<string, unknown>, shortlist: StudyAgentPhenotypeCandidate[]) {
  const recommendation = responseRecommendation(response)
  const explicitRankedRows = Array.isArray(recommendation?.ranked_candidates) ? recommendation.ranked_candidates : []
  const search = recommendation?.search as Record<string, unknown> | undefined
  const searchRows = Array.isArray(search?.results) ? search.results : []
  const byId = new Map(searchRows.map(row => {
    const candidate = candidateFromUnknown(row)
    return candidate ? [candidate.phenotype_id, candidate] as const : null
  }).filter((entry): entry is readonly [string, StudyAgentPhenotypeCandidate] => entry !== null))
  const diagnostics = recommendation?.diagnostics as Record<string, unknown> | undefined
  const rerank = diagnostics?.planning_rerank as Record<string, unknown> | undefined
  const rankedRows = explicitRankedRows.length ? explicitRankedRows : (Array.isArray(rerank?.candidates) ? rerank.candidates : searchRows)
  const shortlistedIds = new Set(shortlist.map(candidate => candidate.phenotype_id))
  const seen = new Set<string>()
  return rankedRows
    .map(row => {
      const raw = row as Record<string, unknown>
      const id = typeof raw?.phenotype_id === 'string' ? raw.phenotype_id : ''
      return byId.get(id) ?? candidateFromUnknown(row)
    })
    .filter((candidate): candidate is StudyAgentPhenotypeCandidate => !!candidate && !shortlistedIds.has(candidate.phenotype_id) && !seen.has(candidate.phenotype_id) && !!seen.add(candidate.phenotype_id))
}
function normalizeRetrievalCandidates(response: Record<string, unknown>, excludedCandidates: StudyAgentPhenotypeCandidate[]) {
  const recommendation = responseRecommendation(response)
  const rows = Array.isArray(recommendation?.retrieval_ranked_candidates) ? recommendation.retrieval_ranked_candidates : []
  const excludedIds = new Set(excludedCandidates.map(candidate => candidate.phenotype_id))
  const seen = new Set<string>()
  return rows
    .map(candidateFromUnknown)
    .filter((candidate): candidate is StudyAgentPhenotypeCandidate => !!candidate && !excludedIds.has(candidate.phenotype_id) && !seen.has(candidate.phenotype_id) && !!seen.add(candidate.phenotype_id))
}
function applyRecommendationResponse(response: Record<string, unknown>) {
  candidates.value = normalize(response, route.value)
  rankedCandidates.value = normalizeRankedCandidates(response, candidates.value)
  retrievalCandidates.value = normalizeRetrievalCandidates(response, [...candidates.value, ...rankedCandidates.value])
  const offset = responseRecommendation(response)?.candidate_offset
  candidateOffset.value = typeof offset === 'number' && offset >= 0 ? offset : 0
  if (!candidates.value.length) error.value = 'No phenotype candidates were returned. Try a more specific narrative or browse manually.'
}
const primaryActionLabel = computed(() => {
  if (!candidates.value.length) return route.value === 'library' ? 'Browse library' : route.value === 'make_computable' ? 'Start scope clarification' : 'Find candidates'
  if (route.value !== 'ai_search') return 'Search again'
  return narrative.value.trim() !== lastSearchedNarrative.value ? 'Search updated narrative' : 'Rerun /ohdsi search'
})
async function run() {
  loading.value = true; error.value = ''; candidates.value = []; rankedCandidates.value = []; retrievalCandidates.value = []; showRankedCandidates.value = false; showRetrievalCandidates.value = false; scopeQuestions.value = []
  try {
    const session = await startStudyAgentCohortSession(narrative.value.trim(), route.value)
    sessionId = session.session_id
    if (route.value === 'make_computable') {
      const response = await continueStudyAgentMakeComputable(sessionId, {})
      showMakeComputableFlow(response.flow)
      return
    }
    const response = route.value === 'library' ? await searchStudyAgentPhenotypeLibrary(sessionId, narrative.value.trim()) : await requestStudyAgentCohortRecommendations(sessionId)
    lastSearchedNarrative.value = narrative.value.trim()
    if (route.value === 'ai_search') applyRecommendationResponse(response as Record<string, unknown>)
    else {
      candidates.value = normalize(response as Record<string, unknown>, route.value)
      if (!candidates.value.length) error.value = 'No phenotype candidates were returned. Try a more specific narrative or browse manually.'
    }
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to contact /ohdsi.' } finally { loading.value = false }
}
async function loadNextRankedWindow() {
  if (!sessionId) return
  loading.value = true; error.value = ''; showRankedCandidates.value = false; showRetrievalCandidates.value = false
  try {
    const response = await requestStudyAgentCohortRecommendations(sessionId, { candidate_offset: candidateOffset.value + 20 })
    applyRecommendationResponse(response as Record<string, unknown>)
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to load the next ranked window.' } finally { loading.value = false }
}
function showMakeComputableFlow(flow: Record<string, unknown>) {
  scopeQuestions.value = Array.isArray(flow.questions)
    ? flow.questions.filter((question): question is string => typeof question === 'string')
    : []
  const rawCandidates = Array.isArray(flow.concept_candidates) ? flow.concept_candidates : []
  conceptCandidates.value = rawCandidates
    .filter((candidate): candidate is Record<string, unknown> => !!candidate && typeof candidate === 'object' && typeof (candidate.concept_id ?? candidate.conceptId) === 'number')
    .map(candidate => ({
      concept_id: (candidate.concept_id ?? candidate.conceptId) as number,
      concept_name: String(candidate.concept_name ?? candidate.conceptName ?? ''),
      vocabulary_id: String(candidate.vocabulary_id ?? candidate.vocabularyId ?? ''),
      domain_id: String(candidate.domain_id ?? candidate.domainId ?? ''),
      concept_class_id: String(candidate.concept_class_id ?? candidate.conceptClassId ?? ''),
      include: false,
      descendants: false,
      mapped: false,
      exclude: false,
    }))
  if (!scopeQuestions.value.length && !conceptCandidates.value.length) error.value = 'The /ohdsi review response did not contain a supported scope checklist or candidate slice.'
}
const selectedPolicies = computed(() => conceptCandidates.value.filter(candidate => candidate.include || candidate.exclude))
const selectedPolicyCount = computed(() => selectedPolicies.value.length)
const hasReviewedPolicies = computed(() => selectedPolicyCount.value > 0 && !selectedPolicies.value.some(candidate => candidate.include && candidate.exclude))
function setIncludePolicy(candidate: { include: boolean; exclude: boolean; descendants: boolean; mapped: boolean }, value: boolean) {
  candidate.include = value
  if (value) candidate.exclude = false
  else { candidate.descendants = false; candidate.mapped = false }
}
function setExcludePolicy(candidate: { include: boolean; exclude: boolean; descendants: boolean; mapped: boolean }, value: boolean) {
  candidate.exclude = value
  if (value) { candidate.include = false; candidate.descendants = false; candidate.mapped = false }
}
const canRequestCandidateReview = computed(() => scope.value.confirmed && scope.value.windowsNone && !!scope.value.indexEvent.trim() && !!scope.value.domain && !!scope.value.entryLimit && scope.value.priorObservation !== null && !!scope.value.indexDayBoundary && !!scope.value.exitStrategy)
async function requestCandidateReview() {
  if (!sessionId) return
  loading.value = true; error.value = ''; conceptCandidates.value = []; showPolicyConfirmation.value = false
  try {
    const event = scope.value.indexEvent.trim()
    const response = await continueStudyAgentMakeComputable(sessionId, {
      confirmed_scope: true,
      scope: {
        index_event: event,
        criterion_domains: { [event]: scope.value.domain },
        entry_limit: scope.value.entryLimit,
        prior_observation: scope.value.priorObservation,
        index_day_boundary: scope.value.indexDayBoundary,
        windows: 'none',
        exit_strategy: scope.value.exitStrategy,
      },
      concept_review_mode: 'required',
      // This dialog currently renders an inline, bounded candidate review. Larger
      // server-side review sessions will be added once the client supports paging.
      review_delivery: 'inline',
      candidate_limit: 10,
    })
    showMakeComputableFlow(response.flow)
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to request candidate review.' } finally { loading.value = false }
}
async function createComputableDraft() {
  if (!sessionId || !hasReviewedPolicies.value) return
  loading.value = true; error.value = ''
  try {
    const event = scope.value.indexEvent.trim()
    const response = await continueStudyAgentMakeComputable(sessionId, {
      confirmed_scope: true,
      scope: { index_event: event, criterion_domains: { [event]: scope.value.domain }, entry_limit: scope.value.entryLimit, prior_observation: scope.value.priorObservation, index_day_boundary: scope.value.indexDayBoundary, windows: 'none', exit_strategy: scope.value.exitStrategy },
      concept_review_mode: 'provided_only',
      concept_sets: [{ name: event, domain: scope.value.domain, items: selectedPolicies.value.map(candidate => ({ concept_id: candidate.concept_id, domain: candidate.domain_id, include_descendants: candidate.descendants, include_mapped: candidate.mapped, is_excluded: candidate.exclude })) }],
    })
    if ((response.flow as Record<string, unknown>).status !== 'ok') {
      showMakeComputableFlow(response.flow)
      return
    }
    open.value = false
    await router.push({ path: '/cohorts/new', query: { studyAgentSession: sessionId } })
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to create the reviewed cohort draft.' } finally { loading.value = false }
}
async function importDraft(candidate: StudyAgentPhenotypeCandidate) {
  if (!sessionId) return
  importingId.value = candidate.phenotype_id; error.value = ''
  try {
    await importStudyAgentPhenotypeDraft(sessionId, candidate.phenotype_id, { acquisition_route: route.value })
    open.value = false
    await router.push({ path: '/cohorts/new', query: { studyAgentSession: sessionId } })
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to open the phenotype draft.' } finally { importingId.value = null }
}
function reset() { open.value = false; narrative.value = ''; route.value = 'ai_search'; candidates.value = []; rankedCandidates.value = []; retrievalCandidates.value = []; showRankedCandidates.value = false; showRetrievalCandidates.value = false; candidateOffset.value = 0; lastSearchedNarrative.value = ''; conceptCandidates.value = []; scopeQuestions.value = []; showPolicyConfirmation.value = false; scope.value = { indexEvent: '', domain: '', entryLimit: '', priorObservation: null, indexDayBoundary: '', exitStrategy: '', windowsNone: false, confirmed: false }; error.value = ''; sessionId = '' }
</script>

<style scoped>
.study-agent-cohort-dialog__hint { margin: 0 0 16px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-cohort-dialog__routes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.study-agent-cohort-dialog__route { text-align: left; border: 1px solid var(--atlas-color-outline); border-radius: 6px; padding: 14px; color: inherit; background: transparent; cursor: pointer; display: grid; gap: 6px; }
.study-agent-cohort-dialog__route--selected { border-color: rgb(var(--v-theme-primary)); box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .06); }
.study-agent-cohort-dialog__route span { font-size: 13px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-cohort-dialog__results, .study-agent-cohort-dialog__scope { margin-top: 20px; }
.study-agent-cohort-dialog__scope { padding: 14px; border-left: 3px solid rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .05); }
.study-agent-cohort-dialog__scope-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.study-agent-cohort-dialog__confirm { display: block; margin-top: 12px; }
.study-agent-cohort-dialog__policy { display: grid; gap: 6px; white-space: nowrap; }
.study-agent-cohort-dialog__candidate { display: flex; justify-content: space-between; gap: 16px; padding: 14px 0; border-top: 1px solid var(--atlas-color-outline); }
.study-agent-cohort-dialog__candidate p { margin: 4px 0; }
.study-agent-cohort-dialog__candidate-source { display: block; margin-top: 4px; color: var(--atlas-color-text-secondary); }
.study-agent-cohort-dialog__candidate-details, .study-agent-cohort-dialog__label-help { margin-top: 8px; font-size: 13px; }
.study-agent-cohort-dialog__label-help { padding: 10px 12px; border-left: 3px solid rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .05); }
.study-agent-cohort-dialog__label-help p { margin: 8px 0 0; }
.study-agent-cohort-dialog__ranked { margin-top: 16px; }
.study-agent-cohort-dialog__ranked h4 { margin-bottom: 4px; }
.study-agent-cohort-dialog__candidate-actions { display: grid; justify-items: end; align-content: start; gap: 8px; white-space: nowrap; }
@media (max-width: 700px) { .study-agent-cohort-dialog__scope-grid, .study-agent-cohort-dialog__routes { grid-template-columns: 1fr; } .study-agent-cohort-dialog__scope-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.study-agent-cohort-dialog__confirm { display: block; margin-top: 12px; }
.study-agent-cohort-dialog__policy { display: grid; gap: 6px; white-space: nowrap; }
.study-agent-cohort-dialog__candidate { display: grid; } .study-agent-cohort-dialog__candidate-actions { justify-items: start; } }
</style>
