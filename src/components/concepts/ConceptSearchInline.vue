<template>
  <div class="concept-search-inline">
    <!-- Search Input -->
    <AtlasTextField
      v-model="searchInput"
      :label="tv('common.search')"
      :placeholder="tv('search.placeholder')"
      prepend-icon="mdi-magnify"
      clearable
      variant="outlined"
      :error="validationError"
      :disabled="loading"
      class="mb-4"
      @update:model-value="(v: string | number) => onSearchInput(v != null ? String(v) : null)"
      @click:clear="onClear"
      @keyup.enter="onSearch"
    >
      <template #append>
        <AtlasButton
          :disabled="!isSearchValid || loading"
          :loading="loading"
          @click="onSearch"
        >
          {{ t('common.search') }}
        </AtlasButton>
      </template>
    </AtlasTextField>

    <!-- Error Message -->

    <AtlasAlert
      v-if="prefillNotices.length"
      severity="warning"
      class="mb-4"
    >
      <div
        v-for="notice in prefillNotices"
        :key="notice"
      >
        {{ notice }}
      </div>
    </AtlasAlert>
    <AtlasAlert
      v-if="store.error"
      severity="danger"
      :closable="true"
      class="mb-4"
      @close="store.error = null"
    >
      {{ store.error }}
    </AtlasAlert>

    <ConceptFacetFilters
      v-if="!store.isEmpty"
      :facet-options="store.facetOptions"
      :selected="store.selectedFacets"
      :active-filter-count="store.activeFacetCount"
      :result-filter="store.resultFilter"
      class="mb-4"
      @update:facet="({ key, values }) => store.setFacet(key, values)"
      @update:result-filter="(v: string) => store.setResultFilter(v)"
      @clear="store.clearFacets()"
    />

    <ConceptAddOptions
      v-if="!store.isEmpty"
      v-model="addFlags"
      :selected-count="selected.length"
      class="mb-4"
      @add="onAddSelected"
    />

    <!-- Results Table with Add/Remove buttons -->
    <ConceptTable
      v-model:selected="selected"
      :concepts="store.concepts"
      :loading="store.loading"
      :total-items="store.totalCount"
      :page="store.page"
      :items-per-page="store.itemsPerPage"
      :show-add-button="true"
      :selectable="true"
      :concepts-in-set="conceptsInSet"
      @update:page="onPageChange"
      @update:items-per-page="onItemsPerPageChange"
      @add-concept="onAddConcept"
      @remove-concept="onRemoveConcept"
      @view-concept="(payload) => emit('view-concept', payload)"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { AtlasAlert, AtlasButton, AtlasTextField } from '@/components/ui'
import { useI18n } from '@/composables/useI18n'
import { useConceptSearchStore } from '@/stores/concept-search'
import { useConceptSetsStore } from '@/stores/concept-sets'
import ConceptTable from './ConceptTable.vue'
import ConceptFacetFilters from './ConceptFacetFilters.vue'
import ConceptAddOptions from './ConceptAddOptions.vue'
import type { Concept, ConceptAddFlags } from '@/models/concept-set.types'

interface SearchPrefill {
  term?: string
  domain?: string
  vocabulary?: string
}

const props = defineProps<{
  initialSearch?: SearchPrefill
}>()

const { t, tv } = useI18n()

// ============================================================================
// Stores
// ============================================================================

const store = useConceptSearchStore()
const conceptSetsStore = useConceptSetsStore()

// ============================================================================
// Emits
// ============================================================================

const emit = defineEmits<{
  'add-concept': [concept: Concept, flags: Required<ConceptAddFlags>]
  'add-concepts': [concepts: Concept[], flags: Required<ConceptAddFlags>]
  'remove-concept': [concept: Concept]
  'view-concept': [payload: { conceptId: number; sourceKey: string }]
}>()

// ============================================================================
// Local State
// ============================================================================

const searchInput = ref<string>('')
const selected = ref<number[]>([])
const appliedPrefillKey = ref('')
const prefillNotices = ref<string[]>([])

// R records a requested domain as reviewer intent. Only these canonical OMOP
// domains are safe to turn into an Atlas facet without guessing at a typo.
const SUPPORTED_DOMAIN_FACETS = [
  'Condition', 'Drug', 'Procedure', 'Measurement', 'Observation', 'Visit', 'Device',
]

// Sticky across searches on purpose: the point of the add box is to set the
// intent once and then collect concepts over several queries.
const addFlags = ref<Required<ConceptAddFlags>>({
  isExcluded: false,
  includeDescendants: false,
  includeMapped: false,
})

