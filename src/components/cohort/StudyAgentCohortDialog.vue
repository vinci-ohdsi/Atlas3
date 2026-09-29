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
        <div :class="{ 'study-agent-cohort-dialog__field--attention': needsCandidateRetrieval }">
          <AtlasTextField
            v-model="scope.indexEvent"
            :label="needsCandidateRetrieval ? 'Index event — update this term to retry' : 'Index event (your clinical term)'"
            variant="outlined"
          />
          <p
            v-if="needsCandidateRetrieval"
            class="study-agent-cohort-dialog__field-help"
          >
            No local candidates matched the previous index term. Enter a more vocabulary-aligned clinical term, then retry candidate review.
          </p>
        </div>
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
        label="I confirm the single-index fast path has no supporting, exclusion, setting, or temporal criteria."
      />
      <AtlasCheckbox
        v-model="scope.confirmed"
        class="study-agent-cohort-dialog__confirm"
        label="I confirm these primary-index choices are intentional."
      />
      <AtlasButton
        v-if="!componentPlanning && !componentPlanCreated"
        variant="secondary"
        class="mt-3"
        :disabled="loading"
        @click="beginComponentPlanning"
      >
        Plan additional cohort components
      </AtlasButton>
      <section
        v-if="componentPlanning && !componentPlanCreated"
        class="study-agent-cohort-dialog__component-plan"
      >
        <h4>Plan additional cohort components</h4>
        <p>Add supporting evidence, exclusions, or a visit/setting restriction. This creates a review-only building-block plan; it does not create Circe or a saved cohort.</p>
        <div
          v-for="(component, index) in components"
          :key="index"
          class="study-agent-cohort-dialog__component-grid"
        >
          <AtlasTextField
            v-model="component.label"
            label="Clinical component"
            variant="outlined"
          />
          <AtlasSelect
            :model-value="component.criterion_role"
            label="Cohort role"
            :items="componentRoles"
            variant="outlined"
            @update:model-value="(value) => updateComponentRole(component, String(value))"
          />
          <AtlasSelect
            v-model="component.domain"
            label="OMOP domain"
            :items="domains"
            variant="outlined"
          />
          <AtlasSelect
            v-model="component.relationship"
            label="Relationship to index"
            :items="relationshipOptionsForRole(component.criterion_role)"
            variant="outlined"
          />
          <AtlasButton
            v-if="components.length > 1"
            variant="ghost"
            @click="components.splice(index, 1)"
          >
            Remove
          </AtlasButton>
        </div>
        <AtlasButton
          variant="secondary"
          class="mt-2"
          @click="addComponent"
        >
          Add another component
        </AtlasButton>
        <AtlasButton
          class="mt-2 ml-2"
          :disabled="!canCreateComponentPlan || loading"
          :loading="loading"
          @click="createComponentPlan"
        >
          Create component plan
        </AtlasButton>
      </section>
      <AtlasButton
        v-if="!componentPlanning && !componentPlanCreated"
        class="mt-3"
        :disabled="!canRequestCandidateReview || loading"
        :loading="loading"
        @click="requestCandidateReview"
      >
        {{ candidateReviewActionLabel }}
      </AtlasButton>
    </section>
    <section
      v-if="cohortSpecification && scope.confirmed && !needsCandidateRetrieval"
      class="study-agent-cohort-dialog__building-blocks"
    >
      <h3>Cohort building blocks</h3>
      <p>These link reusable concept-set assets to cohort criteria. They are not yet a saved cohort definition.</p>
      <article
        v-for="slot in cohortSpecification.concept_set_slots"
        :key="slot.slot_id"
        class="study-agent-cohort-dialog__building-block"
      >
        <div>
          <strong>{{ slot.label || 'Primary index concept set' }}</strong>
          <p>{{ bindingSummary(slot.slot_id) }}</p>
        </div>
        <div class="study-agent-cohort-dialog__building-block-actions">
          <AtlasChip
            size="sm"
            :tone="slot.asset_status === 'reviewed' ? 'success' : 'warning'"
          >
            {{ slot.asset_status === 'reviewed' ? 'Policy reviewed' : slot.asset_status === 'needs_candidate_retrieval' ? 'Needs candidate retrieval' : 'Needs policy review' }}
          </AtlasChip>
          <AtlasButton
            v-if="slot.asset_status !== 'reviewed'"
            variant="secondary"
            size="sm"
            :disabled="loading"
            @click="openConceptSetWorkbench(slot.slot_id)"
          >
            Review concept set
          </AtlasButton>
        </div>
      </article>
      <ul v-if="cohortSpecification.unresolved_decisions?.length">
        <li
          v-for="decision in cohortSpecification.unresolved_decisions"
          :key="decision"
        >
          {{ decision }}
        </li>
      </ul>
      <AtlasButton
        v-if="needsCandidateRetrieval"
        variant="secondary"
        class="mt-3"
        :disabled="!narrative.trim() || loading"
        :loading="loading"
        @click="restartMakeComputable"
      >
        Restart with revised cohort narrative
      </AtlasButton>
    </section>
    <section
      v-if="needsLogicReview"
      class="study-agent-cohort-dialog__logic-review"
    >
      <h3>Confirm criterion bindings and cohort logic</h3>
      <p>
        Concept-set policies are reviewed. Confirm how the reusable assets are used in this cohort. This review records an authoring plan only; it does not create or save a cohort definition.
      </p>
      <div class="study-agent-cohort-dialog__logic-summary">
        <p><strong>Primary index:</strong> {{ logicEntryLabel }} · {{ logicEntryLimit }}</p>
        <p><strong>Observation:</strong> {{ logicPriorObservation }}</p>
        <p><strong>Exit:</strong> {{ logicExitStrategy }}</p>
      </div>
      <div
        v-for="binding in nonPrimaryLogicBindings"
        :key="binding.binding_id"
        class="study-agent-cohort-dialog__logic-binding"
      >
        <strong>{{ bindingLabel(binding.concept_set_slot_id) }}</strong>
        <p>{{ binding.criterion_role.replace(/_/g, ' ') }} · {{ binding.domain }}</p>
        <AtlasSelect
          v-model="logicRelationships[binding.binding_id]"
          label="Relationship to the index event"
          :items="relationshipOptionsForRole(binding.criterion_role)"
          variant="outlined"
        />
        <div
          v-if="binding.criterion_role === 'supporting'"
          class="study-agent-cohort-dialog__scope-grid"
        >
          <AtlasTextField
            :model-value="supportingWindows[binding.binding_id]?.startDays ?? undefined"
            label="Start day relative to index (negative = before; e.g., -180)"
            type="number"
            max="0"
            variant="outlined"
            @update:model-value="(value) => setSupportingWindowDay(binding.binding_id, 'startDays', value)"
          />
          <AtlasTextField
            :model-value="supportingWindows[binding.binding_id]?.endDays ?? undefined"
            label="End day relative to index (0 = index day; negative = before)"
            type="number"
            max="0"
            variant="outlined"
            @update:model-value="(value) => setSupportingWindowDay(binding.binding_id, 'endDays', value)"
          />
        </div>
      </div>
      <div class="study-agent-cohort-dialog__scope-grid">
        <AtlasSelect
          v-model="logicExitType"
          label="Exit strategy"
          :items="['observation', 'end_of_observation', 'fixed']"
          variant="outlined"
        />
        <AtlasSelect
          v-if="logicExitType === 'fixed'"
          v-model="logicExitAnchor"
          label="Fixed-exit anchor"
          :items="['startDate', 'endDate']"
          variant="outlined"
        />
        <AtlasTextField
          v-if="logicExitType === 'fixed'"
          :model-value="logicExitOffset ?? undefined"
          label="Fixed-exit offset (days)"
          type="number"
          variant="outlined"
          @update:model-value="(value) => { logicExitOffset = value === '' || value == null ? null : Number(value) }"
        />
      </div>
      <AtlasSelect
        v-if="supportingLogicBindings.length > 1"
        v-model="supportingOperator"
        label="How multiple supporting criteria combine"
        :items="['ALL', 'ANY']"
        variant="outlined"
      />
      <AtlasCheckbox
        v-model="logicBindingsConfirmed"
        class="study-agent-cohort-dialog__confirm"
        label="I confirm the criterion roles and relationships to the index event are intentional."
      />
      <AtlasCheckbox
        v-model="logicConfirmed"
        class="study-agent-cohort-dialog__confirm"
        label="I confirm the entry rule, observation requirement, Boolean grouping, and exit strategy are intentional."
      />
      <AtlasButton
        class="mt-3"
        :disabled="!canConfirmLogicReview || loading"
        :loading="loading"
        @click="confirmLogicReview"
      >
        Confirm bindings and logic
      </AtlasButton>
    </section>
    <section
      v-if="cohortSpecification?.state === 'ready_for_projection'"
      class="study-agent-cohort-dialog__projection mt-3"
    >
      <h3>Project reviewed cohort plan</h3>
      <template v-if="projectionSupported">
        <p>{{ cohortSpecification?.projection?.summary || 'This reviewed plan can be projected to an unsaved Circe cohort draft.' }}</p>
        <p>Projection uses the accepted concept-set snapshots and does not save a cohort definition.</p>
        <AtlasButton
          :disabled="loading"
          :loading="loading"
          @click="projectReviewedPlan"
        >
          Create unsaved cohort draft
        </AtlasButton>
      </template>
      <template v-else>
        <p>This multi-component plan is fully reviewed, but it has no supported executable projection yet.</p>
        <p>{{ cohortSpecification?.projection?.reason || 'The reviewed bindings remain a durable plan for future projection support.' }}</p>
        <AtlasButton
          variant="secondary"
          :disabled="loading"
          :loading="loading"
          @click="reopenLogicReview"
        >
          Revise bindings and logic
        </AtlasButton>
      </template>
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
          <AtlasButton
            v-else-if="candidate.computability_status === 'conversion_required'"
            size="sm"
            :loading="convertingId === candidate.phenotype_id"
            @click="startConversion(candidate)"
          >
            Use as reference for a new definition
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
            <AtlasButton
              v-else-if="candidate.computability_status === 'conversion_required'"
              size="sm"
              :loading="convertingId === candidate.phenotype_id"
              @click="startConversion(candidate)"
            >
              Use as reference for a new definition
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
            <AtlasButton
              v-else-if="candidate.computability_status === 'conversion_required'"
              size="sm"
              :loading="convertingId === candidate.phenotype_id"
              @click="startConversion(candidate)"
            >
              Use as reference for a new definition
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
        v-if="!scopeQuestions.length && !conceptCandidates.length && !(route === 'make_computable' && makeComputableSessionStarted)"
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
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { AtlasAlert, AtlasButton, AtlasCheckbox, AtlasChip, AtlasDialog, AtlasSelect, AtlasTextField } from '@/components/ui'
import { createStudyAgentMultiComponentSpecification, getStudyAgentCohortSpecification, importStudyAgentPhenotypeDraft, projectStudyAgentCohortSpecification, reopenStudyAgentCohortSpecificationLogic, requestStudyAgentCohortRecommendations, searchStudyAgentPhenotypeLibrary, startStudyAgentCohortSession, continueStudyAgentMakeComputable, confirmStudyAgentCohortSpecificationLogic } from '@/services/study-agent-cohort-definition.service'
import { setStudyAgentCohortConceptSetHandoff } from '@/stores/study-agent-cohort-concept-set-handoff'
import type { StudyAgentCohortRoute, StudyAgentCohortSpecification, StudyAgentCohortSpecificationComponent, StudyAgentPhenotypeCandidate } from '@/models/study-agent.types'

