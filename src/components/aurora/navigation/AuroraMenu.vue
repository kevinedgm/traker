<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({ items: { default: () => [] }, open: Boolean, align: { default: 'right' } })
const emit = defineEmits(['select', 'close'])
const menu = ref(null)
let trigger = null

function menuItems() { return Array.from(menu.value?.querySelectorAll('[role="menuitem"]') ?? []) }
function focusAt(index) {
  const controls = menuItems()
  if (!controls.length) return
  controls[(index + controls.length) % controls.length].focus()
}
function close({ restoreFocus = true } = {}) {
  emit('close')
  if (restoreFocus) nextTick(() => trigger?.focus())
}
function onKeydown(event) {
  const controls = menuItems()
  const index = controls.indexOf(document.activeElement)
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key === 'Tab') { close({ restoreFocus: false }); return }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  if (event.key === 'Home') focusAt(0)
  else if (event.key === 'End') focusAt(controls.length - 1)
  else focusAt(index + (event.key === 'ArrowDown' ? 1 : -1))
}

watch(() => props.open, async open => {
  if (!open) return
  trigger = document.activeElement
  await nextTick()
  focusAt(0)
})
onBeforeUnmount(() => { if (props.open) trigger?.focus() })
</script>
<template><div v-if="open" ref="menu" class="menu aurora-glass" :class="`menu--${align}`" role="menu" @keydown="onKeydown"><button v-for="i in props.items" :key="i.value" type="button" role="menuitem" :class="{danger:i.destructive}" @click="$emit('select',i.value)"><component :is="i.icon" v-if="i.icon" aria-hidden="true"/>{{i.label}}</button></div></template>
<style scoped>.menu{position:absolute;z-index:50;top:calc(100% + 8px);min-width:190px;padding:6px;border-radius:var(--radius-md);box-shadow:var(--elev-3)}.menu--right{right:0}.menu--left{left:0}button{display:flex;align-items:center;gap:9px;width:100%;min-height:40px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:var(--text-secondary);font:500 14px var(--font-core);text-align:left}.danger{color:var(--status-destructive)}</style>
