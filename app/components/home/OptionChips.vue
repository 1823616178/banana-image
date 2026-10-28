<script setup lang="ts">
export interface ChipOption {
  value: string | number
  label: string
  hint?: string
}

const props = defineProps<{
  label: string
  options: readonly ChipOption[]
  modelValue: string | number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const labelId = useId()
const selected = (value: string | number) => String(value) === String(props.modelValue)
</script>

<template>
  <fieldset class="container_home_options_side_group" :aria-labelledby="labelId">
    <legend :id="labelId" class="container_home_options_side_label">{{ label }}</legend>
    <div class="container_home_options_side_chips">
      <button
        v-for="option in options"
        :key="option.value"
        class="container_home_options_side_chip"
        :class="{ 'is-active': selected(option.value) }"
        type="button"
        :title="option.hint"
        :aria-pressed="selected(option.value)"
        @click="emit('update:modelValue', option.value)"
      >{{ option.label }}</button>
    </div>
  </fieldset>
</template>

<style scoped lang="scss">
.container_home_options_side_group {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.container_home_options_side_label {
  margin-bottom: 9px;
  color: var(--color-ink-soft);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.container_home_options_side_chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.container_home_options_side_chip {
  @include paint-chip;
  min-height: 34px;
  padding: 5px 12px;
  font-size: 13px;
}
</style>
