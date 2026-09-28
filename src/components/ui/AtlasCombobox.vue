<!-- src/components/ui/AtlasCombobox.vue -->
<template>
  <v-combobox
    :model-value="modelValue"
    :items="items"
    :label="displayLabel"
    :hint="hint"
    :error-messages="errorMessages"
    :disabled="disabled"
    :item-title="itemTitle"
    :item-value="itemValue"
    :clearable="clearable"
    :placeholder="placeholder"
    :aria-required="required ? 'true' : undefined"
    :aria-invalid="hasError ? 'true' : undefined"
    density="compact"
    v-bind="forwardAttrs"
    @update:model-value="(value: unknown) => $emit('update:modelValue', value)"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

interface Props {
  modelValue?: unknown
  items: unknown[]
  label?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  itemTitle?: string
  itemValue?: string
  clearable?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  label: undefined,
  hint: undefined,
  error: undefined,
  required: false,
  disabled: false,
  itemTitle: 'title',
  itemValue: 'value',
  clearable: false,
  placeholder: undefined,
})

defineEmits<{ 'update:modelValue': [value: unknown] }>()
defineOptions({ inheritAttrs: false })

const displayLabel = computed(() => props.required && props.label ? `${props.label} *` : props.label)
const errorMessages = computed(() => (props.error ? [props.error] : undefined))
const hasError = computed(() => !!props.error)
const attrs = useAttrs()
const forwardAttrs = computed(() => {
  const { density: _density, ...rest } = attrs as Record<string, unknown>
  void _density
  return rest
})
</script>
