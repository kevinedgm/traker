import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TodayOpening from './TodayOpening.vue'

const baseOpening = {
  id: 'daily.traker.01',
  title: 'Un inicio pequeño cuenta',
  body: 'Elige qué mínimo quieres mover hoy y empieza por ahí.',
  sourceType: 'traker',
  sourceLabel: 'Mensaje de Traker',
  catalogVersion: '2026.08.31.2',
  attribution: null,
  personalContext: null,
}

describe('TodayOpening', () => {
  it('identifica el mensaje editorial como propio de Traker', () => {
    const wrapper = mount(TodayOpening, { props: { opening: baseOpening } })

    expect(wrapper.attributes('data-source-type')).toBe('traker')
    expect(wrapper.attributes('data-catalog-version')).toBe('2026.08.31.2')
    expect(wrapper.text()).toContain('Mensaje de Traker')
    expect(wrapper.find('blockquote').exists()).toBe(false)
    expect(wrapper.find('cite').exists()).toBe(false)
  })

  it('muestra el motivo personal como contexto privado separado', () => {
    const wrapper = mount(TodayOpening, {
      props: {
        opening: {
          ...baseOpening,
          personalContext: {
            sourceType: 'personal',
            sourceLabel: 'Tu motivo',
            text: 'Quiero recordar para qué empecé.',
          },
        },
      },
    })

    expect(wrapper.get('.today-opening__personal').text()).toContain('Tu motivo')
    expect(wrapper.get('.today-opening__personal').text()).toContain('Quiero recordar para qué empecé.')
  })

  it('sólo usa cita y enlace de fuente con atribución completa', () => {
    const wrapper = mount(TodayOpening, {
      props: {
        opening: {
          ...baseOpening,
          sourceType: 'quote',
          sourceLabel: 'Cita verificada',
          body: 'Texto verificado.',
          attribution: {
            author: 'Autora',
            work: 'Obra',
            source: 'https://example.com/source',
          },
        },
      },
    })

    expect(wrapper.get('blockquote').text()).toBe('Texto verificado.')
    expect(wrapper.get('cite').text()).toBe('Obra')
    expect(wrapper.get('a').attributes('href')).toBe('https://example.com/source')
  })
})
