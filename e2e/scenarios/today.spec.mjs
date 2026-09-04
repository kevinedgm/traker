import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  allMinimumsFixture,
  baseFixture,
  consciousClosureFixture,
  crowdedHabitsFixture,
  dueNotificationFixture,
  familyHabitFixture,
  flexibleActivitiesFixture,
  gymHabitFixture,
  lowEnergyFixture,
  milestoneCompletionFixture,
  multiHabitRewardFixture,
  noMoodFixture,
  offlineReloadFixture,
  portabilityFixture,
  quietDayFixture,
  returningAfterTwoWeeksFixture,
  reformulationFixture,
  sharedHabitFixture,
  threeGoalsFixture,
} from '../fixtures/today.mjs'
import { assert, bodyIncludes, clickByText, countText, prepareFixture, readIndexedDbStore, readLocalStorage, unlockApp } from '../lib/harness.mjs'
import { assertAccessible } from '../lib/accessibility.mjs'

async function mockNotificationPermission(page, permission) {
  await page.evaluateOnNewDocument(value => {
    window.__notificationRequestCount = 0
    class MockNotification {
      static get permission() { return value }
      static async requestPermission() {
        window.__notificationRequestCount += 1
        return value
      }
    }
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: MockNotification,
    })
  }, permission)
}

async function openSettings(page) {
  await page.click('[aria-label="Abrir perfil y ajustes"]')
  await page.waitForSelector('.sp')
}

async function focusVisibleControl(page, label) {
  const focused = await page.evaluate(expected => {
    const control = [...document.querySelectorAll(`[aria-label="${CSS.escape(expected)}"]`)]
      .find(element => element.getClientRects().length > 0)
    control?.focus()
    return document.activeElement === control
  }, label)
  assert(focused, `KEYBOARD_CONTROL_NOT_FOCUSABLE:${label}`)
}

async function openNotificationDiagnostics(page) {
  await openSettings(page)
  const opened = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.sp-row')]
      .find(element => element.textContent.includes('Diagnóstico y prueba'))
    const button = row?.querySelector('button')
    if (!button) return false
    button.click()
    return true
  })
  assert(opened, 'NOTIFICATION_DIAGNOSTICS_LINK_MISSING')
  await page.waitForSelector('.nd')
  await page.waitForFunction(() => !document.body.innerText.includes('Comprobando…'))
}

async function openHabitLog(page, habitName) {
  await page.waitForSelector(`[aria-label="Registrar ${habitName}"]`)
  await page.click(`[aria-label="Registrar ${habitName}"]`)
  await page.waitForSelector('.lm-decisions')
}

async function chooseLogDecision(page, label) {
  await clickByText(page, '.lm-decisions button', label)
  await page.waitForFunction(expected => [...document.querySelectorAll('.lm-decisions button')]
    .some(button => button.querySelector('strong')?.textContent.trim() === expected
      && button.getAttribute('aria-pressed') === 'true'), {}, label)
}

async function saveHabitLog(page) {
  await clickByText(page, 'button', 'Guardar registro')
  await page.waitForSelector('.lm-decisions', { hidden: true })
}

async function storedHabitLog(page) {
  const saved = await readLocalStorage(page, 'traker:habits')
  return Object.values(saved?.habits?.[0]?.logs ?? {})[0] ?? null
}

async function openPrimaryNav(page, label, pageSelector) {
  const clicked = await page.evaluate(expected => {
    const button = [...document.querySelectorAll(`[aria-label="${CSS.escape(expected)}"]`)]
      .find(element => element.getClientRects().length > 0)
    if (!button) return false
    button.click()
    return true
  }, label)
  assert(clicked, `PRIMARY_NAV_NOT_FOUND:${label}`)
  await page.waitForSelector(pageSelector)
}

async function setLabeledField(page, labelText, value) {
  const changed = await page.evaluate(({ labelText: expected, value: nextValue }) => {
    const label = [...document.querySelectorAll('label')]
      .find(element => element.textContent.trim().startsWith(expected))
    const control = label?.querySelector('input, textarea, select')
    if (!control) return false
    control.value = nextValue
    control.dispatchEvent(new Event('input', { bubbles: true }))
    control.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }, { labelText, value })
  assert(changed, `LABELED_FIELD_NOT_FOUND:${labelText}`)
}

async function signInTemporaryUser(page, auth) {
  const result = await page.evaluate(async credentials => {
    const { signInWithPassword } = await import('/src/services/supabase/auth.service.js')
    const { ensureV2PilotOwner } = await import('/src/services/supabase/sync.service.js')
    const { data, error } = await signInWithPassword(credentials.email, credentials.password)
    if (error) return { error: error.message }
    const ownership = await ensureV2PilotOwner(data.user.id)
    return { error: null, ownership }
  }, auth)
  assert(!result.error, 'TWO_DEVICE_AUTH_FAILED')
  assert(result.ownership?.allowed, 'TWO_DEVICE_OWNER_BOUNDARY_FAILED')
}

