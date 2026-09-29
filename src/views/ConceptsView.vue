<template>
  <AtlasPageShell
    hero
    compact
    :eyebrow="`OHDSI · ${t('facets.caption.vocabulary', 'Vocabulary').value}`"
    :title="pageTitle"
    :subtitle="pageSubtitle"
  >
    <div class="concepts-view">
      <nav class="page-tabs-rail concepts-view__tabs-rail">
        <AtlasTabs
          v-model="activeTab"
          align-tabs="start"
          density="comfortable"
          color="primary"
          slider-color="primary"
          bg-color="transparent"
          class="page-tabs"
        >
          <AtlasTab value="sets">
            <AtlasIcon
              start
              icon="mdi-shape"
            />
            {{ t('cs.browser.caption', 'Concept Sets') }}
          </AtlasTab>
          <AtlasTab value="search">
            <AtlasIcon
              start
              icon="mdi-magnify"
            />
            {{ t('search.tabs.search', 'Concept Search') }}
          </AtlasTab>
        </AtlasTabs>
      </nav>

      <div
        v-if="hasCohortHandoff && !conceptSetsStore.editorOpen"
        class="concepts-view__cohort-handoff"
      >
        <strong>Continue cohort concept-set review</strong>
        <span>The requested building block is ready to open in the concept-set editor.</span>
        <AtlasButton
          size="sm"
          @click="openCohortHandoffWorkbench"
        >
          Open concept-set review
        </AtlasButton>
      </div>

      <v-window v-model="activeTab">
        <v-window-item value="sets">
          <ConceptSetList />
        </v-window-item>

        <v-window-item value="search">
          <ConceptSearch />
        </v-window-item>
      </v-window>

      <!-- Page-level concept set editor (overlays both tabs) -->
      <ConceptSetEditor
        v-if="conceptSetsStore.editorOpen"
        :model-value="conceptSetsStore.editorOpen"
        :concept-set="conceptSetsStore.currentSet"
        :cohort-handoff="activeCohortHandoff ?? undefined"
        @update:model-value="
          value => {
            if (!value) {
              activeCohortHandoff = null
              conceptSetsStore.closeEditor()
            }
          }
        "
        @save="onEditorSave"
        @delete="onEditorDelete"
      />
    </div>
  </AtlasPageShell>
</template>