// ============================================================================
// Computed
// ============================================================================

const isSearchValid = computed(() => {
  return searchInput.value.trim().length >= 3
})

const validationError = computed(() => {
  const trimmed = searchInput.value.trim()
  if (trimmed.length > 0 && trimmed.length < 3) {
    return 'Please enter at least 3 characters'
  }
  return undefined
})

const loading = computed(() => store.loading)

// Track which concepts are already in the current set
const conceptsInSet = computed(() => {
  const set = new Set<number>()
  conceptSetsStore.currentSet?.items.forEach(item => {
    set.add(item.conceptId)
  })
  return set
})

// ============================================================================
// Methods
// ============================================================================

function onSearchInput(value: string | null) {
  if (!value) {
    store.clearSearch()
    return
  }

  // Search is only triggered by clicking the search button or pressing Enter
  // No auto-search on typing to avoid blocking user flow
}

function onSearch() {
  if (!isSearchValid.value) return

  // Immediate search when user clicks button or presses Enter
  store.search(searchInput.value.trim())
}

function onClear() {
  searchInput.value = ''
  store.clearSearch()
}

async function applyInitialSearch(prefill: SearchPrefill | undefined) {
  const term = String(prefill?.term ?? '').trim()
  const domain = String(prefill?.domain ?? '').trim()
  const vocabulary = String(prefill?.vocabulary ?? '').trim()
  const key = `${term}\u0000${domain}\u0000${vocabulary}`
  if (!term || key === appliedPrefillKey.value) return
  appliedPrefillKey.value = key
  prefillNotices.value = []
  searchInput.value = term
  if (term.length < 3) return
  await store.search(term)

  // These are optional facets on the normal Atlas result set, never a
  // concept-set policy. Preserve the R-requested scope as provenance, but do
  // not silently turn unknown names into a zero-result filter.
  const returnedDomains = new Set(store.allConcepts.map(concept => concept.domainId))
  const returnedVocabularies = Array.from(new Set(store.allConcepts.map(concept => concept.vocabularyId)))
  const canonicalDomain = SUPPORTED_DOMAIN_FACETS.find(
    candidate => candidate.toLowerCase() === domain.toLowerCase(),
  )
  const canonicalVocabulary = returnedVocabularies.find(
    candidate => candidate.toLowerCase() === vocabulary.toLowerCase(),
  )
  if (domain && !canonicalDomain) {
    prefillNotices.value.push(
      `The R workflow requested domain “${domain}”, which is not a supported Atlas domain filter. Search remains unfiltered by domain.`,
    )
  } else if (canonicalDomain) {
    store.setFacet('domainId', [canonicalDomain])
    if (!returnedDomains.has(canonicalDomain)) {
      prefillNotices.value.push(
        `The R workflow requested domain “${canonicalDomain}”, but the local search for “${term}” returned no concepts in that domain. You can clear the domain filter or refine the search.`,
      )
    }
  }

  if (vocabulary && !canonicalVocabulary) {
    prefillNotices.value.push(
      `The R workflow requested vocabulary “${vocabulary}”, but it could not be applied to the returned local search results. Search remains unfiltered by vocabulary.`,
    )
  } else if (canonicalVocabulary) {
    store.setFacet('vocabularyId', [canonicalVocabulary])
  }
}

watch(
  () => props.initialSearch,
  prefill => { void applyInitialSearch(prefill) },
  { immediate: true, deep: true },
)

function onPageChange(page: number) {
  store.updatePagination(page, store.itemsPerPage)
}

function onItemsPerPageChange(itemsPerPage: number) {
  store.updatePagination(1, itemsPerPage)
}

function onAddConcept(concept: Concept) {
  emit('add-concept', concept, addFlags.value)
}

function onAddSelected() {
  const ids = new Set(selected.value)
  if (ids.size === 0) return

  emit(
    'add-concepts',
    store.allConcepts.filter(c => ids.has(c.conceptId)),
    addFlags.value
  )
  selected.value = []
}

function onRemoveConcept(concept: Concept) {
  emit('remove-concept', concept)
}
</script>

<style scoped>
.concept-search-inline {
  width: 100%;
  /* The search field sits as the first element inside the tab's v-window,
   * whose overflow: hidden clips anything above its own top edge. With no
   * clearance here, the outlined field's floating label — which renders
   * above the field's own box — gets its top sliced off (#254). */
  padding-top: 8px;
}
</style>
