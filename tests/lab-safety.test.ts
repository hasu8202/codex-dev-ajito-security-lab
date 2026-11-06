import { describe, expect, it } from 'vitest'

import { assertLabRuntime, LAB_DATABASE_URL } from '../src/lib/lab-safety'

describe('assertLabRuntime', () => {
  it('accepts only the dedicated local database on loopback', () => {
    expect(() =>
      assertLabRuntime({
        hostname: '127.0.0.1',
        databaseUrl: LAB_DATABASE_URL,
      }),
    ).not.toThrow()
  })

  it('rejects a non-loopback host before the lab can be exposed', () => {
    expect(() =>
      assertLabRuntime({
        hostname: '0.0.0.0',
        databaseUrl: LAB_DATABASE_URL,
      }),
    ).toThrow('localhost')
  })

  it('rejects any database other than the dedicated lab database', () => {
    expect(() =>
      assertLabRuntime({
        hostname: '127.0.0.1',
        databaseUrl: 'file:./data/ajito.db',
      }),
    ).toThrow('専用データベース')
  })
})