const open = defineModel<boolean>({ required: true })
const props = withDefaults(defineProps<{ resumeSessionId?: string }>(), { resumeSessionId: '' })
const router = useRouter()
const narrative = ref('')
const route = ref<StudyAgentCohortRoute>('ai_search')
const loading = ref(false)
const importingId = ref<string | null>(null)
const convertingId = ref<string | null>(null)
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
const cohortSpecification = ref<StudyAgentCohortSpecification | null>(null)
const makeComputableSessionStarted = ref(false)
const lastCandidateRequestIndexEvent = ref('')
const componentPlanning = ref(false)
const componentPlanCreated = ref(false)
const components = ref<StudyAgentCohortSpecificationComponent[]>([])
const logicRelationships = ref<Record<string, string>>({})
const supportingWindows = ref<Record<string, { startDays: number | null; endDays: number | null }>>({})
const logicExitType = ref('observation')
const logicExitAnchor = ref('endDate')
const logicExitOffset = ref<number | null>(null)
const supportingOperator = ref<'ALL' | 'ANY'>('ALL')
const logicBindingsConfirmed = ref(false)
const logicConfirmed = ref(false)
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
      makeComputableSessionStarted.value = true
      const response = await continueStudyAgentMakeComputable(sessionId, {})
      receiveCohortSpecification(response)
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
async function resumeCohortSpecification(resumeSessionId: string) {
  if (!resumeSessionId || loading.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await getStudyAgentCohortSpecification(resumeSessionId)
    sessionId = resumeSessionId
    route.value = 'make_computable'
    makeComputableSessionStarted.value = true
    setCohortSpecification(response.cohort_specification.specification)
    narrative.value = response.cohort_specification.specification.narrative
    scope.value.confirmed = true
    componentPlanCreated.value = true
    componentPlanning.value = false
    scopeQuestions.value = []
    conceptCandidates.value = []
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to resume the cohort building-block review.'
  } finally {
    loading.value = false
  }
}