<script setup lang="ts">
import { ref, computed, provide, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '@/composables/useI18n'
import { AtlasButton, AtlasIcon, AtlasPageShell, AtlasTab, AtlasTabs } from '@/components/ui'
import ConceptSearch from '@/components/concepts/ConceptSearch.vue'
import ConceptSetList from '@/components/concepts/ConceptSetList.vue'
import ConceptSetEditor from '@/components/concepts/ConceptSetEditor.vue'
import { useConceptSetsStore } from '@/stores/concept-sets'
import { useWebAPIStore } from '@/stores/webapi'
import { getSourceKey as getDefaultSourceKey } from '@/config/webapi'
import { getStudyAgentCohortConceptSetHandoff, type StudyAgentCohortConceptSetHandoff } from '@/stores/study-agent-cohort-concept-set-handoff'
import { useStudyAgentConceptSetStore } from '@/stores/study-agent-concept-set'

const route = useRoute()
const router = useRouter()
const conceptSetsStore = useConceptSetsStore()
const webapiStore = useWebAPIStore()
const studyAgentStore = useStudyAgentConceptSetStore()
let openedCohortHandoffKey = ''
const activeCohortHandoff = ref<StudyAgentCohortConceptSetHandoff | null>(null)
const { t } = useI18n()

const pageTitle = computed(() => t('cs.browser.caption', 'Concepts').value)
const pageSubtitle = computed(
  () =>
    t('cs.browser.subtitle', 'Browse the OMOP vocabulary and curate reusable concept sets.').value
)

// Active tab state - sync with URL query. Default to "sets" (concept sets list).
const activeTab = ref<string>((route.query.tab as string) || 'sets')

// Vocabulary source key — derived from the webapi store's available vocabulary
// sources, falling back to the configured default. Stays reactive so child
// components see the right source once the WebAPI sources finish loading.
const sourceKey = computed(
  () => webapiStore.getValidVocabularySource() || getDefaultSourceKey() || '',
)

// Provide sourceKey to child components (as a ref-like object with `.value`
// to keep the existing inject contract — `inject<{ value: string }>('sourceKey')`).
provide('sourceKey', sourceKey)

function routeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function handoffQuery(name: string) {
  const routeValue = routeText(route.query[name])
  if (routeValue) return routeValue
  const hash = window.location.hash
  const queryStart = hash.indexOf('?')
  return queryStart >= 0 ? (new URLSearchParams(hash.slice(queryStart + 1)).get(name) ?? '').trim() : ''
}

const hasCohortHandoff = computed(() => Boolean(
  handoffQuery('cohortStudyAgentSession') && handoffQuery('cohortConceptSetSlot'),
))

async function openCohortHandoffWorkbench() {
  const sessionId = handoffQuery('cohortStudyAgentSession')
  const slotId = handoffQuery('cohortConceptSetSlot')
  if (!sessionId || !slotId) return
  const stored = getStudyAgentCohortConceptSetHandoff()
  const label = handoffQuery('cohortConceptSetLabel') || stored?.label || 'Cohort concept set'
  const domain = handoffQuery('cohortConceptSetDomain') || stored?.domain || 'the requested OMOP domain'
  const criterionRole = handoffQuery('cohortCriterionRole') || stored?.criterionRole || 'cohort criterion'
  const handoffKey = `${sessionId}:${slotId}`
  if (openedCohortHandoffKey === handoffKey && conceptSetsStore.editorOpen) return
  activeCohortHandoff.value = { cohortSessionId: sessionId, slotId, label, domain, criterionRole }
  activeTab.value = 'sets'
  studyAgentStore.queueNarrative(
    `Create a reusable ${domain} concept set for the cohort building block “${label}”. `
    + `It will be used as ${criterionRole.replace(/_/g, ' ')} evidence. `
    + 'Review terminology policy only; cohort timing and Boolean logic stay in the cohort definition.',
  )
  conceptSetsStore.openCreateEditor()
  await nextTick()
  openedCohortHandoffKey = handoffKey
}

async function onEditorSave() {
  activeCohortHandoff.value = null
  await conceptSetsStore.fetchAll()
}

function onEditorDelete() {
  // ConceptSetEditor performs the asynchronous delete so it can keep the
  // drawer open and show the server error on failure. This handler only clears
  // the page-level handoff state after a confirmed deletion.
  activeCohortHandoff.value = null
  conceptSetsStore.closeEditor()
}

// Watch for tab changes and update URL. `immediate: true` syncs the URL to
// the default tab on mount so deep-links / query params stay accurate.
watch(
  activeTab,
  newTab => {
    if (route.query.tab !== newTab) {
      router.replace({ query: { ...route.query, tab: newTab } })
    }
  },
  { immediate: true }
)
// This page can remain mounted under the host shell. Read session storage at
// route-transition time rather than capturing an old handoff at component mount.
watch(
  () => [route.query.cohortStudyAgentSession, route.query.cohortConceptSetSlot] as const,
  async () => { await openCohortHandoffWorkbench() },
  { immediate: true, flush: 'post' },
)

onMounted(() => {
  // The host shell may update the hash after Vue's first route watcher. Retry
  // once from the concrete browser URL; the action is idempotent.
  window.setTimeout(() => { void openCohortHandoffWorkbench() }, 0)
})

</script>

<style scoped>
.concepts-view {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

/* The shared .page-tabs-rail provides padding + bottom border;
 * pull the rail flush to the page-shell card by negating the card's
 * horizontal padding so the rail spans the full width. With the hero
 * header above, the rail flows below it naturally — no negative
 * top margin. */
.concepts-view__cohort-handoff { display: flex; align-items: center; gap: 12px; margin: 0 0 16px; padding: 12px 16px; border: 1px solid rgb(var(--v-theme-primary)); border-radius: 6px; background: rgba(var(--v-theme-primary), .05); }
.concepts-view__cohort-handoff span { flex: 1; color: rgb(var(--v-theme-on-surface-variant)); }
.concepts-view__tabs-rail {
  margin-inline: -32px;
  margin-bottom: 16px;
  padding-inline: 32px;
}
</style>
