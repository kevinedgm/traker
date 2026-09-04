import { AxePuppeteer } from '@axe-core/puppeteer'

function compactViolation(violation) {
  const targets = violation.nodes
    .slice(0, 2)
    .flatMap(node => node.target)
    .join(',')
  return `${violation.id}:${violation.impact ?? 'unknown'}:${targets}`
}

export async function assertAccessible(page, { include, label = 'surface' } = {}) {
  let audit = new AxePuppeteer(page)
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  if (include) audit = audit.include(include)

  const result = await audit.analyze()
  if (result.violations.length) {
    const evidence = result.violations.slice(0, 4).map(compactViolation).join('|')
    throw new Error(`A11Y_${label}:${evidence}`)
  }
  return result
}
