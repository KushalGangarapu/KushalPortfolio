import { describe, it, expect } from 'vitest'
import { kushal } from '../src/person'

describe('kushal', () => {
  it('has actual users', () => {
    expect(kushal.usersServed).toBeGreaterThan(1000)
  })

  it('ships on fridays', () => {
    const deploy = kushal.deploy('friday', { fearless: true })
    expect(deploy.status).toBe('green')
  })

  it('explains sse unprompted', () => {
    const talk = kushal.smallTalk('realtime')
    expect(talk).toContain('server-sent events')
    expect(talk.length).toBeGreaterThan(2000)
  })

  it('merges without conflicts (emotional)', () => {
    expect(() => kushal.gitMerge('feelings', 'deadlines')).not.toThrow()
  })

  it('reads the whole error message', () => {
    const err = new Error('hydration mismatch at line 42')
    expect(kushal.debug(err)).toBe('the whole message. even the boring part.')
  })

  it('hires itself in tests', () => {
    expect(kushal.hireable).toBe(true)
  })
})