function setCohortSpecification(specification: StudyAgentCohortSpecification) {
  cohortSpecification.value = specification
  const relationships: Record<string, string> = {}
  for (const binding of specification.criterion_bindings) {
    if (binding.criterion_role !== 'primary_index' && binding.binding_id) {
      const permitted = relationshipOptionsForRole(binding.criterion_role)
      relationships[binding.binding_id] = permitted.includes(binding.relationship as ComponentRelationship)
        ? binding.relationship || ''
        : ''
    }
  }
  logicRelationships.value = relationships
  const windows: Record<string, { startDays: number | null; endDays: number | null }> = {}
  for (const binding of specification.criterion_bindings) {
    if (binding.criterion_role === 'supporting' && binding.binding_id) {
      const window = binding.supporting_condition_window
      windows[binding.binding_id] = {
        startDays: typeof window?.start_days === 'number' ? window.start_days : null,
        endDays: typeof window?.end_days === 'number' ? window.end_days : null,
      }
    }
  }
  supportingWindows.value = windows
  const exit = logicMapFromSpecification(specification, 'exit')
  const exitStrategy = exit.strategy
  if (exitStrategy && typeof exitStrategy === 'object' && !Array.isArray(exitStrategy)) {
    const fixed = exitStrategy as Record<string, unknown>
    logicExitType.value = 'fixed'
    logicExitAnchor.value = String(fixed.index ?? 'endDate')
    logicExitOffset.value = typeof fixed.offset_days === 'number' ? fixed.offset_days : Number.isFinite(Number(fixed.offset_days)) ? Number(fixed.offset_days) : null
  } else {
    logicExitType.value = String(exitStrategy ?? 'observation')
    logicExitAnchor.value = 'endDate'
    logicExitOffset.value = null
  }
  const review = specification.cohort_logic?.review as Record<string, unknown> | undefined
  const reviewedOperator = String(review?.supporting_operator ?? '')
  if (reviewedOperator === 'ALL' || reviewedOperator === 'ANY') supportingOperator.value = reviewedOperator
  logicBindingsConfirmed.value = false
  logicConfirmed.value = false
}
function receiveCohortSpecification(response: { cohort_specification?: { specification: StudyAgentCohortSpecification } }) {
  const specification = response.cohort_specification?.specification
  if (specification) setCohortSpecification(specification)
}
async function openConceptSetWorkbench(slotId: string) {
  if (!sessionId || !cohortSpecification.value) return
  const slot = cohortSpecification.value.concept_set_slots.find(item => item.slot_id === slotId)
  const binding = cohortSpecification.value.criterion_bindings.find(item => item.concept_set_slot_id === slotId)
  if (!slot || !binding?.domain) return
  setStudyAgentCohortConceptSetHandoff({
    cohortSessionId: sessionId,
    slotId,
    label: slot.label || 'Cohort concept set',
    domain: binding.domain,
    criterionRole: binding.criterion_role,
  })
  open.value = false
  await router.push({ path: '/concepts', query: { tab: 'sets', cohortStudyAgentSession: sessionId, cohortConceptSetSlot: slotId, cohortConceptSetLabel: slot.label || 'Cohort concept set', cohortConceptSetDomain: binding.domain, cohortCriterionRole: binding.criterion_role } })
}

