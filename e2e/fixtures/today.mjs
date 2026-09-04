const NOW = new Date().toISOString()
const LOCAL_DATE = (() => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
})()

function localDateDaysAgo(days) {
  const value = new Date(Date.now() - (days * 24 * 60 * 60 * 1000))
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

function localTimeHHMM() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date()).map(part => [part.type, part.value]))
  return `${parts.hour}:${parts.minute}`
}

function dailySchedule(id) {
  return {
    id: `schedule-${id}`,
    kind: 'daily',
    timezone: 'America/Mexico_City',
    daysOfWeek: null,
    intervalDays: null,
    periodMinimum: null,
    periodTarget: null,
    periodExtra: null,
    windowStart: null,
    windowEnd: null,
    effectiveFrom: LOCAL_DATE,
    effectiveTo: null,
    isActive: true,
    version: 1,
  }
}

export function habit(index, patch = {}) {
  const id = patch.id ?? `e2e-habit-${index}`
  return {
    id,
    name: patch.name ?? `Actividad ${index}`,
    minimumVersion: patch.minimumVersion ?? 'Dos minutos',
    goalId: patch.goalIds?.[0] ?? null,
    goalIds: patch.goalIds ?? [],
    icon: patch.icon ?? 'Activity',
    color: patch.color ?? '#637F50',
    duration: patch.duration ?? 30,
    isActive: true,
    lifecycleStatus: 'active',
    version: 1,
    reminder: null,
    reminderDays: null,
    schedule: patch.schedule ?? dailySchedule(id),
    createdAt: NOW,
    updatedAt: NOW,
    flexDays: [],
    copySettings: null,
    logs: patch.logs ?? {},
    ...patch,
  }
}

function goal(index, horizon) {
  const id = `e2e-goal-${index}`
  const actionId = `e2e-action-${index}`
  return {
    goal: {
      id,
      userId: null,
      title: `Dirección ${index}`,
      personalWhy: index === 1 ? 'Recordar la razón elegida para avanzar.' : '',
      desiredOutcome: '',
      doneDefinition: `Dirección ${index} terminada`,
      horizon,
      status: 'active',
      focusRank: index - 1,
      currentActionId: actionId,
      reformulatedFromGoalId: null,
      createdAt: NOW,
      updatedAt: NOW,
      closedAt: null,
      archivedAt: null,
      deletedAt: null,
      version: 1,
    },
    action: {
      id: actionId,
      goalId: id,
      milestoneId: null,
      stageId: null,
      title: `Paso disponible ${index}`,
      minimumVersion: 'Abrir y empezar',
      energyLevel: 'medium',
      estimateBucket: '15m',
      status: 'ready',
      positionKey: 'a0',
      blockedReason: null,
      adaptedFromActionId: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      version: 1,
    },
  }
}

export function baseFixture(overrides = {}) {
  return {
    localStorage: {
      'traker:pin': { pin: '1234' },
      'traker:meta': {
        schemaVersion: 3,
        firstOpened: NOW,
        lastOpened: NOW,
      },
      'traker:app': { theme: 'light' },
      'traker:settings': {
        displayName: '',
        notificationsEnabled: false,
        tone: 'normal',
        goalsFocusLimit: 3,
      },
      'traker:habits': { habits: [] },
      'traker:flexible-groups': { groups: [] },
      'traker:checkins': { checkins: [] },
      'traker:day-closures': { closures: [] },
      'traker:rewards': { rewards: [], claims: [] },
      ...overrides.localStorage,
    },
    goals: overrides.goals ?? [],
    actions: overrides.actions ?? [],
    milestones: overrides.milestones ?? [],
    progressEntries: overrides.progressEntries ?? [],
    goalEvents: overrides.goalEvents ?? [],
  }
}

export function multiHabitRewardFixture() {
  const habits = [
    habit(1, { name: 'Caminar', logs: { 1: { level: 3, status: 'done', localDate: LOCAL_DATE } } }),
    habit(2, { name: 'Leer', logs: { 1: { level: 1, status: 'partial', minimumUsed: true, localDate: LOCAL_DATE } } }),
    habit(3, { name: 'Ordenar', logs: {} }),
  ]
  return baseFixture({
    localStorage: {
      'traker:habits': { habits },
      'traker:rewards': {
        rewards: [{
          id: 'e2e-reward-combo',
          name: 'Una tarde libre',
          note: 'Sin caducidad',
          enabled: true,
          trigger: 'habits_combo',
          sourceIds: habits.map(item => item.id),
          targetCount: 2,
          createdAt: NOW,
          updatedAt: NOW,
        }],
        claims: [],
      },
    },
  })
}

