<template>
  <AtlasDialog
    v-model="open"
    eyebrow="/ohdsi"
    title="How can I help?"
    max-width="720"
    @close="reset"
  >
    <p class="study-agent-landing-dialog__hint">
      I can help you plan real-world evidence work with the data sources available to you. Describe what you want to do. Do not include patient-level information.
    </p>
    <AtlasTextField
      v-model="message"
      label="What would you like to do?"
      multiline
      :rows="4"
      variant="outlined"
      placeholder="For example: Create a phenotype for multiple myeloma."
      :disabled="loading"
      @keydown.ctrl.enter="ask"
    />
    <AtlasAlert
      v-if="error"
      severity="danger"
      density="compact"
      class="mt-3"
    >
      {{ error }}
    </AtlasAlert>
    <section
      v-if="dialogue"
      class="study-agent-landing-dialog__response"
    >
      <h3>{{ displayText(dialogue.plan) || 'Suggested next step' }}</h3>
      <p v-if="dialogue.answer">
        {{ displayText(dialogue.answer) }}
      </p>
      <div class="study-agent-landing-dialog__routes">
        <p>Choose how to begin this cohort-definition task.</p>
        <div>
          <AtlasButton @click="startCohortAuthoring('ai_search')">
            Search existing phenotypes
          </AtlasButton>
          <AtlasButton
            variant="secondary"
            @click="startCohortAuthoring('library')"
          >
            Browse phenotype library
          </AtlasButton>
          <AtlasButton
            variant="secondary"
            @click="startCohortAuthoring('make_computable')"
          >
            Create a new cohort definition
          </AtlasButton>
        </div>
      </div>
      <details v-if="hasDetails">
        <summary>More guidance and considerations</summary>
        <div class="study-agent-landing-dialog__details">
          <template v-if="displayGuidance.current_step_guidance.length">
            <h4>Next steps</h4>
            <ul>
              <li
                v-for="item in displayGuidance.current_step_guidance"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </template>
          <template v-if="displayGuidance.cautions.length">
            <h4>Considerations</h4>
            <ul>
              <li
                v-for="item in displayGuidance.cautions"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </template>
          <template v-if="displayGuidance.suggested_next_actions.length">
            <h4>Other options</h4>
            <ul>
              <li
                v-for="item in displayGuidance.suggested_next_actions"
                :key="item"
              >
                {{ item }}
              </li>
            </ul>
          </template>
        </div>
      </details>
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
        :disabled="!message.trim() || loading"
        :loading="loading"
        @click="ask"
      >
        Ask /ohdsi
      </AtlasButton>
    </template>
  </AtlasDialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { AtlasAlert, AtlasButton, AtlasDialog, AtlasTextField } from '@/components/ui'
import { askStudyAgentLandingDialogue, type StudyAgentLandingDialogue } from '@/services/study-agent-cohort-definition.service'
import type { StudyAgentCohortRoute } from '@/models/study-agent.types'

const open = defineModel<boolean>({ required: true })
const router = useRouter()
const message = ref('')
const dialogue = ref<StudyAgentLandingDialogue | null>(null)
const loading = ref(false)
const error = ref('')
function displayText(value: string | undefined): string {
  return String(value ?? '').replace(/start_cohort_authoring/g, 'Start cohort authoring')
}

function displayItems(values: string[] | undefined): string[] {
  return (values ?? []).map(displayText).filter(Boolean)
}

const displayGuidance = computed(() => ({
  current_step_guidance: displayItems(dialogue.value?.current_step_guidance),
  cautions: displayItems(dialogue.value?.cautions),
  suggested_next_actions: displayItems(dialogue.value?.suggested_next_actions),
}))
const hasDetails = computed(() => Object.values(displayGuidance.value).some(values => values.length > 0))

async function ask() {
  if (!message.value.trim() || loading.value) return
  loading.value = true
  error.value = ''
  try {
    dialogue.value = (await askStudyAgentLandingDialogue(message.value.trim())).dialogue
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Unable to contact /ohdsi.'
  } finally {
    loading.value = false
  }
}

function startCohortAuthoring(route: StudyAgentCohortRoute) {
  const narrative = message.value.trim()
  window.sessionStorage.setItem('study-agent-home-launch', '1')
  window.sessionStorage.setItem('study-agent-home-narrative', narrative)
  window.sessionStorage.setItem('study-agent-home-context', JSON.stringify(dialogue.value ?? {}))
  open.value = false
  void router.push({
    path: '/cohorts',
    query: { studyAgentStart: '1', studyAgentNarrative: narrative, studyAgentRoute: route },
  })
}

function reset() {
  open.value = false
  message.value = ''
  dialogue.value = null
  error.value = ''
}
</script>

<style scoped>
.study-agent-landing-dialog__hint { margin: 0 0 16px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-landing-dialog__response { margin-top: 20px; padding: 16px; border: 1px solid rgb(var(--v-theme-outline-variant)); border-radius: 8px; }
.study-agent-landing-dialog__response h3 { margin: 0 0 8px; }
.study-agent-landing-dialog__response p { margin: 0 0 16px; }
.study-agent-landing-dialog__routes { margin-top: 18px; }
.study-agent-landing-dialog__routes p { margin-bottom: 8px; }
.study-agent-landing-dialog__routes > div { display: flex; flex-wrap: wrap; gap: 8px; }
.study-agent-landing-dialog__response details { margin-top: 16px; }
.study-agent-landing-dialog__response summary { cursor: pointer; font-weight: 600; }
.study-agent-landing-dialog__details { margin-top: 12px; color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-landing-dialog__details h4 { margin: 12px 0 4px; color: rgb(var(--v-theme-on-surface)); }
.study-agent-landing-dialog__details ul { margin: 4px 0; padding-left: 20px; }
</style>