function bindingSummary(slotId: string) {
  const binding = cohortSpecification.value?.criterion_bindings.find(item => item.concept_set_slot_id === slotId)
  if (!binding) return 'Concept-set asset awaiting criterion binding'
  const role = binding.criterion_role === 'primary_index' ? 'Primary index event' : binding.criterion_role.replace(/_/g, ' ')
  const relationship = binding.relationship ? ` · ${binding.relationship.replace(/_/g, ' ')}` : ''
  return binding.domain ? `${role} · ${binding.domain}${relationship}` : `${role}${relationship}`
}

const nonPrimaryLogicBindings = computed(() =>
  (cohortSpecification.value?.criterion_bindings ?? []).filter(binding => binding.criterion_role !== 'primary_index'),
)
const supportingLogicBindings = computed(() =>
  nonPrimaryLogicBindings.value.filter(binding => binding.criterion_role === 'supporting' || binding.criterion_role === 'visit_restriction'),
)
const needsLogicReview = computed(() => cohortSpecification.value?.state === 'needs_logic_review')
const validSupportingWindows = computed(() => supportingLogicBindings.value.every(binding => {
  if (binding.criterion_role !== 'supporting') return true
  const window = supportingWindows.value[binding.binding_id]
  if (!window || window.startDays === null || window.endDays === null) return false
  return window.startDays <= window.endDays && window.endDays <= 0
}))
const validExitReview = computed(() => logicExitType.value !== 'fixed' || (['startDate', 'endDate'].includes(logicExitAnchor.value) && logicExitOffset.value !== null && Number.isInteger(logicExitOffset.value)))
const canConfirmLogicReview = computed(() =>
  logicBindingsConfirmed.value
  && logicConfirmed.value
  && validSupportingWindows.value
  && validExitReview.value
  && nonPrimaryLogicBindings.value.every(binding => relationshipOptionsForRole(binding.criterion_role).includes(logicRelationships.value[binding.binding_id] as ComponentRelationship)),
)
function logicMapFromSpecification(specification: StudyAgentCohortSpecification, name: string): Record<string, unknown> {
  const value = specification.cohort_logic?.[name]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function setSupportingWindowDay(bindingId: string, field: 'startDays' | 'endDays', value: unknown) {
  const current = supportingWindows.value[bindingId] ?? { startDays: null, endDays: null }
  current[field] = value === '' || value == null ? null : Number(value)
  supportingWindows.value[bindingId] = current
}
function logicMap(name: string): Record<string, unknown> {
  const value = cohortSpecification.value?.cohort_logic?.[name]
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
const logicEntryLabel = computed(() => String(logicMap('entry').event_label ?? cohortSpecification.value?.narrative ?? 'Primary index event'))
const logicEntryLimit = computed(() => {
  const entry = logicMap('entry')
  const limit = String(entry.limit ?? '').trim()
  const boundary = String(entry.index_day_boundary ?? '').trim()
  return [limit, boundary ? `index day ${boundary}` : ''].filter(Boolean).join(' · ') || 'Review required'
})
const logicPriorObservation = computed(() => {
  const days = logicMap('observation').prior_days
  return typeof days === 'number' || typeof days === 'string' ? `${days} days prior continuous observation` : 'Review required'
})
const logicExitStrategy = computed(() => {
  const strategy = logicMap('exit').strategy
  if (strategy && typeof strategy === 'object' && !Array.isArray(strategy)) {
    const fixed = strategy as Record<string, unknown>
    return `fixed: ${String(fixed.index ?? 'endDate')} + ${String(fixed.offset_days ?? '')} days`
  }
  return String(strategy ?? 'Review required').replace(/_/g, ' ')
})
function bindingLabel(slotId: string) {
  return cohortSpecification.value?.concept_set_slots.find(slot => slot.slot_id === slotId)?.label || 'Cohort criterion'
}
async function confirmLogicReview() {
  if (!sessionId || !canConfirmLogicReview.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await confirmStudyAgentCohortSpecificationLogic(sessionId, {
      relationships: { ...logicRelationships.value },
      supporting_windows: Object.fromEntries(Object.entries(supportingWindows.value).map(([bindingId, window]) => [bindingId, { start_days: window.startDays, end_days: window.endDays }])),
      exit_strategy: logicExitType.value === 'fixed'
        ? { type: 'fixed', index: logicExitAnchor.value, offset_days: logicExitOffset.value }
        : logicExitType.value,
      supporting_operator: supportingOperator.value,
      confirm_bindings: logicBindingsConfirmed.value,
      confirm_logic: logicConfirmed.value,
    })
    setCohortSpecification(response.cohort_specification.specification)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to confirm criterion bindings and cohort logic.'
  } finally {
    loading.value = false
  }
}
function showMakeComputableFlow(flow: Record<string, unknown>) {
  const nextQuestions = Array.isArray(flow.questions)
    ? flow.questions.filter((question): question is string => typeof question === 'string')
    : []
  const rawCandidates = Array.isArray(flow.concept_candidates) ? flow.concept_candidates : []
  const nextCandidates = rawCandidates
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

  if (nextCandidates.length) {
    conceptCandidates.value = nextCandidates
    scopeQuestions.value = nextQuestions
    return
  }
  if (nextQuestions.length) {
    scopeQuestions.value = nextQuestions
    return
  }
  // Do not erase a completed form and send the user back to a new session when
  // a bounded retrieval has no usable candidates. Keeping scope visible lets
  // them revise it and retry within the same review session.
  if (!scopeQuestions.value.length) {
    error.value = 'No reviewable vocabulary candidates were returned. Refine the scope or try a different index event.'
  } else {
    error.value = 'No reviewable vocabulary candidates were returned for this scope. Revise the scope and request candidate review again.'
  }
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
const canRequestCandidateReview = computed(() => scope.value.confirmed && scope.value.windowsNone && !!scope.value.indexEvent.trim() && !!scope.value.domain && !!scope.value.entryLimit && scope.value.priorObservation !== null && !!scope.value.indexDayBoundary && !!scope.value.exitStrategy && (!needsCandidateRetrieval.value || indexEventChangedSinceCandidateRequest.value))
const needsCandidateRetrieval = computed(() => cohortSpecification.value?.state === 'needs_candidate_retrieval' && !conceptCandidates.value.length)
const indexEventChangedSinceCandidateRequest = computed(() => scope.value.indexEvent.trim() !== lastCandidateRequestIndexEvent.value)
const candidateReviewActionLabel = computed(() => {
  if (!needsCandidateRetrieval.value) return 'Request candidate review'
  return indexEventChangedSinceCandidateRequest.value ? 'Retry candidate review' : 'Change index event to retry'
})
async function restartMakeComputable() {
  // A narrative is immutable within a review session. Restarting keeps the
  // edited narrative text but deliberately creates a fresh session and scope.
  cohortSpecification.value = null
  conceptCandidates.value = []
  scopeQuestions.value = []
  showPolicyConfirmation.value = false
  scope.value = { indexEvent: '', domain: '', entryLimit: '', priorObservation: null, indexDayBoundary: '', exitStrategy: '', windowsNone: false, confirmed: false }
  componentPlanning.value = false
  componentPlanCreated.value = false
  components.value = []
  error.value = ''
  sessionId = ''
  makeComputableSessionStarted.value = false
  lastCandidateRequestIndexEvent.value = ''
  await run()
}
type ComponentRole = 'supporting' | 'exclusion' | 'visit_restriction'
type ComponentRelationship = 'required_with_index' | 'exclude_at_index' | 'overlaps_index'
const componentRoles: ComponentRole[] = ['supporting', 'exclusion', 'visit_restriction']
function relationshipOptionsForRole(role: string): ComponentRelationship[] {
  if (role === 'visit_restriction') return ['overlaps_index']
  if (role === 'exclusion') return ['exclude_at_index']
  return ['required_with_index']
}
function updateComponentRole(component: StudyAgentCohortSpecificationComponent, role: string) {
  const selectedRole = componentRoles.includes(role as ComponentRole) ? role as ComponentRole : 'supporting'
  component.criterion_role = selectedRole
  component.relationship = relationshipOptionsForRole(selectedRole)[0]!
}
function addComponent() {
  components.value.push({ label: '', domain: '', criterion_role: 'supporting', relationship: 'required_with_index' })
}
function beginComponentPlanning() {
  componentPlanning.value = true
  if (!components.value.length) addComponent()
}
const canCreateComponentPlan = computed(() => scope.value.confirmed && !!scope.value.indexEvent.trim() && !!scope.value.domain && !!scope.value.entryLimit && scope.value.priorObservation !== null && !!scope.value.indexDayBoundary && !!scope.value.exitStrategy && components.value.length > 0 && components.value.every(component => !!component.label.trim() && !!component.domain && !!component.criterion_role && !!component.relationship))
const projectionSupported = computed(() => cohortSpecification.value?.state === 'ready_for_projection' && cohortSpecification.value?.projection?.supported === true)
function currentScopePayload() {
  const event = scope.value.indexEvent.trim()
  return {
    index_event: event,
    criterion_domains: { [event]: scope.value.domain },
    entry_limit: scope.value.entryLimit,
    prior_observation: scope.value.priorObservation,
    index_day_boundary: scope.value.indexDayBoundary,
    windows: scope.value.windowsNone ? 'none' : 'component_plan',
    exit_strategy: scope.value.exitStrategy,
  }
}
async function createComponentPlan() {
  if (!sessionId || !canCreateComponentPlan.value) return
  loading.value = true; error.value = ''
  try {
    const response = await createStudyAgentMultiComponentSpecification(sessionId, currentScopePayload(), components.value)
    setCohortSpecification(response.cohort_specification.specification)
    componentPlanCreated.value = true
    componentPlanning.value = false
    scopeQuestions.value = []
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to create the multi-component cohort plan.' } finally { loading.value = false }
}
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
    lastCandidateRequestIndexEvent.value = event
    receiveCohortSpecification(response)
    showMakeComputableFlow(response.flow)
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to request candidate review.' } finally { loading.value = false }
}
async function reopenLogicReview() {
  if (!sessionId) return
  loading.value = true; error.value = ''
  try {
    const response = await reopenStudyAgentCohortSpecificationLogic(sessionId)
    setCohortSpecification(response.cohort_specification.specification)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to reopen the cohort logic review.'
  } finally { loading.value = false }
}

async function projectReviewedPlan() {
  if (!sessionId || !projectionSupported.value) return
  loading.value = true; error.value = ''
  try {
    await projectStudyAgentCohortSpecification(sessionId)
    open.value = false
    await router.push({ path: '/cohorts/new', query: { studyAgentSession: sessionId } })
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to project the reviewed cohort plan.'
  } finally { loading.value = false }
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
      receiveCohortSpecification(response)
      showMakeComputableFlow(response.flow)
      return
    }
    open.value = false
    await router.push({ path: '/cohorts/new', query: { studyAgentSession: sessionId } })
  } catch (err) { error.value = err instanceof Error ? err.message : 'Unable to create the reviewed cohort draft.' } finally { loading.value = false }
}
async function startConversion(candidate: StudyAgentPhenotypeCandidate) {
  if (convertingId.value) return
  convertingId.value = candidate.phenotype_id
  error.value = ''
  try {
    const reference = [
      `Reference phenotype for review: ${candidate.phenotype_name}.`,
      candidate.short_description ? `Summary: ${candidate.short_description}` : '',
      'Use this as evidence only. Build a new computable cohort definition through scope clarification and explicit concept-policy review.',
    ].filter(Boolean).join(' ')
    narrative.value = `${narrative.value.trim()}

${reference}`.trim()
    route.value = 'make_computable'
    candidates.value = []; rankedCandidates.value = []; retrievalCandidates.value = []
    showRankedCandidates.value = false; showRetrievalCandidates.value = false
    await run()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unable to start the computable-definition review.'
  } finally {
    convertingId.value = null
  }
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
function reset() { open.value = false; narrative.value = ''; route.value = 'ai_search'; convertingId.value = null; candidates.value = []; rankedCandidates.value = []; retrievalCandidates.value = []; showRankedCandidates.value = false; showRetrievalCandidates.value = false; candidateOffset.value = 0; lastSearchedNarrative.value = ''; conceptCandidates.value = []; cohortSpecification.value = null; makeComputableSessionStarted.value = false; lastCandidateRequestIndexEvent.value = ''; componentPlanning.value = false; componentPlanCreated.value = false; components.value = []; logicRelationships.value = {}; supportingWindows.value = {}; logicExitType.value = 'observation'; logicExitAnchor.value = 'endDate'; logicExitOffset.value = null; supportingOperator.value = 'ALL'; logicBindingsConfirmed.value = false; logicConfirmed.value = false; scopeQuestions.value = []; showPolicyConfirmation.value = false; scope.value = { indexEvent: '', domain: '', entryLimit: '', priorObservation: null, indexDayBoundary: '', exitStrategy: '', windowsNone: false, confirmed: false }; error.value = ''; sessionId = '' }
watch(
  () => [open.value, props.resumeSessionId] as const,
  async ([isOpen, resumeSessionId]) => {
    if (isOpen && resumeSessionId) await resumeCohortSpecification(resumeSessionId)
  },
  { immediate: true },
)

</script>

<style scoped>
.study-agent-cohort-dialog__hint { margin: 0 0 16px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-cohort-dialog__routes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
.study-agent-cohort-dialog__route { text-align: left; border: 1px solid var(--atlas-color-outline); border-radius: 6px; padding: 14px; color: inherit; background: transparent; cursor: pointer; display: grid; gap: 6px; }
.study-agent-cohort-dialog__route--selected { border-color: rgb(var(--v-theme-primary)); box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .06); }
.study-agent-cohort-dialog__route span { font-size: 13px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-cohort-dialog__results, .study-agent-cohort-dialog__scope, .study-agent-cohort-dialog__building-blocks { margin-top: 20px; }
.study-agent-cohort-dialog__scope { padding: 14px; border-left: 3px solid rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .05); }
.study-agent-cohort-dialog__building-blocks, .study-agent-cohort-dialog__logic-review, .study-agent-cohort-dialog__projection { padding: 14px; border: 1px solid rgb(var(--v-theme-outline-variant)); border-radius: 8px; }
.study-agent-cohort-dialog__logic-review { margin-top: 20px; }
.study-agent-cohort-dialog__logic-summary { margin: 12px 0; padding: 10px 12px; background: rgba(var(--v-theme-primary), .05); border-radius: 6px; }
.study-agent-cohort-dialog__logic-summary p { margin: 4px 0; }
.study-agent-cohort-dialog__logic-binding { padding: 12px 0; border-top: 1px solid rgb(var(--v-theme-outline-variant)); }
.study-agent-cohort-dialog__logic-binding p { margin: 3px 0 10px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-cohort-dialog__building-block { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 10px 0; border-top: 1px solid rgb(var(--v-theme-outline-variant)); }
.study-agent-cohort-dialog__building-block:first-of-type { border-top: 0; }
.study-agent-cohort-dialog__field--attention { padding: 8px; border-radius: 6px; background: rgb(var(--v-theme-warning), .12); }
.study-agent-cohort-dialog__field-help { margin: 4px 0 0; color: rgb(var(--v-theme-on-surface-variant)); font-size: .875rem; }
.study-agent-cohort-dialog__scope-grid, .study-agent-cohort-dialog__component-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.study-agent-cohort-dialog__component-plan { margin-top: 16px; padding: 14px; border: 1px solid rgb(var(--v-theme-outline-variant)); border-radius: 8px; }
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
@media (max-width: 700px) { .study-agent-cohort-dialog__scope-grid, .study-agent-cohort-dialog__component-grid, .study-agent-cohort-dialog__routes { grid-template-columns: 1fr; } .study-agent-cohort-dialog__scope-grid, .study-agent-cohort-dialog__component-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.study-agent-cohort-dialog__component-plan { margin-top: 16px; padding: 14px; border: 1px solid rgb(var(--v-theme-outline-variant)); border-radius: 8px; }
.study-agent-cohort-dialog__confirm { display: block; margin-top: 12px; }
.study-agent-cohort-dialog__policy { display: grid; gap: 6px; white-space: nowrap; }
.study-agent-cohort-dialog__candidate { display: grid; } .study-agent-cohort-dialog__candidate-actions { justify-items: start; } }
</style>