export function milestoneCompletionFixture() {
  const aggregate = goal(20, 'medium')
  aggregate.goal.title = 'Publicar guía personal'
  aggregate.goal.doneDefinition = 'La guía está publicada y accesible'
  aggregate.goal.currentActionId = null
  return baseFixture({
    goals: [aggregate.goal],
    milestones: [{
      id: 'e2e-milestone-20',
      goalId: aggregate.goal.id,
      title: 'Publicar versión final',
      doneDefinition: 'Existe una URL accesible',
      status: 'pending',
      position: 0,
      targetDate: null,
      completedAt: null,
      evidenceSummary: '',
      version: 1,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    }],
  })
}

export function reformulationFixture() {
  const aggregate = goal(21, 'medium')
  aggregate.goal.title = 'Escribir un libro completo'
  aggregate.goal.doneDefinition = 'El manuscrito completo está terminado'
  aggregate.action.title = 'Escribir el capítulo uno'
  return baseFixture({ goals: [aggregate.goal], actions: [aggregate.action] })
}

export function consciousClosureFixture() {
  const source = goal(22, 'short')
  const successor = goal(23, 'medium')
  source.goal.title = 'Preparar curso anterior'
  source.goal.doneDefinition = 'Curso anterior publicado'
  source.action.title = 'Completar el temario anterior'
  successor.goal.title = 'Crear taller breve'
  successor.goal.focusRank = null
  return baseFixture({
    goals: [source.goal, successor.goal],
    actions: [source.action, successor.action],
  })
}

export function noMoodFixture() {
  return quietDayFixture()
}

export function threeGoalsFixture() {
  const aggregates = [goal(1, 'short'), goal(2, 'medium'), goal(3, 'long')]
  return baseFixture({
    goals: aggregates.map(item => item.goal),
    actions: aggregates.map(item => item.action),
  })
}

export function crowdedHabitsFixture() {
  return baseFixture({
    localStorage: {
      'traker:habits': {
        habits: Array.from({ length: 8 }, (_, index) => habit(index + 1)),
      },
    },
  })
}

export function sharedHabitFixture() {
  return baseFixture({
    localStorage: {
      'traker:habits': {
        habits: [habit(1, {
          name: 'Actividad compartida',
          goalId: 'e2e-goal-1',
          goalIds: ['e2e-goal-1', 'e2e-goal-2'],
        })],
      },
    },
  })
}

export function flexibleActivitiesFixture() {
  const habits = [
    habit(1, { name: 'Caminar' }),
    habit(2, { name: 'Bicicleta' }),
    habit(3, { name: 'Movilidad' }),
  ]
  return baseFixture({
    localStorage: {
      'traker:habits': { habits },
      'traker:flexible-groups': {
        groups: [{
          id: 'e2e-flex-1',
          name: 'Movimiento flexible',
          period: 'week',
          minimumCount: 2,
          targetCount: 3,
          extraCount: 3,
          timezone: 'America/Mexico_City',
          status: 'active',
          memberIds: habits.map(item => item.id),
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
          deletedAt: null,
        }],
      },
    },
  })
}

export function gymHabitFixture() {
  return baseFixture({
    localStorage: {
      'traker:habits': {
        habits: [habit(1, {
          name: 'Gimnasio',
          minimumVersion: 'Cambiarme y hacer diez minutos',
          icon: 'Dumbbell',
          copySettings: { category: 'gym', carrillaEnabled: true },
        })],
      },
    },
  })
}

export function offlineReloadFixture() {
  const id = '66666666-0000-4666-8666-666666666666'
  return baseFixture({
    localStorage: {
      'traker:habits': {
        habits: [habit(25, {
          id,
          name: 'Registro durable',
          minimumVersion: 'Hacer la versión mínima',
          schedule: {
            ...dailySchedule(id),
            id: '66666666-1000-4666-8666-666666666666',
          },
        })],
      },
    },
  })
}

