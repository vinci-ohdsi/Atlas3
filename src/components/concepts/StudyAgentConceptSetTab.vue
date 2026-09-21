<template>
  <section class="study-agent-concept-set-tab">
    <div class="study-agent-concept-set-tab__intro">
      <h2>/ohdsi assistant</h2>
      <p>
        Describe the concept-set goal with <code>/ohdsi</code>. Suggestions are advisory;
        they do not change the selected expression.
      </p>
    </div>

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
        Ask /ohdsi
      </AtlasButton>
    </div>

    <AtlasAlert
      v-if="assistant.error"
      severity="danger"
      class="mt-4"
    >
      {{ assistant.error }}
    </AtlasAlert>

    <div
      v-if="dialogue"
      class="study-agent-concept-set-tab__response"
    >
      <p
        v-if="showAssistantMessage"
        class="study-agent-concept-set-tab__message"
      >
        {{ assistant.session?.assistant_message }}
      </p>
      <p v-if="dialogue.answer">
        {{ dialogue.answer }}
      </p>
      <p v-if="typeof dialogue.current_step_guidance === 'string'">
        <strong>Next step:</strong> {{ dialogue.current_step_guidance }}
      </p>
      <div v-else-if="dialogue.current_step_guidance?.length">
        <h3>Next steps</h3>
        <ul>
          <li
            v-for="step in dialogue.current_step_guidance"
            :key="step"
          >
            {{ step }}
          </li>
        </ul>
      </div>

      <div v-if="dialogue.plan">
        <h3>Suggested strategy</h3>
        <p>{{ dialogue.plan }}</p>
      </div>
      <div v-if="dialogue.cautions?.length">
        <h3>Review considerations</h3>
        <ul>
          <li
            v-for="caution in dialogue.cautions"
            :key="caution"
          >
            {{ caution }}
          </li>
        </ul>
      </div>
      <div v-if="dialogue.suggested_next_actions?.length">
        <h3>Possible next actions</h3>
        <ul>
          <li
            v-for="action in dialogue.suggested_next_actions"
            :key="action"
          >
            {{ action }}
          </li>
        </ul>
      </div>
    </div>

    <div
      v-if="canReply"
      class="study-agent-concept-set-tab__follow-up"
    >
      <AtlasTextField
        v-model="followUp"
        label="Continue /ohdsi dialogue"
        placeholder="For example: include clinical drugs and exclude products containing protamine."
        :disabled="assistant.loading"
        multiline
        :rows="3"
        variant="outlined"
        hide-details
      />
      <div class="study-agent-concept-set-tab__actions">
        <AtlasButton
          :disabled="!followUp.trim() || assistant.loading"
          :loading="assistant.loading"
          @click="reply"
        >
          Continue /ohdsi
        </AtlasButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { AtlasAlert, AtlasButton, AtlasTextField } from '@/components/ui'
import { useStudyAgentConceptSetStore } from '@/stores/study-agent-concept-set'

interface Props {
  active: boolean
  mode: 'new' | 'extension'
  conceptSetId?: number | string
  sourceKey?: string
}

const props = defineProps<Props>()
const assistant = useStudyAgentConceptSetStore()
const narrative = ref('')
const followUp = ref('')
const canSubmit = computed(() => narrative.value.trim().toLowerCase().startsWith('/ohdsi '))
const dialogue = computed(() => assistant.session?.dialogue)
const canReply = computed(() => assistant.session?.allowed_actions?.includes('reply') ?? false)
const showAssistantMessage = computed(() => {
  const message = assistant.session?.assistant_message
  return !!message && message !== dialogue.value?.answer
})

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
      },
    })
  } catch {
    // The store retains a user-facing error; avoid a second unhandled UI error.
  }
}

async function reply() {
  const message = followUp.value.trim()
  if (!message) return
  try {
    await assistant.reply({ message })
    followUp.value = ''
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
.study-agent-concept-set-tab__intro h2, .study-agent-concept-set-tab__response h3 { color: rgb(var(--v-theme-primary)); }
.study-agent-concept-set-tab__intro p { color: rgb(var(--v-theme-on-surface-variant)); }
.study-agent-concept-set-tab__actions { margin-top: 16px; }
.study-agent-concept-set-tab__response { margin-top: 24px; border-top: 1px solid rgb(var(--v-theme-outline-variant)); padding-top: 20px; }
.study-agent-concept-set-tab__message { font-weight: 600; }
.study-agent-concept-set-tab__follow-up { margin-top: 24px; border-top: 1px solid rgb(var(--v-theme-outline-variant)); padding-top: 20px; }
</style>
