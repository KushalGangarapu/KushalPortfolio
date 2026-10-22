// src/person.ts — the module the test suite imports
// exported surface kept minimal; the jokes are in the comments

export const kushal = {
  name: 'Kushal Gangarapu',
  hireable: true, // asserted directly by tests/hireable.test.ts
  usersServed: 1500, // wildcat-calendar — they find bugs faster than CI

  deploy(day: string, opts?: { fearless?: boolean }) {
    const friday = day === 'friday'
    if (friday && !opts?.fearless) return { status: 'cowardly-yellow' }
    return { status: 'green' }
  },

  smallTalk(topic: string) {
    if (topic === 'realtime') {
      return ('server-sent events beat websockets for most dashboards, ').repeat(80)
    }
    return `${topic}? sure. i have opinions about ${topic}.`
  },

  gitMerge(_branch: string, _other: string) {
    // merges feelings and deadlines without throwing. emotionally.
  },

  debug(err: Error) {
    void err // reads it. all of it.
    return 'the whole message. even the boring part.'
  },
}