export const todayScenarios = [
  {
    id: '01-three-goals',
    title: 'Inicio del día con tres metas',
    fixture: threeGoalsFixture,
    async run(page) {
      await page.waitForFunction(() => document.body.innerText.includes('Dirección 1'))
      const goalCount = await page.evaluate(async () => {
        const request = indexedDB.open('traker-goals', 1)
        const db = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const transaction = db.transaction('goals', 'readonly')
        const countRequest = transaction.objectStore('goals').count()
        const count = await new Promise((resolve, reject) => {
          countRequest.onsuccess = () => resolve(countRequest.result)
          countRequest.onerror = () => reject(countRequest.error)
        })
        db.close()
        return count
      })
      assert(goalCount === 3, 'EXPECTED_THREE_GOALS_IN_FIXTURE')
      assert(await bodyIncludes(page, 'Paso disponible 1'), 'FOCUSED_GOAL_ACTION_NOT_VISIBLE')
      assert(await bodyIncludes(page, 'TU MOTIVO'), 'PERSONAL_REASON_NOT_SEPARATED')
    },
  },
  {
    id: '02-crowded-day',
    title: 'Día con demasiados hábitos; se muestran tres',
    fixture: crowdedHabitsFixture,
    async run(page) {
      await page.waitForFunction(() => document.body.innerText.includes('3 de 8 visibles'))
      const visible = await page.$$eval('.habit-list__items [role="listitem"]', elements => elements.length)
      assert(visible === 3, 'EXPECTED_THREE_VISIBLE_HABITS')
      assert(await bodyIncludes(page, 'Ver 5 hábitos más'), 'PROGRESSIVE_DISCLOSURE_CONTROL_MISSING')
    },
  },
  {
    id: '03-shared-habit-once',
    title: 'Un hábito ligado a dos metas aparece una vez',
    fixture: sharedHabitFixture,
    async run(page) {
      await page.waitForFunction(() => document.body.innerText.includes('Actividad compartida'))
      assert(await countText(page, 'Actividad compartida') === 1, 'SHARED_HABIT_DUPLICATED')
      const cards = await page.$$eval('.habit-list__items [role="listitem"]', elements => elements.length)
      assert(cards === 1, 'EXPECTED_ONE_SHARED_HABIT_CARD')
    },
  },
  {
    id: '04-flexible-activities',
    title: 'Bloque de actividades alternables',
    fixture: flexibleActivitiesFixture,
    async run(page) {
      await page.waitForFunction(() => document.body.innerText.includes('Movimiento flexible'))
      assert(await bodyIncludes(page, 'Estas son alternativas, no una lista de pendientes.'), 'FLEXIBLE_EXPLANATION_MISSING')
      const options = await page.$$eval('.flex-options__list button', elements => elements.length)
      assert(options === 3, 'EXPECTED_THREE_FLEXIBLE_OPTIONS')
      const standardCards = await page.$$eval('.habit-list__items [role="listitem"]', elements => elements.length)
      assert(standardCards === 0, 'FLEXIBLE_HABIT_REPEATED_IN_STANDARD_LIST')
    },
  },
  {
    id: '05-gym-completed',
    title: 'Registro exitoso del gimnasio',
    fixture: gymHabitFixture,
    async run(page) {
      await openHabitLog(page, 'Gimnasio')
      await chooseLogDecision(page, 'Sí')
      await saveHabitLog(page)

      const log = await storedHabitLog(page)
      assert(log?.status === 'done', 'GYM_LOG_STATUS_NOT_DONE')
      assert(log?.minimumUsed === false, 'GYM_LOG_UNEXPECTED_MINIMUM')
      assert(log?.level === 3, 'GYM_LOG_LEGACY_LEVEL_NOT_REVERSIBLE')
      assert(await bodyIncludes(page, 'Deshacer'), 'GYM_LOG_CONFIRMATION_MISSING')
    },
  },
  {
    id: '06-partial-log',
    title: 'Registro parcial',
    fixture: gymHabitFixture,
    async run(page) {
      await openHabitLog(page, 'Gimnasio')
      await chooseLogDecision(page, 'A medias')
      assert(await bodyIncludes(page, 'Usé mi versión mínima'), 'PARTIAL_MINIMUM_CONTEXT_MISSING')
      await saveHabitLog(page)

      const log = await storedHabitLog(page)
      assert(log?.status === 'partial', 'PARTIAL_LOG_STATUS_MISMATCH')
      assert(log?.minimumUsed === false, 'PARTIAL_LOG_MINIMUM_SHOULD_BE_OPTIONAL')
      assert(log?.level === 2, 'PARTIAL_LOG_LEGACY_LEVEL_NOT_REVERSIBLE')
    },
  },
  {
    id: '07-negative-no-context',
    title: 'Registro negativo sin explicar motivo',
    fixture: gymHabitFixture,
    async run(page) {
      await openHabitLog(page, 'Gimnasio')
      await chooseLogDecision(page, 'No')
      assert(await bodyIncludes(page, 'Añadir contexto opcional'), 'OPTIONAL_CONTEXT_DISCLOSURE_MISSING')
      await saveHabitLog(page)

      const log = await storedHabitLog(page)
      assert(log?.status === 'not_done', 'NEGATIVE_LOG_STATUS_MISMATCH')
      assert(log?.minimumUsed === false, 'NEGATIVE_LOG_UNEXPECTED_MINIMUM')
      assert(log?.level === 0, 'NEGATIVE_LOG_LEGACY_LEVEL_NOT_REVERSIBLE')
      assert(log?.emotion === null, 'NEGATIVE_LOG_REQUIRED_EMOTION')
      assert(log?.energy === null, 'NEGATIVE_LOG_REQUIRED_ENERGY')
      assert(log?.note === '', 'NEGATIVE_LOG_REQUIRED_NOTE')
      assert((log?.contextCodes ?? []).length === 0, 'NEGATIVE_LOG_REQUIRED_CONTEXT_CODE')
    },
  },
  {
    id: '08-family-sensitive-copy',
    title: 'Registro negativo con contexto familiar y copy sensible',
    fixture: familyHabitFixture,
    async run(page) {
      await openHabitLog(page, 'Llamar a mi familia')
      await chooseLogDecision(page, 'No')
      await saveHabitLog(page)

      const copyState = await readLocalStorage(page, 'traker:copy-state')
      const phraseIds = copyState?.recent?.['habit_skipped:family'] ?? []
      assert(phraseIds.length === 1, 'FAMILY_COPY_HISTORY_MISSING')
      assert(/^generic\.habit_skipped\.trusted\./.test(phraseIds[0]), 'FAMILY_COPY_DID_NOT_DEGRADE_TO_TRUSTED')
      assert(await bodyIncludes(page, 'Deshacer'), 'FAMILY_LOG_CONFIRMATION_MISSING')
    },
  },
  {
    id: '09-low-energy-checkin',
    title: 'Día con energía baja',
    fixture: lowEnergyFixture,
    async run(page) {
      await clickByText(page, 'button', 'Hacer check-in')
      await page.waitForSelector('[aria-label="2 de 5, energía Baja"]')
      await page.click('[aria-label="2 de 5, energía Baja"]')
      await clickByText(page, 'button', 'Guardar check-in')
      await page.waitForSelector('[aria-label="2 de 5, energía Baja"]', { hidden: true })

      const saved = await readLocalStorage(page, 'traker:checkins')
      const checkin = saved?.checkins?.[0]
      assert(checkin?.energy === 2, 'LOW_ENERGY_VALUE_NOT_PERSISTED')
      assert(checkin?.loadFeeling === null, 'LOW_ENERGY_REQUIRED_LOAD')
      assert(checkin?.mood === null, 'LOW_ENERGY_REQUIRED_MOOD')
      assert(checkin?.pressure === null, 'LOW_ENERGY_REQUIRED_PRESSURE')
      assert((checkin?.contextCodes ?? []).length === 0, 'LOW_ENERGY_REQUIRED_CONTEXT')
      assert(checkin?.note === '', 'LOW_ENERGY_REQUIRED_NOTE')
      assert(checkin?.syncScope === 'local_only', 'LOW_ENERGY_DEFAULT_PRIVACY_CHANGED')
      assert(await bodyIncludes(page, 'energía baja'), 'LOW_ENERGY_SUMMARY_MISSING')
    },
  },
  {
    id: '10-all-minimums-met',
    title: 'Día con todos los mínimos cumplidos',
    fixture: allMinimumsFixture,
    async run(page) {
      await openHabitLog(page, 'Mínimo uno')
      await chooseLogDecision(page, 'Sí')
      await saveHabitLog(page)

      await openHabitLog(page, 'Mínimo dos')
      await chooseLogDecision(page, 'A medias')
      await page.click('.lm-secondary input[type="checkbox"]')
      await saveHabitLog(page)
      await page.waitForFunction(() => document.body.innerText.includes('Hoy fue suficiente.'))

      const saved = await readLocalStorage(page, 'traker:habits')
      const logs = saved?.habits?.map(item => Object.values(item.logs ?? {})[0]) ?? []
      assert(logs.length === 2, 'ALL_MINIMUMS_LOG_COUNT_MISMATCH')
      assert(logs[0]?.status === 'done' && logs[0]?.level === 3, 'FULL_MINIMUM_NOT_PERSISTED')
      assert(logs[1]?.status === 'partial' && logs[1]?.minimumUsed === true && logs[1]?.level === 1, 'ADAPTED_MINIMUM_NOT_PERSISTED')
      assert(await bodyIncludes(page, 'Lo demás no se convierte en deuda.'), 'SUFFICIENT_DAY_DEBT_COPY_MISSING')
    },
  },
  {
    id: '11-quiet-day-no-debt',
    title: 'Día sin actividades cumplidas, sin castigo ni deuda',
    fixture: quietDayFixture,
    async run(page) {
      await openHabitLog(page, 'Actividad de hoy')
      await chooseLogDecision(page, 'No')
      await saveHabitLog(page)
      await clickByText(page, 'button', 'Ver resumen')
      await page.waitForFunction(() => document.body.innerText.includes('Hoy no se movió. Y eso también se puede cerrar.'))
      assert(await bodyIncludes(page, 'No necesitas recuperar este día ni explicar por qué.'), 'QUIET_DAY_NON_PUNITIVE_COPY_MISSING')
      await clickByText(page, 'button', 'Cerrar por hoy')
      await page.waitForFunction(() => document.body.innerText.includes('Hoy no se movió. Y eso también se puede cerrar.'))

      const saved = await readLocalStorage(page, 'traker:day-closures')
      assert(saved?.closures?.[0]?.status === 'quiet', 'QUIET_DAY_CLOSURE_STATUS_MISMATCH')
      assert(saved?.closures?.[0]?.summary?.built === 0, 'QUIET_DAY_UNEXPECTED_PROGRESS')
    },
  },
  {
    id: '12-return-after-two-weeks',
    title: 'Regreso después de dos semanas',
    fixture: returningAfterTwoWeeksFixture,
    async run(page) {
      await page.waitForFunction(() => document.body.innerText.includes('Tu avance sigue seguro.'))
      assert(await bodyIncludes(page, 'Lo que ya hiciste permanece'), 'RETURN_HISTORY_REASSURANCE_MISSING')
      assert(await bodyIncludes(page, 'Hábito conservado'), 'RETURNING_HABIT_NOT_PRESERVED')
      assert(!await bodyIncludes(page, 'perdiste tu racha'), 'RETURN_STREAK_PUNISHMENT_VISIBLE')
      assert(!await bodyIncludes(page, 'recuperar 14'), 'RETURN_DEBT_VISIBLE')
    },
  },
  {
    id: '13-notification-ignored',
    title: 'Notificación ignorada',
    fixture: () => dueNotificationFixture(),
    setupPage: page => mockNotificationPermission(page, 'granted'),
    async run(page) {
      await page.waitForSelector('.notification-banner')
      assert(await bodyIncludes(page, 'Mínimo vigente'), 'CURRENT_AGENDA_MISSING_DURING_NOTIFICATION')
      await page.waitForSelector('.notification-banner', { hidden: true, timeout: 9_000 })

      const firstLog = await readLocalStorage(page, 'traker:notif-log')
      assert(firstLog?.length === 1, 'IGNORED_NOTIFICATION_LOG_COUNT_MISMATCH')
      assert(firstLog[0]?.status === 'delivered', 'IGNORED_NOTIFICATION_DELIVERY_NOT_RECORDED')
      assert(!Object.hasOwn(firstLog[0], 'interaction'), 'IGNORED_NOTIFICATION_INTERACTION_INFERRED')

      const nextEvaluation = await page.evaluate(async () => {
        const { runSchedulerTick } = await import('/src/services/notifications.service.js')
        return runSchedulerTick(new Date())
      })
      assert(nextEvaluation?.suppression === 'cooldown', 'IGNORED_NOTIFICATION_COOLDOWN_MISSING')
      const finalLog = await readLocalStorage(page, 'traker:notif-log')
      assert(finalLog?.length === 1, 'IGNORED_NOTIFICATION_DUPLICATED')
    },
  },
  {
    id: '14-notification-suppressed-after-complete',
    title: 'Notificación suprimida después de completar',
    fixture: () => dueNotificationFixture({ completed: true }),
    setupPage: page => mockNotificationPermission(page, 'granted'),
    async run(page) {
      const evaluation = await page.evaluate(async () => {
        const { runSchedulerTick } = await import('/src/services/notifications.service.js')
        return runSchedulerTick(new Date())
      })
      assert(evaluation?.suppression === 'not_due', 'COMPLETED_NOTIFICATION_NOT_SUPPRESSED')
      assert(!await page.$('.notification-banner'), 'COMPLETED_NOTIFICATION_WAS_SHOWN')
      const log = await readLocalStorage(page, 'traker:notif-log')
      assert((log ?? []).length === 0, 'COMPLETED_NOTIFICATION_WAS_RECORDED')
      assert(await bodyIncludes(page, 'Hoy fue suficiente.'), 'COMPLETED_DAY_STATE_MISSING')
    },
  },
  {
    id: '15-offline-recovery',
    title: 'Pérdida y recuperación de conexión',
    fixture: gymHabitFixture,
    async run(page, runtime) {
      await page.evaluate(() => import('/src/services/syncV2PilotBridge.service.js').then(() => true))
      await page.setOfflineMode(true)
      await page.evaluate(() => window.dispatchEvent(new Event('offline')))
      await page.waitForSelector('.shell__offline')
      assert(await bodyIncludes(page, 'Puedes seguir registrando'), 'OFFLINE_CONTINUITY_COPY_MISSING')

      await openHabitLog(page, 'Gimnasio')
      await chooseLogDecision(page, 'Sí')
      await saveHabitLog(page)
      await page.waitForFunction(() => {
        const queue = JSON.parse(localStorage.getItem('traker:sync-queue') || '[]')
        return queue.length === 1
      })
      const localLog = await storedHabitLog(page)
      assert(localLog?.status === 'done', 'OFFLINE_LOG_NOT_PERSISTED')

      await page.setOfflineMode(false)
      await page.evaluate(() => window.dispatchEvent(new Event('online')))
      await page.waitForSelector('.shell__offline', { hidden: true })
      const signedIn = await page.evaluate(async auth => {
        const { signInWithPassword } = await import('/src/services/supabase/auth.service.js')
        const { error } = await signInWithPassword(auth.email, auth.password)
        return error ? error.message : 'ok'
      }, runtime.auth)
      assert(signedIn === 'ok', 'OFFLINE_RECOVERY_AUTH_FAILED')
      await page.waitForFunction(() => {
        const queue = JSON.parse(localStorage.getItem('traker:sync-queue') || '[]')
        return queue.length === 0
      }, { timeout: 15_000 })

      const recoveredLog = await storedHabitLog(page)
      assert(recoveredLog?.status === 'done', 'RECOVERED_LOG_WAS_LOST')
    },
  },
  {
    id: '16-ai-unavailable-core-intact',
    title: 'IA no disponible; las funciones actuales siguen intactas',
    fixture: gymHabitFixture,
    async run(page) {
      await openHabitLog(page, 'Gimnasio')
      await chooseLogDecision(page, 'Sí')
      await saveHabitLog(page)
      const log = await storedHabitLog(page)
      assert(log?.status === 'done', 'CORE_FLOW_DEPENDS_ON_AI')
      const aiRequests = await page.evaluate(() => performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(url => /(api\.openai\.com|anthropic\.com|\/functions\/v1\/(?:ai|assistant|coach))/i.test(url)))
      assert(aiRequests.length === 0, 'UNEXPECTED_AI_NETWORK_DEPENDENCY')
    },
  },
  {
    id: '17-notification-permission-denied',
    title: 'Permiso de notificaciones rechazado',
    fixture: lowEnergyFixture,
    setupPage: page => mockNotificationPermission(page, 'denied'),
    async run(page) {
      await openNotificationDiagnostics(page)
      assert(await bodyIncludes(page, 'Bloqueado'), 'DENIED_PERMISSION_STATUS_MISSING')
      assert(await bodyIncludes(page, 'Desbloquéalo en los ajustes de notificaciones'), 'DENIED_PERMISSION_RECOVERY_MISSING')
      const testDisabled = await page.$eval('.nd-test-btn', button => button.disabled)
      assert(testDisabled, 'DENIED_PERMISSION_TEST_NOT_DISABLED')
      const prompts = await page.evaluate(() => window.__notificationRequestCount)
      assert(prompts === 0, 'DENIED_PERMISSION_WAS_REQUESTED_AGAIN')
    },
  },
  {
    id: '18-iphone-not-installed',
    title: 'PWA no instalada en iPhone; explicación honesta',
    fixture: lowEnergyFixture,
    async setupPage(page) {
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'standalone', { configurable: true, value: false })
      })
    },
    async run(page) {
      await openNotificationDiagnostics(page)
      assert(await bodyIncludes(page, 'Falta instalar'), 'IPHONE_INSTALL_STATUS_MISSING')
      assert(await bodyIncludes(page, 'En iPhone, primero añádela a tu pantalla de inicio'), 'IPHONE_INSTALL_GUIDANCE_MISSING')
      assert(await bodyIncludes(page, 'Compartir → Añadir a pantalla de inicio'), 'IPHONE_INSTALL_STEPS_MISSING')
      assert(await bodyIncludes(page, 'mientras está abierta'), 'IPHONE_IN_APP_FALLBACK_MISSING')
      assert(!await bodyIncludes(page, 'Android pausa'), 'IPHONE_WAS_GIVEN_ANDROID_GUIDANCE')
    },
  },
  {
    id: '19-multi-habit-reward',
    title: 'Recompensa vinculada a varios hábitos',
    fixture: multiHabitRewardFixture,
    async run(page) {
      await openPrimaryNav(page, 'Recompensas', '.rewards-page')
      await page.waitForFunction(() => document.body.innerText.includes('Una tarde libre'))
      assert(await bodyIncludes(page, '2 de 3 hoy · Caminar, Leer, Ordenar'), 'MULTI_REWARD_RULE_NOT_EXPLAINED')
      assert(await bodyIncludes(page, 'Ya te las ganaste'), 'MULTI_REWARD_VAULT_MISSING')
      await page.click('[aria-label="Usar Una tarde libre"]')
      const saved = await readLocalStorage(page, 'traker:rewards')
      assert(saved?.claims?.length === 1, 'MULTI_REWARD_CLAIM_MISSING')
      assert(Boolean(saved.claims[0].usedAt), 'MULTI_REWARD_CLAIM_NOT_REDEEMED')
    },
  },
  {
    id: '20-goal-completed-by-milestone',
    title: 'Meta completada mediante hito, no porcentaje',
    fixture: milestoneCompletionFixture,
    async run(page) {
      await openPrimaryNav(page, 'Rumbo', '.goals-page')
      await clickByText(page, '.goal-row', 'Publicar guía personal')
      await page.waitForSelector('.goal-detail')
      await clickByText(page, '.milestones__actions button', 'Completar')
      await setLabeledField(page, '¿Qué demuestra que este hito quedó listo?', 'URL publicada y revisada')
      await clickByText(page, '.milestones__evidence button', 'Guardar evidencia y completar')
      await page.waitForFunction(() => document.body.innerText.includes('Todos los hitos vigentes están completos'))

      let goals = await readIndexedDbStore(page, 'goals')
      assert(goals.find(goal => goal.id === 'e2e-goal-20')?.status === 'active', 'MILESTONE_AUTO_CLOSED_GOAL')
      await clickByText(page, 'button', 'La meta ya está terminada')
      assert(await bodyIncludes(page, '¿La definición ya se cumple?'), 'GOAL_COMPLETION_CONFIRMATION_MISSING')
      await clickByText(page, '.goal-detail__confirm button', 'Sí, completar meta')
      await page.waitForSelector('.goal-detail__completed')
      goals = await readIndexedDbStore(page, 'goals')
      assert(goals.find(goal => goal.id === 'e2e-goal-20')?.status === 'completed', 'GOAL_NOT_COMPLETED_AFTER_CONFIRMATION')
    },
  },
  {
    id: '21-goal-reformulation-trace',
    title: 'Meta reformulada con trazabilidad',
    fixture: reformulationFixture,
    async run(page) {
      await openPrimaryNav(page, 'Rumbo', '.goals-page')
      await clickByText(page, '.goal-row', 'Escribir un libro completo')
      await page.waitForSelector('.goal-detail')
      await clickByText(page, 'a', 'Reformular como una meta nueva')
      await page.waitForSelector('.goal-create__comparison')
      assert(await bodyIncludes(page, 'ANTES'), 'REFORMULATION_BEFORE_MISSING')
      assert(await bodyIncludes(page, 'DESPUÉS'), 'REFORMULATION_AFTER_MISSING')
      await setLabeledField(page, '¿Qué quieres lograr?', 'Publicar una guía breve')
      await setLabeledField(page, '¿Cómo sabrás que está terminada?', 'La guía breve está publicada')
      await setLabeledField(page, '¿Qué puedes hacer a continuación?', 'Escribir el índice de la guía')
      assert(await bodyIncludes(page, 'Publicar una guía breve'), 'REFORMULATION_LIVE_COMPARISON_MISSING')
      await clickByText(page, 'button', 'Confirmar reformulación')
      await page.waitForSelector('.goal-detail__lineage')

      const goals = await readIndexedDbStore(page, 'goals')
      const original = goals.find(goal => goal.id === 'e2e-goal-21')
      const successor = goals.find(goal => goal.reformulatedFromGoalId === original.id)
      assert(original?.status === 'reformulated', 'REFORMULATION_SOURCE_NOT_CLOSED')
      assert(original?.version === 2, 'REFORMULATION_SOURCE_VERSION_NOT_ADVANCED')
      assert(successor?.title === 'Publicar una guía breve', 'REFORMULATION_SUCCESSOR_MISSING')
      assert(await bodyIncludes(page, 'Escribir un libro completo'), 'REFORMULATION_LINEAGE_NOT_VISIBLE')
    },
  },
  {
    id: '22-conscious-goal-closure',
    title: 'Meta cerrada conscientemente',
    fixture: consciousClosureFixture,
    async run(page) {
      await openPrimaryNav(page, 'Rumbo', '.goals-page')
      await clickByText(page, '.goal-row', 'Preparar curso anterior')
      await page.waitForSelector('.goal-detail')
      await clickByText(page, 'button', 'Cerrar conscientemente')
      assert(await bodyIncludes(page, 'Hay un siguiente paso abierto'), 'OPEN_ACTION_CLOSURE_WARNING_MISSING')
      await setLabeledField(page, 'Motivo', 'Ya no representa la dirección que quiero cuidar')
      await setLabeledField(page, 'Meta sucesora', 'e2e-goal-23')
      await clickByText(page, '.goal-detail__close-confirm button', 'Confirmar cierre')
      await page.waitForFunction(() => document.body.innerText.includes('Cerrada conscientemente'))

      const goals = await readIndexedDbStore(page, 'goals')
      const closed = goals.find(goal => goal.id === 'e2e-goal-22')
      assert(closed?.status === 'abandoned', 'CONSCIOUS_CLOSURE_STATUS_MISMATCH')
      assert(closed?.currentActionId === null, 'CONSCIOUS_CLOSURE_LEFT_OPEN_ACTION_CURRENT')
      assert(closed?.closeReason === 'Ya no representa la dirección que quiero cuidar', 'CONSCIOUS_CLOSURE_REASON_MISSING')
      assert(closed?.successorGoalId === 'e2e-goal-23', 'CONSCIOUS_CLOSURE_SUCCESSOR_MISSING')
    },
  },
  {
    id: '23-no-mood-preference',
    title: 'Usuario que no registra ánimo',
    fixture: noMoodFixture,
    async run(page) {
      await clickByText(page, 'button', 'Hacer check-in')
      await clickByText(page, 'button', 'Omitir siempre')
      await page.waitForFunction(() => !document.body.innerText.includes('¿Cómo llegas hoy?'))
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('traker:settings') || '{}').dailyCheckinPrompt === 'never')
      const settings = await readLocalStorage(page, 'traker:settings')
      assert(settings?.dailyCheckinPrompt === 'never', 'NO_MOOD_PREFERENCE_NOT_PERSISTED')

      await openHabitLog(page, 'Actividad de hoy')
      await chooseLogDecision(page, 'No')
      await saveHabitLog(page)
      await clickByText(page, 'button', 'Ver resumen')
      await clickByText(page, 'button', 'Cerrar por hoy')
      const checkins = await readLocalStorage(page, 'traker:checkins')
      const closures = await readLocalStorage(page, 'traker:day-closures')
      assert((checkins?.checkins ?? []).length === 0, 'NO_MOOD_FLOW_CREATED_CHECKIN')
      assert(closures?.closures?.[0]?.status === 'quiet', 'NO_MOOD_FLOW_BLOCKED_DAY_CLOSURE')
    },
  },
  {
    id: '24-two-device-convergence',
    title: 'Dos dispositivos convergen o muestran conflicto explícito',
    fixture: baseFixture,
    async run(pageA, runtime) {
      const httpErrorsA = []
      pageA.on('response', response => {
        if (response.status() >= 400) httpErrorsA.push(`${response.status()}:${new URL(response.url()).pathname}`)
      })
      const contextB = await runtime.browser.createBrowserContext()
      const pageB = await contextB.newPage()
      const diagnosticsB = []
      pageB.on('console', message => {
        if (message.type() === 'error') diagnosticsB.push(`console:${message.text()}`)
      })
      pageB.on('pageerror', error => diagnosticsB.push(`pageerror:${error.message}`))
      pageB.on('requestfailed', request => diagnosticsB.push(`request:${request.url()}`))
      pageB.on('response', response => {
        if (response.status() >= 400) diagnosticsB.push(`response:${response.status()}:${new URL(response.url()).pathname}`)
      })

      try {
        await pageB.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
        await pageB.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
        await prepareFixture(pageB, runtime.baseUrl, baseFixture())
        await pageB.goto(runtime.baseUrl, { waitUntil: 'networkidle0' })
        await unlockApp(pageB)

        await signInTemporaryUser(pageA, runtime.auth)
        await pageA.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 })
        await signInTemporaryUser(pageB, runtime.auth)
        await pageB.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 })

        const createdAt = new Date().toISOString()
        const canonicalHabit = {
          id: '55555555-0000-4555-8555-555555555555',
          name: 'Lectura compartida',
          minimumVersion: 'Leer dos páginas',
          goalId: null,
          goalIds: [],
          icon: 'BookOpen',
          color: '#637F50',
          duration: 30,
          isActive: true,
          lifecycleStatus: 'active',
          version: 1,
          reminder: null,
          reminderDays: null,
          schedule: {
            id: '55555555-1000-4555-8555-555555555555',
            kind: 'daily',
            timezone: 'America/Mexico_City',
            daysOfWeek: null,
            intervalDays: null,
            periodMinimum: null,
            periodTarget: null,
            periodExtra: null,
            windowStart: null,
            windowEnd: null,
            effectiveFrom: createdAt.slice(0, 10),
            effectiveTo: null,
            isActive: true,
            version: 1,
          },
          createdAt,
          updatedAt: createdAt,
          flexDays: [],
          logs: {},
        }

        const initialPush = await pageA.evaluate(async habitValue => {
          const { push } = await import('/src/services/supabase/sync.service.js')
          return push('upsert-habit', { habit: habitValue })
        }, canonicalHabit)
        assert(initialPush?.status === 'synced', 'TWO_DEVICE_INITIAL_PUSH_FAILED')

        const receivedByB = await pageB.evaluate(async () => {
          const { pullAll } = await import('/src/services/supabase/sync.service.js')
          const { useHabitsStore } = await import('/src/stores/habits.js')
          const cloud = await pullAll()
          const store = useHabitsStore()
          store.mergeFromCloud(cloud?.habits ?? [])
          return store.habits.map(habitValue => ({ id: habitValue.id, name: habitValue.name, version: habitValue.version }))
        })
        assert(receivedByB.some(item => item.id === canonicalHabit.id && item.name === canonicalHabit.name && item.version === 1), 'TWO_DEVICE_INITIAL_CONVERGENCE_FAILED')

        const deviceAUpdate = { ...canonicalHabit, name: 'Lectura enfocada', version: 2, updatedAt: new Date().toISOString() }
        const acceptedA = await pageA.evaluate(async habitValue => {
          const { push } = await import('/src/services/supabase/sync.service.js')
          return push('upsert-habit', { habit: habitValue })
        }, deviceAUpdate)
        assert(acceptedA?.status === 'synced', 'TWO_DEVICE_PRIMARY_UPDATE_FAILED')

        const deviceBUpdate = { ...canonicalHabit, name: 'Lectura ligera', version: 2, updatedAt: new Date(Date.now() + 1_000).toISOString() }
        const rejectedB = await pageB.evaluate(async habitValue => {
          const { push } = await import('/src/services/supabase/sync.service.js')
          const { useHabitsStore } = await import('/src/stores/habits.js')
          const store = useHabitsStore()
          const index = store.habits.findIndex(item => item.id === habitValue.id)
          if (index >= 0) store.habits[index] = habitValue
          return push('upsert-habit', { habit: habitValue })
        }, deviceBUpdate)
        assert(rejectedB?.status === 'conflict', 'TWO_DEVICE_CONFLICT_NOT_EXPLICIT')
        assert(rejectedB?.conflict?.code === 'version_mismatch', 'TWO_DEVICE_CONFLICT_CODE_MISSING')

        await pageB.evaluate(async () => {
          const { default: router } = await import('/src/router/index.js')
          await router.push('/settings/sync-v2-pilot')
        })
        await pageB.waitForSelector('.sv', { timeout: 8_000 }).catch(() => {
          throw new Error('TWO_DEVICE_PILOT_ROUTE_NOT_OPENED')
        })
        await pageB.waitForFunction(() => document.body.innerText.includes('1 en conflicto'), { timeout: 8_000 }).catch(async () => {
          const state = await pageB.evaluate(async () => {
            const request = indexedDB.open('traker-v2', 1)
            const db = await new Promise((resolve, reject) => {
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })
            const getAll = db.transaction('outbox', 'readonly').objectStore('outbox').getAll()
            const records = await new Promise((resolve, reject) => {
              getAll.onsuccess = () => resolve(getAll.result)
              getAll.onerror = () => reject(getAll.error)
            })
            db.close()
            return records.map(record => `${record.state}:${record.conflict?.code ?? 'none'}`).join(',')
          })
          throw new Error(`TWO_DEVICE_CONFLICT_NOT_VISIBLE:${state}`)
        })
        assert(await bodyIncludes(pageB, 'Usar copia de Supabase'), 'TWO_DEVICE_CANONICAL_RESOLUTION_MISSING')
        await pageB.click('.sv-reconcile')
        await pageB.waitForFunction(() => document.body.innerText.includes('Convergencia lista'), { timeout: 8_000 }).catch(() => {
          throw new Error('TWO_DEVICE_CONVERGENCE_NOT_VISIBLE_AFTER_RESOLUTION')
        })
        await pageB.waitForFunction(expectedName => {
          const saved = JSON.parse(localStorage.getItem('traker:habits') || '{}')
          return saved.habits?.some(item => item.name === expectedName)
        }, { timeout: 8_000 }, deviceAUpdate.name).catch(() => {
          throw new Error('TWO_DEVICE_CANONICAL_VALUE_NOT_MERGED_LOCALLY')
        })

        const cloudAfterResolution = await pageB.evaluate(async habitId => {
          const { pullAll } = await import('/src/services/supabase/sync.service.js')
          const cloud = await pullAll()
          const habitValue = cloud?.habits?.find(item => item.id === habitId)
          return habitValue ? { name: habitValue.name, version: habitValue.version } : null
        }, canonicalHabit.id)
        assert(cloudAfterResolution?.name === deviceAUpdate.name, 'TWO_DEVICE_CANONICAL_VALUE_CHANGED')
        assert(cloudAfterResolution?.version === 2, 'TWO_DEVICE_CANONICAL_VERSION_MISMATCH')

        const viewportB = await pageB.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        assert(viewportB.scrollWidth <= viewportB.clientWidth, 'TWO_DEVICE_SECONDARY_HORIZONTAL_OVERFLOW')
        assert(diagnosticsB.length === 0, 'TWO_DEVICE_SECONDARY_DIAGNOSTIC_ERROR')
        assert(httpErrorsA.length === 0, `TWO_DEVICE_PRIMARY_HTTP_ERROR:${httpErrorsA.join(',')}`)
      } finally {
        await contextB.close()
      }
    },
  },
  {
    id: '25-offline-reload-deduplication',
    title: 'Recarga offline y reconexión sin duplicar la operación',
    fixture: offlineReloadFixture,
    async setupPage(page) {
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          get() {
            try {
              return localStorage.getItem('e2e:network-state') !== 'offline'
            } catch {
              return true
            }
          },
        })
      })
    },
    async run(page, runtime) {
      await signInTemporaryUser(page, runtime.auth)
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 8_000 })
      await page.evaluate(() => import('/src/services/syncV2PilotBridge.service.js').then(() => true))

      await page.evaluate(() => {
        localStorage.setItem('e2e:network-state', 'offline')
        window.dispatchEvent(new Event('offline'))
      })
      await page.waitForSelector('.shell__offline')
      await openHabitLog(page, 'Registro durable')
      await chooseLogDecision(page, 'Sí')
      await saveHabitLog(page)
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('traker:sync-queue') || '[]').length === 1)
      const outboxBefore = await readIndexedDbStore(page, 'outbox', 'traker-v2')
      const pendingBefore = outboxBefore.filter(record => record.entityType === 'habitLog' && record.state === 'pending')
      assert(pendingBefore.length === 1, 'OFFLINE_RELOAD_INITIAL_OUTBOX_MISMATCH')

      await page.reload({ waitUntil: 'networkidle0', timeout: 15_000 })
      await unlockApp(page)
      await page.waitForSelector('.shell__offline')
      const queueAfterReload = await readLocalStorage(page, 'traker:sync-queue')
      const outboxAfterReload = await readIndexedDbStore(page, 'outbox', 'traker-v2')
      const pendingAfterReload = outboxAfterReload.filter(record => record.entityType === 'habitLog' && record.state === 'pending')
      assert(queueAfterReload?.length === 1, 'OFFLINE_RELOAD_LEGACY_QUEUE_DUPLICATED')
      assert(pendingAfterReload.length === 1, 'OFFLINE_RELOAD_V2_OUTBOX_DUPLICATED')
      assert(pendingAfterReload[0].operationId === pendingBefore[0].operationId, 'OFFLINE_RELOAD_OPERATION_ID_CHANGED')

      await page.evaluate(() => {
        localStorage.removeItem('e2e:network-state')
        window.dispatchEvent(new Event('online'))
      })
      await page.waitForSelector('.shell__offline', { hidden: true })
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('traker:sync-queue') || '[]').length === 0, { timeout: 15_000 })
      await page.waitForFunction(async operationId => {
        const request = indexedDB.open('traker-v2', 1)
        const db = await new Promise((resolve, reject) => {
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        const result = db.transaction('outbox', 'readonly').objectStore('outbox').get(operationId)
        const record = await new Promise((resolve, reject) => {
          result.onsuccess = () => resolve(result.result)
          result.onerror = () => reject(result.error)
        })
        db.close()
        return record?.state === 'synced'
      }, { timeout: 15_000 }, pendingBefore[0].operationId)

      const cloudLogs = await page.evaluate(async habitId => {
        const { pullAll } = await import('/src/services/supabase/sync.service.js')
        const cloud = await pullAll()
        const habitValue = cloud?.habits?.find(item => item.id === habitId)
        return Object.values(habitValue?.logs ?? {}).map(log => ({ status: log.status, occurrenceKey: log.occurrenceKey }))
      }, '66666666-0000-4666-8666-666666666666')
      assert(cloudLogs.length === 1, 'OFFLINE_RECONNECT_CLOUD_LOG_DUPLICATED')
      assert(cloudLogs[0]?.status === 'done', 'OFFLINE_RECONNECT_CLOUD_LOG_MISSING')
    },
  },
  {
    id: '26-local-backup-roundtrip',
    title: 'Exportar, borrar local, importar y comparar datos',
    fixture: portabilityFixture,
    async run(page) {
      await openSettings(page)
      assert(await bodyIncludes(page, 'Bloquea la interfaz en este dispositivo; no cifra los datos guardados.'), 'PIN_ENCRYPTION_BOUNDARY_MISSING')
      assert(await bodyIncludes(page, 'Exportar respaldo local'), 'BACKUP_EXPORT_ACTION_MISSING')
      assert(await bodyIncludes(page, 'Restaurar respaldo local'), 'BACKUP_IMPORT_ACTION_MISSING')
      const backup = await page.evaluate(async () => {
        const { exportLocalDeviceData } = await import('/src/services/local/dataPortability.service.js')
        return exportLocalDeviceData({ exportedAt: '2026-09-01T06:00:00.000Z' })
      })
      const serialized = JSON.stringify(backup)
      assert(!serialized.includes('"pin"'), 'BACKUP_EXPOSED_PIN')
      assert(!serialized.includes('access_token'), 'BACKUP_EXPOSED_SESSION')

      await clickByText(page, '.sp-card--danger button', 'Borrar')
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15_000 }),
        clickByText(page, '.a-modal button', 'Borrar copia local'),
      ])
      await unlockApp(page, '.sp')
      const emptyHabits = await readLocalStorage(page, 'traker:habits')
      const emptyGoals = await readIndexedDbStore(page, 'goals')
      assert((emptyHabits?.habits ?? []).length === 0, 'BACKUP_DELETE_LEFT_HABITS')
      assert(emptyGoals.length === 0, 'BACKUP_DELETE_LEFT_GOALS')

      await page.evaluate(content => {
        const input = document.querySelector('input[type="file"][accept="application/json,.json"]')
        const transfer = new DataTransfer()
        transfer.items.add(new File([content], 'traker-respaldo-e2e.json', { type: 'application/json' }))
        Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }, serialized)
      await page.waitForFunction(() => document.body.innerText.includes('¿Restaurar respaldo local?'))
      assert(await bodyIncludes(page, 'traker-respaldo-e2e.json'), 'BACKUP_RESTORE_FILENAME_MISSING')
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15_000 }),
        clickByText(page, '.a-modal button', 'Restaurar copia'),
      ])
      await unlockApp(page, '.sp')
      assert(await bodyIncludes(page, 'Respaldo restaurado.'), 'BACKUP_RESTORE_CONFIRMATION_MISSING')

      const restored = await page.evaluate(async () => {
        const { exportLocalDeviceData } = await import('/src/services/local/dataPortability.service.js')
        return exportLocalDeviceData({ exportedAt: '2026-09-01T06:00:00.000Z' })
      })
      assert(JSON.stringify(restored.legacy.habits) === JSON.stringify(backup.legacy.habits), 'BACKUP_HABITS_ROUNDTRIP_MISMATCH')
      assert(JSON.stringify(restored.legacy.settings) === JSON.stringify(backup.legacy.settings), 'BACKUP_SETTINGS_ROUNDTRIP_MISMATCH')
      assert(JSON.stringify(restored.legacyGoals.goals) === JSON.stringify(backup.legacyGoals.goals), 'BACKUP_GOALS_ROUNDTRIP_MISMATCH')
      assert(JSON.stringify(restored.legacyGoals.goalActions) === JSON.stringify(backup.legacyGoals.goalActions), 'BACKUP_ACTIONS_ROUNDTRIP_MISMATCH')
    },
  },
  {
    id: '27-stale-client-contract-gate',
    title: 'Cliente antiguo conserva datos de un contrato más nuevo',
    skipUnlock: true,
    fixture: () => baseFixture({
      localStorage: {
        'traker:meta': {
          schemaVersion: 99,
          firstOpened: '2026-09-01T06:00:00.000Z',
          lastOpened: '2026-09-01T06:00:00.000Z',
        },
        'traker:habits': {
          habits: [{
            id: 'future-contract-habit',
            name: 'Dato de contrato futuro',
            futureField: { keep: true },
          }],
        },
      },
    }),
    async run(page) {
      await page.waitForSelector('.compatibility-gate')
      assert(await bodyIncludes(page, 'Actualización necesaria'), 'STALE_CLIENT_GATE_MISSING')
      assert(await bodyIncludes(page, 'se detuvo antes de modificarlos'), 'STALE_CLIENT_DATA_GUARANTEE_MISSING')
      assert(await bodyIncludes(page, 'Contrato guardado v99'), 'STALE_CLIENT_SCHEMA_VERSION_MISSING')
      assert(await bodyIncludes(page, 'Actualizar Traker'), 'STALE_CLIENT_REFRESH_ACTION_MISSING')

      const preserved = await page.evaluate(() => ({
        meta: JSON.parse(localStorage.getItem('traker:meta')),
        habits: JSON.parse(localStorage.getItem('traker:habits')),
        lockMounted: Boolean(document.querySelector('[aria-label="Pantalla de bloqueo de Traker"]')),
      }))
      assert(preserved.meta.schemaVersion === 99, 'STALE_CLIENT_SCHEMA_DOWNGRADED')
      assert(preserved.habits.habits[0].futureField.keep === true, 'STALE_CLIENT_DATA_REWRITTEN')
      assert(!preserved.lockMounted, 'STALE_CLIENT_APP_MOUNTED_BEHIND_GATE')
    },
  },
  {
    id: '28-accessibility-primary-surfaces',
    title: 'Rutas y diálogos principales cumplen WCAG automatizable',
    fixture: gymHabitFixture,
    async run(page) {
      await assertAccessible(page, { include: '.home', label: 'HOME' })

      await openHabitLog(page, 'Gimnasio')
      await assertAccessible(page, { include: '.a-overlay', label: 'LOG_DIALOG' })
      await chooseLogDecision(page, 'Sí')
      await saveHabitLog(page)

      await openSettings(page)
      await assertAccessible(page, { include: '.sp-shell', label: 'SETTINGS' })

      await openPrimaryNav(page, 'Historial', '.pg')
      await assertAccessible(page, { include: '.pg', label: 'PROGRESS' })

      await openPrimaryNav(page, 'Recompensas', '.rewards-page')
      await assertAccessible(page, { include: '.rewards-page', label: 'REWARDS' })
      await clickByText(page, 'button', 'Crear mi primera recompensa')
      await page.waitForSelector('.a-modal')
      await assertAccessible(page, { include: '.a-overlay', label: 'REWARD_DIALOG' })
    },
  },
  {
    id: '29-responsive-navigation-matrix',
    title: 'Matriz responsive sin overflow y navegación en el breakpoint correcto',
    fixture: crowdedHabitsFixture,
    async run(page, { artifactsDir }) {
      const matrix = [320, 375, 430, 768, 1024, 1280, 1440]
      const captureDir = join(artifactsDir, 'responsive')
      await mkdir(captureDir, { recursive: true })

      for (const width of matrix) {
        await page.setViewport({ width, height: width < 768 ? 812 : 900, deviceScaleFactor: 1 })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const layout = await page.evaluate(() => {
          const isVisible = selector => {
            const element = document.querySelector(selector)
            return Boolean(element && element.getClientRects().length)
          }
          return {
            clientWidth: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
            bottomNav: isVisible('.shell__bottom-wrap'),
            rail: isVisible('.shell__rail'),
          }
        })

        assert(layout.scrollWidth <= layout.clientWidth, `RESPONSIVE_OVERFLOW_${width}`)
        assert(layout.bottomNav === (width < 768), `RESPONSIVE_BOTTOM_NAV_${width}`)
        assert(layout.rail === (width >= 768), `RESPONSIVE_RAIL_${width}`)
        await page.screenshot({ path: join(captureDir, `dashboard-${width}.png`), fullPage: true })
      }
    },
  },
  {
    id: '30-keyboard-focus-contracts',
    title: 'Lock, ayuda, navegación y diálogos funcionan sólo con teclado',
    fixture: gymHabitFixture,
    skipUnlock: true,
    async run(page) {
      await page.waitForSelector('[aria-label="Pantalla de bloqueo de Traker"]')
      assert(await page.evaluate(() => document.activeElement?.textContent.trim() === '1'), 'KEYBOARD_LOCK_INITIAL_FOCUS')
      for (let digit = 1; digit <= 4; digit += 1) {
        await page.keyboard.press('Enter')
        if (digit < 4) await page.keyboard.press('Tab')
      }
      await page.waitForSelector('[aria-label="Pantalla de bloqueo de Traker"]', { hidden: true, timeout: 5_000 })
      await page.waitForSelector('.home')

      await focusVisibleControl(page, 'Ayuda')
      await page.keyboard.press('Enter')
      await page.waitForSelector('[role="region"][aria-label="Opciones de ayuda"]')
      await page.keyboard.press('Tab')
      assert(await page.evaluate(() => document.activeElement?.textContent.includes('¿Cómo agrego')), 'KEYBOARD_HELP_TAB_ORDER')
      await page.keyboard.press('Escape')
      assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Ayuda'), 'KEYBOARD_HELP_FOCUS_RETURN')

      await focusVisibleControl(page, 'Registrar Gimnasio')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.a-modal')
      assert(await page.evaluate(() => document.querySelector('.a-modal')?.contains(document.activeElement)), 'KEYBOARD_DIALOG_INITIAL_FOCUS')
      await page.keyboard.press('Enter')
      await page.focus('.a-modal footer button')
      await page.keyboard.press('Tab')
      assert(await page.evaluate(() => document.activeElement?.closest('.lm-decisions') !== null), 'KEYBOARD_DIALOG_FOCUS_TRAP')
      await page.keyboard.press('Escape')
      await page.waitForSelector('.a-modal', { hidden: true })
      assert(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Registrar Gimnasio'), 'KEYBOARD_DIALOG_FOCUS_RETURN')

      await focusVisibleControl(page, 'Recompensas')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.rewards-page')
      const openerFocused = await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(element => element.textContent.includes('Crear mi primera recompensa'))
        button?.focus()
        return document.activeElement === button
      })
      assert(openerFocused, 'KEYBOARD_REWARD_OPENER')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.reward-form')
      assert(await page.evaluate(() => document.querySelector('.reward-form')?.contains(document.activeElement)), 'KEYBOARD_REWARD_FORM_FOCUS')
      await page.keyboard.press('Escape')
      await page.waitForSelector('.reward-form', { hidden: true })
      assert(await page.evaluate(() => document.activeElement?.textContent.includes('Crear mi primera recompensa')), 'KEYBOARD_REWARD_FOCUS_RETURN')
    },
  },
  {
    id: '31-keyboard-goal-session-and-form',
    title: 'Meta, sesión y validación de formulario funcionan sólo con teclado',
    fixture: threeGoalsFixture,
    async run(page) {
      await focusVisibleControl(page, 'Rumbo')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.goals-page')

      await page.focus('.goal-row')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.goal-detail')
      await page.focus('.goal-next-step__primary')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.session-page__finish')

      await page.focus('.session-page__finish')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.session-finish')
      assert(await page.evaluate(() => document.activeElement?.id === 'finish-title'), 'KEYBOARD_SESSION_CHOICES_INITIAL_FOCUS')
      await page.keyboard.press('Tab')
      assert(await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'
        && document.activeElement?.labels?.[0]?.textContent.includes('Nota para retomar')), 'KEYBOARD_SESSION_NOTE_LABEL')
      await page.keyboard.type('Retomar desde el esquema')
      await page.keyboard.press('Escape')
      assert(await page.evaluate(() => document.activeElement?.classList.contains('session-page__finish')), 'KEYBOARD_SESSION_CHOICES_FOCUS_RETURN')

      await page.keyboard.press('Enter')
      await page.waitForSelector('.session-finish')
      const completionFocused = await page.evaluate(() => {
        const button = [...document.querySelectorAll('.session-finish__choices button')]
          .find(element => element.textContent.includes('Terminé esta acción'))
        button?.focus()
        return document.activeElement === button
      })
      assert(completionFocused, 'KEYBOARD_SESSION_COMPLETION_FOCUS')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.session-result')
      assert(await page.evaluate(() => document.activeElement?.matches('.session-result h1')), 'KEYBOARD_SESSION_RESULT_FOCUS')

      const returnFocused = await page.evaluate(() => {
        const button = document.querySelector('.session-result button')
        button?.focus()
        return document.activeElement === button
      })
      assert(returnFocused, 'KEYBOARD_SESSION_RETURN_ACTION')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.goal-detail__next-choice')
      const defineFocused = await page.evaluate(() => {
        const button = [...document.querySelectorAll('.goal-detail__next-choice button')]
          .find(element => element.textContent.includes('Definir siguiente paso'))
        button?.focus()
        return document.activeElement === button
      })
      assert(defineFocused, 'KEYBOARD_ACTION_FORM_OPENER')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.action-form')
      assert(await page.evaluate(() => document.activeElement?.matches('.action-form input')), 'KEYBOARD_ACTION_FORM_INITIAL_FOCUS')

      await page.focus('.action-form__submit')
      await page.keyboard.press('Enter')
      assert(await page.evaluate(() => {
        const input = document.querySelector('.action-form input')
        const description = input?.getAttribute('aria-describedby')
        return input?.getAttribute('aria-invalid') === 'true'
          && Boolean(description)
          && document.getElementById(description)?.getAttribute('role') === 'alert'
      }), 'KEYBOARD_ACTION_FORM_ERROR_CONTRACT')
    },
  },
  {
    id: '32-reflow-short-height-orientation',
    title: 'Reflow equivalente, orientación y ventanas de poca altura mantienen controles accesibles',
    fixture: gymHabitFixture,
    async run(page, { artifactsDir }) {
      const matrix = [
        { width: 320, height: 700, label: 'reflow-400-equivalent' },
        { width: 640, height: 700, label: 'reflow-200-equivalent' },
        { width: 375, height: 480, label: 'mobile-short' },
        { width: 667, height: 375, label: 'mobile-landscape' },
        { width: 812, height: 375, label: 'tablet-landscape-short' },
        { width: 768, height: 540, label: 'tablet-short' },
      ]
      const captureDir = join(artifactsDir, 'reflow')
      await mkdir(captureDir, { recursive: true })

      for (const viewport of matrix) {
        await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 })
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const layout = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bottomNavVisible: Boolean(document.querySelector('.shell__bottom-wrap')?.getClientRects().length),
          railVisible: Boolean(document.querySelector('.shell__rail')?.getClientRects().length),
        }))
        assert(layout.scrollWidth <= layout.clientWidth, `REFLOW_OVERFLOW_${viewport.label}`)
        assert(layout.bottomNavVisible === (viewport.width < 768), `REFLOW_BOTTOM_NAV_${viewport.label}`)
        assert(layout.railVisible === (viewport.width >= 768), `REFLOW_RAIL_${viewport.label}`)
        await page.screenshot({ path: join(captureDir, `${viewport.label}.png`) })
      }

      await page.setViewport({ width: 375, height: 420, deviceScaleFactor: 1 })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      await focusVisibleControl(page, 'Registrar Gimnasio')
      await page.keyboard.press('Enter')
      await page.waitForSelector('.lm-decisions')
      await chooseLogDecision(page, 'Sí')
      const saveVisible = await page.evaluate(() => {
        const button = [...document.querySelectorAll('.a-modal footer button')]
          .find(element => element.textContent.includes('Guardar registro'))
        if (!button) return false
        button.focus()
        button.scrollIntoView({ block: 'nearest' })
        const rect = button.getBoundingClientRect()
        return document.activeElement === button && rect.top >= 0 && rect.bottom <= window.innerHeight
      })
      assert(saveVisible, 'SHORT_VIEWPORT_DIALOG_ACTION_UNREACHABLE')
      await page.keyboard.press('Escape')
      await page.waitForSelector('.a-modal', { hidden: true })
      await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
    },
  },
  {
    id: '33-account-deletion',
    title: 'Borrado de cuenta exige confirmación y limpia nube, sesión y dispositivo',
    fixture: portabilityFixture,
    allowConsoleError: message => message.includes('400 (Bad Request)'),
    async run(page, { createBrowserAuth, artifactsDir }) {
      const disposableAuth = await createBrowserAuth()
      await signInTemporaryUser(page, disposableAuth)
      await openSettings(page)
      await page.waitForFunction(email => document.body.innerText.includes(email), {}, disposableAuth.email)
      await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
      await clickByText(page, 'button', 'Borrar cuenta')
      await page.waitForSelector('.delete-account')
      await assertAccessible(page, { include: '.a-overlay', label: 'ACCOUNT_DELETE_DIALOG' })

      const confirmation = await page.$('.delete-account input[autocomplete="off"]')
      await confirmation.type('BORRAR')
      await page.screenshot({ path: join(artifactsDir, 'account-deletion-confirmation.png') })
      await clickByText(page, 'button', 'Borrar para siempre')
      await page.waitForFunction(() => document.body.innerText.includes('quedaron eliminadas permanentemente'), { timeout: 15_000 })

      const footprint = await page.evaluate(async () => {
        const countStores = async (databaseName, storeNames) => {
          const databases = indexedDB.databases ? await indexedDB.databases() : []
          if (databases.length && !databases.some(database => database.name === databaseName)) return 0
          return new Promise((resolve, reject) => {
            const request = indexedDB.open(databaseName)
            request.onerror = () => reject(request.error)
            request.onsuccess = async () => {
              const db = request.result
              try {
                let total = 0
                for (const storeName of storeNames) {
                  if (!db.objectStoreNames.contains(storeName)) continue
                  total += await new Promise((countResolve, countReject) => {
                    const count = db.transaction(storeName, 'readonly').objectStore(storeName).count()
                    count.onsuccess = () => countResolve(count.result)
                    count.onerror = () => countReject(count.error)
                  })
                }
                resolve(total)
              } catch (error) {
                reject(error)
              } finally {
                db.close()
              }
            }
          })
        }
        return {
          session: localStorage.getItem('traker:supabase-session'),
          pin: localStorage.getItem('traker:pin'),
          serializedLocalData: Object.entries(localStorage)
            .filter(([key]) => key.startsWith('traker:'))
            .map(([, value]) => value)
            .join(' '),
          sessionKeys: Object.keys(sessionStorage).filter(key => key.startsWith('traker:')),
          goalsRows: await countStores('traker-goals', ['goals', 'actions', 'events', 'progressEntries']),
          v2Rows: await countStores('traker-v2', ['habits', 'habitLogs', 'habitSchedules', 'outbox', 'syncMetadata']),
        }
      })
      assert(footprint.session === null, 'ACCOUNT_DELETE_SUPABASE_SESSION_REMAINS')
      assert(!footprint.pin || JSON.parse(footprint.pin)?.pin === null, 'ACCOUNT_DELETE_PIN_REMAINS')
      assert(!footprint.serializedLocalData.includes('Dato portátil'), 'ACCOUNT_DELETE_HABIT_REMAINS')
      assert(!footprint.serializedLocalData.includes('Respaldo local'), 'ACCOUNT_DELETE_PROFILE_REMAINS')
      assert(footprint.sessionKeys.length === 0, 'ACCOUNT_DELETE_SESSION_STORAGE_REMAINS')
      assert(footprint.goalsRows === 0, 'ACCOUNT_DELETE_GOALS_DB_ROWS_REMAIN')
      assert(footprint.v2Rows === 0, 'ACCOUNT_DELETE_V2_DB_ROWS_REMAIN')
      assert(await bodyIncludes(page, 'Crea un PIN seguro'), 'ACCOUNT_DELETE_OLD_PIN_REMAINS')
      assert(await bodyIncludes(page, 'Sin cuenta'), 'ACCOUNT_DELETE_AUTH_STATE_REMAINS')
    },
  },
  {
    id: '34-analytics-revocation',
    title: 'Revocar analítica detiene eventos nuevos y conserva el registro diario',
    fixture: offlineReloadFixture,
    async run(page, { auth }) {
      const httpErrors = []
      page.on('response', response => {
        if (response.status() < 400) return
        httpErrors.push(`${response.request().method()}:${new URL(response.url()).pathname}:${response.status()}`)
      })
      await signInTemporaryUser(page, auth)

      const analytics = await page.evaluate(async () => {
        const { useSettingsStore } = await import('/src/stores/settings.js')
        const { saveGoalsConsent, revokeGoalsConsent } = await import('/src/services/supabase/goals.service.js')
        const { emitProductEvent } = await import('/src/services/supabase/productAnalytics.service.js')
        const { supabase } = await import('/src/services/supabase/client.js')
        const settings = useSettingsStore()

        settings.grantGoalsAnalyticsConsent('goals-analytics-v1')
        const grantedAt = settings.goalsAnalyticsConsentGrantedAt
        const granted = await saveGoalsConsent({
          purpose: 'goals_analytics',
          consentVersion: settings.goalsAnalyticsConsentVersion,
          grantedAt,
        })
        if (granted.error) return { error: granted.error.message }

        const before = await emitProductEvent(
          { eventType: 'activation', durationMs: 4_000 },
          { consented: settings.goalsAnalyticsConsented },
        )
        settings.revokeGoalsAnalyticsConsent()
        const revoked = await revokeGoalsConsent({
          purpose: 'goals_analytics',
          consentVersion: 'goals-analytics-v1',
          grantedAt,
        })
        if (revoked.error) return { error: revoked.error.message }

        const after = await emitProductEvent(
          { eventType: 'habit_log', durationMs: 8_000 },
          { consented: settings.goalsAnalyticsConsented },
        )
        const { data: events, error } = await supabase
          .from('traker_product_events')
          .select('id')
        const { data: consent } = await supabase
          .from('traker_product_consents')
          .select('revoked_at')
          .eq('purpose', 'goals_analytics')
          .single()
        return {
          error: error?.message ?? null,
          before: before.status,
          after: after.status,
          count: events?.length ?? 0,
          revokedAt: consent?.revoked_at ?? null,
          localConsent: settings.goalsAnalyticsConsented,
        }
      })

      assert(!analytics.error, `ANALYTICS_REVOCATION_ERROR:${analytics.error}`)
      assert(analytics.before === 'emitted', 'ANALYTICS_EVENT_NOT_EMITTED_WITH_CONSENT')
      assert(analytics.after === 'skipped', 'ANALYTICS_EVENT_EMITTED_AFTER_REVOCATION')
      assert(analytics.count === 1, 'ANALYTICS_COUNT_CHANGED_AFTER_REVOCATION')
      assert(Boolean(analytics.revokedAt), 'ANALYTICS_REMOTE_REVOCATION_MISSING')
      assert(analytics.localConsent === false, 'ANALYTICS_LOCAL_REVOCATION_MISSING')

      const functionalLog = await page.evaluate(async () => {
        const { useHabitsStore } = await import('/src/stores/habits.js')
        const habits = useHabitsStore()
        const habit = habits.addHabit({
          name: 'Validación funcional',
          minimumVersion: 'Un paso',
          icon: 'Activity',
          color: '#6c8cff',
          duration: 7,
          reminder: null,
          schedule: { kind: 'weekdays', daysOfWeek: [1, 2, 3, 4, 5, 6, 0] },
        })
        habits.logDay(habit.id, 1, { status: 'done', minimumUsed: false })
        await new Promise(resolve => setTimeout(resolve, 0))
        const logged = habits.habits.find(item => item.id === habit.id)?.logs?.[1]
        return logged ? { status: logged.status, level: logged.level } : null
      })
      assert(functionalLog?.status === 'done', 'FUNCTIONALITY_FAILED_AFTER_ANALYTICS_REVOCATION')
      assert(httpErrors.length === 0, `ANALYTICS_HTTP_ERROR:${httpErrors.join(',')}`)
    },
  },
  {
    id: '35-closed-app-notification-actions',
    title: 'Acciones de notificación sobreviven cierre, recarga y posposición',
    fixture: gymHabitFixture,
    async run(page) {
      await mockNotificationPermission(page, 'granted')

      const queueAction = async (action, now = Date.now()) => page.evaluate(async ({ action: nextAction, now: queuedAt }) => {
        const { enqueueNotificationAction } = await import('/src/features/notifications/actionQueue.js')
        const persisted = JSON.parse(localStorage.getItem('traker:habits'))
        const habit = persisted?.habits?.[0]
        await enqueueNotificationAction({ action: nextAction, habitId: habit.id, url: `/habit/${habit.id}` }, { now: queuedAt })
        return habit.id
      }, { action, now })

      await queueAction('done')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await unlockApp(page)
      await page.waitForFunction(() => {
        const persisted = JSON.parse(localStorage.getItem('traker:habits'))
        return Object.values(persisted?.habits?.[0]?.logs ?? {}).some(log => log.status === 'done')
      })

      await queueAction('skip')
      await page.reload({ waitUntil: 'domcontentloaded' })
      await unlockApp(page)
      await page.waitForFunction(() => {
        const persisted = JSON.parse(localStorage.getItem('traker:habits'))
        return Object.values(persisted?.habits?.[0]?.logs ?? {}).some(log => log.status === 'not_done')
      })

      await queueAction('snooze', Date.now() - 16 * 60 * 1000)
      await page.reload({ waitUntil: 'domcontentloaded' })
      await unlockApp(page)
      await page.waitForFunction(() => {
        const log = JSON.parse(localStorage.getItem('traker:notif-log') ?? '[]')
        return log.some(item => item.body === 'Tienes un recordatorio pendiente.')
      })

      const footprint = await page.evaluate(async () => {
        const request = indexedDB.open('traker-notification-actions', 1)
        return new Promise((resolve, reject) => {
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const db = request.result
            const count = db.transaction('actions', 'readonly').objectStore('actions').count()
            count.onerror = () => reject(count.error)
            count.onsuccess = () => {
              const value = count.result
              db.close()
              resolve(value)
            }
          }
        })
      })
      assert(footprint === 0, 'NOTIFICATION_ACTION_QUEUE_NOT_DRAINED')
    },
  },
  {
    id: '36-theme-motion-responsive-matrix',
    title: 'Claro, oscuro y movimiento reducido conservan marca y reflow en móvil, tablet y escritorio',
    fixture: gymHabitFixture,
    async run(page, { artifactsDir, baseUrl }) {
      const captureDir = join(artifactsDir, 'theme-matrix')
      await mkdir(captureDir, { recursive: true })
      const matrix = [
        { width: 375, height: 812, label: 'mobile' },
        { width: 768, height: 900, label: 'tablet' },
        { width: 1280, height: 800, label: 'desktop' },
      ]
      const themeTokens = new Map()

      for (const theme of ['light', 'dark']) {
        for (const viewport of matrix) {
          await page.setViewport({ ...viewport, deviceScaleFactor: 1 })
          const state = await page.evaluate(async selectedTheme => {
            const { useAppStore } = await import('/src/stores/app.js')
            useAppStore().setTheme(selectedTheme)
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
            const styles = getComputedStyle(document.documentElement)
            return {
              theme: document.documentElement.dataset.theme,
              background: styles.getPropertyValue('--background-base').trim(),
              foreground: styles.getPropertyValue('--text-primary').trim(),
              clientWidth: document.documentElement.clientWidth,
              scrollWidth: document.documentElement.scrollWidth,
              bottomNavVisible: Boolean(document.querySelector('.shell__bottom-wrap')?.getClientRects().length),
              railVisible: Boolean(document.querySelector('.shell__rail')?.getClientRects().length),
              perpetualAnimations: [...document.querySelectorAll('*')]
                .map(element => getComputedStyle(element))
                .filter(style => style.animationName !== 'none' && style.animationIterationCount === 'infinite')
                .map(style => style.animationName),
            }
          }, theme)

          assert(state.theme === theme, `THEME_NOT_APPLIED_${theme}_${viewport.label}`)
          assert(Boolean(state.background && state.foreground), `THEME_TOKENS_EMPTY_${theme}_${viewport.label}`)
          assert(state.scrollWidth <= state.clientWidth, `THEME_OVERFLOW_${theme}_${viewport.label}`)
          assert(state.bottomNavVisible === (viewport.width < 768), `THEME_BOTTOM_NAV_${theme}_${viewport.label}`)
          assert(state.railVisible === (viewport.width >= 768), `THEME_RAIL_${theme}_${viewport.label}`)
          assert(state.perpetualAnimations.length === 0, `REDUCED_MOTION_LOOP_${state.perpetualAnimations.join(',')}`)
          themeTokens.set(theme, `${state.background}|${state.foreground}`)
          await page.screenshot({ path: join(captureDir, `${theme}-${viewport.label}.png`), fullPage: true })
        }
      }

      assert(themeTokens.get('light') !== themeTokens.get('dark'), 'LIGHT_DARK_TOKENS_IDENTICAL')
      const logoResponse = await page.evaluate(async url => {
        const response = await fetch(new URL('/brand/koto-logo.svg', url))
        return { ok: response.ok, type: response.headers.get('content-type'), body: await response.text() }
      }, baseUrl)
      assert(logoResponse.ok, 'CANONICAL_LOGO_UNAVAILABLE')
      assert(logoResponse.type?.includes('image/svg+xml'), 'CANONICAL_LOGO_WRONG_TYPE')
      assert(logoResponse.body.includes('Símbolo de Traker'), 'CANONICAL_LOGO_ACCESSIBLE_TITLE_MISSING')
    },
  },
]
