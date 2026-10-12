import { describe, expect, it } from 'vitest'
import { EXPERIMENTS } from '../experiments'
import { TOPICS, topicOf } from '../topics'

describe('topics', () => {
  it('offer every experiment exactly once', () => {
    const offered = TOPICS.flatMap((topic) => topic.experiments)
    expect([...offered].sort()).toEqual(EXPERIMENTS.map((entry) => entry.id).sort())
    expect(new Set(offered).size).toBe(offered.length)
  })

  it('find the group an experiment belongs to', () => {
    expect(topicOf('michelson').id).toBe('waves')
    expect(topicOf('brewster').id).toBe('surfaces')
    for (const topic of TOPICS) for (const id of topic.experiments) expect(topicOf(id)).toBe(topic)
  })
})
