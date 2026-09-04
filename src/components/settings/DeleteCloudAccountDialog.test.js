import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import DeleteCloudAccountDialog from './DeleteCloudAccountDialog.vue'

describe('DeleteCloudAccountDialog', () => {
  it('requires the exact destructive phrase before emitting confirmation', async () => {
    const wrapper = mount(DeleteCloudAccountDialog, {
      props: { open: true, email: 'persona@example.invalid' },
      attachTo: document.body,
    })
    const confirmButton = [...document.body.querySelectorAll('button')]
      .find(button => button.textContent.includes('Borrar para siempre'))
    expect(confirmButton.disabled).toBe(true)

    const fields = document.body.querySelectorAll('input')
    fields[1].value = 'borrar'
    fields[1].dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(confirmButton.disabled).toBe(true)
    fields[1].value = 'BORRAR'
    fields[1].dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(confirmButton.disabled).toBe(false)
    confirmButton.click()
    await nextTick()

    expect(wrapper.emitted('confirm')).toEqual([[{ confirmation: 'BORRAR', password: '' }]])
    wrapper.unmount()
  })

  it('keeps the modal open and reports server failures without losing input', async () => {
    const wrapper = mount(DeleteCloudAccountDialog, {
      props: { open: true, error: 'La cuenta sigue intacta.' },
      attachTo: document.body,
    })
    expect(document.querySelector('[role="alert"]').textContent).toContain('sigue intacta')
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull()
    wrapper.unmount()
  })
})