export function portabilityFixture() {
  const direction = goal(26, 'quarter')
  return baseFixture({
    localStorage: {
      'traker:settings': {
        displayName: 'Respaldo local',
        notificationsEnabled: false,
        tone: 'trusted',
        goalsFocusLimit: 3,
        includeEmotionsInExport: true,
      },
      'traker:habits': {
        habits: [habit(26, {
          name: 'Dato portátil',
          minimumVersion: 'Conservar un registro verificable',
          logs: {
            1: {
              id: '77777777-2000-4777-8777-777777777777',
              localDate: LOCAL_DATE,
              timezone: 'America/Mexico_City',
              occurrenceKey: `date:${LOCAL_DATE}`,
              status: 'done',
              level: 3,
              minimumUsed: false,
              contextCodes: [],
              note: '',
              loggedAt: NOW,
              version: 1,
            },
          },
        })],
      },
    },
    goals: [direction.goal],
    actions: [direction.action],
  })
}

export function familyHabitFixture() {
  return baseFixture({
    localStorage: {
      'traker:settings': {
        displayName: '',
        notificationsEnabled: false,
        tone: 'no_respect',
        goalsFocusLimit: 3,
      },
      'traker:habits': {
        habits: [habit(1, {
          name: 'Llamar a mi familia',
          minimumVersion: 'Enviar un mensaje breve',
          icon: 'Heart',
          copySettings: { category: 'family', carrillaEnabled: true },
        })],
      },
    },
  })
}

export function lowEnergyFixture() {
  return baseFixture()
}

export function allMinimumsFixture() {
  return baseFixture({
    localStorage: {
      'traker:habits': {
        habits: [
          habit(1, { name: 'Mínimo uno', minimumVersion: 'Dos minutos' }),
          habit(2, { name: 'Mínimo dos', minimumVersion: 'Abrir y empezar' }),
        ],
      },
    },
  })
}

export function quietDayFixture() {
  return baseFixture({
    localStorage: {
      'traker:habits': {
        habits: [habit(1, { name: 'Actividad de hoy' })],
      },
    },
  })
}

export function returningAfterTwoWeeksFixture() {
  const createdDate = localDateDaysAgo(16)
  const createdAt = `${createdDate}T12:00:00.000Z`
  const returningHabit = habit(1, {
    name: 'Hábito conservado',
    createdAt,
    updatedAt: createdAt,
    schedule: {
      ...dailySchedule('e2e-habit-1'),
      effectiveFrom: createdDate,
    },
    logs: {
      1: {
        status: 'done',
        minimumUsed: false,
        contextCodes: [],
        level: 3,
        emotion: null,
        energy: null,
        note: '',
        localDate: createdDate,
        timezone: 'America/Mexico_City',
        occurrenceKey: `date:${createdDate}`,
        loggedAt: createdAt,
        version: 1,
      },
    },
  })
  return baseFixture({
    localStorage: {
      'traker:habits': { habits: [returningHabit] },
    },
  })
}

function notificationSettings() {
  return {
    displayName: '',
    notificationsEnabled: true,
    morningReminderEnabled: false,
    habitRemindersEnabled: true,
    closingReminderEnabled: false,
    returnReminderEnabled: false,
    notificationQuietStart: '00:00',
    notificationQuietEnd: '00:00',
    notificationDailyBudget: 2,
    notificationSilencedUntil: null,
    lockScreenPrivacy: 'generic',
    tone: 'normal',
    goalsFocusLimit: 3,
  }
}

export function dueNotificationFixture({ completed = false } = {}) {
  const log = completed ? {
    1: {
      status: 'done',
      minimumUsed: false,
      contextCodes: [],
      level: 3,
      emotion: null,
      energy: null,
      note: '',
      localDate: LOCAL_DATE,
      timezone: 'America/Mexico_City',
      occurrenceKey: `date:${LOCAL_DATE}`,
      loggedAt: NOW,
      version: 1,
    },
  } : {}
  return baseFixture({
    localStorage: {
      'traker:settings': notificationSettings(),
      'traker:habits': {
        habits: [habit(1, {
          name: completed ? 'Mínimo ya registrado' : 'Mínimo vigente',
          reminder: localTimeHHMM(),
          logs: log,
        })],
      },
    },
  })
}
