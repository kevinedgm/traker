import { nextTick, onBeforeUnmount, onMounted, unref, watch } from 'vue'

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isVisible(element) {
  if (element.hidden || element.closest('[inert]')) return false
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

export function useModalFocus(container, options = {}) {
  let previouslyFocused = null
  let appRoot
  let previousInert = false
  let previousAriaHidden
  let previousOverflow = ''
  let active = false
  let stopEnabledWatch = null

  const enabled = () => options.enabled === undefined || Boolean(unref(options.enabled))
  const focusableElements = () => Array.from(container.value?.querySelectorAll(FOCUSABLE) ?? []).filter(isVisible)

  function focusInitial() {
    const root = container.value
    if (!root) return
    const requested = unref(options.initialFocus)
    const target = typeof requested === 'string'
      ? root.querySelector(requested)
      : requested
    ;(target ?? focusableElements()[0] ?? root).focus({ preventScroll: true })
  }

  function handleKeydown(event) {
    if (!enabled() || !container.value) return
    if (event.key === 'Escape') {
      event.preventDefault()
      options.onClose?.()
      return
    }
    if (event.key !== 'Tab') return

    const focusable = focusableElements()
    if (!focusable.length) {
      event.preventDefault()
      container.value.focus({ preventScroll: true })
      return
    }
    const first = focusable[0]
    const last = focusable.at(-1)
    const active = document.activeElement
    if (event.shiftKey && (active === first || !container.value.contains(active))) {
      event.preventDefault()
      last.focus({ preventScroll: true })
    } else if (!event.shiftKey && (active === last || !container.value.contains(active))) {
      event.preventDefault()
      first.focus({ preventScroll: true })
    }
  }

  async function activate() {
    if (active) return
    if (!container.value) await nextTick()
    if (!enabled() || !container.value) return
    active = true
    previouslyFocused = document.activeElement
    appRoot = document.querySelector('#app')
    if (appRoot) {
      previousInert = appRoot.inert
      previousAriaHidden = appRoot.getAttribute('aria-hidden')
      appRoot.inert = true
      appRoot.setAttribute('aria-hidden', 'true')
    }
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeydown, true)
    await nextTick()
    if (active) focusInitial()
  }

  function deactivate({ restoreFocus = true } = {}) {
    if (!active) return
    active = false
    document.removeEventListener('keydown', handleKeydown, true)
    document.body.style.overflow = previousOverflow
    if (appRoot) {
      appRoot.inert = previousInert
      if (previousAriaHidden === null) appRoot.removeAttribute('aria-hidden')
      else appRoot.setAttribute('aria-hidden', previousAriaHidden)
    }
    if (restoreFocus && previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
      previouslyFocused.focus({ preventScroll: true })
    }
    previouslyFocused = null
    appRoot = null
  }

  onMounted(() => {
    stopEnabledWatch = watch(
      enabled,
      value => { if (value) activate(); else deactivate() },
      { immediate: true, flush: 'post' },
    )
  })

  onBeforeUnmount(() => {
    stopEnabledWatch?.()
    deactivate()
  })
}
