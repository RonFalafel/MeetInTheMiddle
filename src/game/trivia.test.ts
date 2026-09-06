import { describe, expect, it } from 'vitest'
import { CODES, getCountry } from './graph.ts'
import {
  ROUND_LENGTH,
  TRIVIA_KINDS,
  applyMove,
  checkMove,
  claimedBy,
  currentQuestion,
  deal,
  dealTrivia,
  isOver,
  namableCodes,
  previousAnswer,
  repeatOf,
  replay,
  reveal,
  setupOf,
  triviaGame,
  triviaScore,
} from './rules.ts'
import type { TriviaGame, TriviaKind, TriviaQuestion } from './rules.ts'

const answer = (game: TriviaGame, codes: readonly string[]): TriviaGame =>
  codes.reduce((state, code, index) => applyMove(state, code, (index % 2) as 0 | 1), game)

/** Every question one kind can produce, over enough deals to see them all. */
const sample = (kind: TriviaKind, deals = 60): TriviaQuestion[] =>
  Array.from({ length: deals }, () => dealTrivia([kind])).flatMap((game) => game.questions)

describe('dealing trivia', () => {
  it('deals a full round of four-option questions', () => {
    const game = dealTrivia()
    expect(game.questions).toHaveLength(ROUND_LENGTH)
    for (const question of game.questions) {
      expect(question.options).toHaveLength(4)
      expect(question.options).toContain(question.answer)
      expect(new Set(question.options).size).toBe(4)
      expect(TRIVIA_KINDS).toContain(question.kind)
      expect(CODES).toContain(question.subject)
    }
  })

  it('never asks the same thing twice in a round', () => {
    for (let i = 0; i < 20; i++) {
      const keys = dealTrivia().questions.map((q) => `${q.kind}:${q.subject}`)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  it('can fill a round from any single kind on its own', () => {
    for (const kind of TRIVIA_KINDS) {
      const game = dealTrivia([kind])
      expect(game.questions.length, kind).toBe(ROUND_LENGTH)
      for (const question of game.questions) expect(question.kind).toBe(kind)
    }
  })

  it('does not always put the answer in the same place', () => {
    const positions = new Set(
      dealTrivia(TRIVIA_KINDS, undefined, 200).questions.map((q) =>
        q.options.indexOf(q.answer),
      ),
    )
    expect(positions.size).toBeGreaterThan(1)
  })
})

/**
 * The distractors are the part that can quietly be wrong, and a wrong one is
 * invisible in play: it just marks a correct answer incorrect. Every kind is
 * checked against the graph rather than eyeballed.
 */
describe('the wrong options really are wrong', () => {
  it('borders: the answer is a neighbour and nothing else is', () => {
    for (const q of sample('borders')) {
      const neighbours = getCountry(q.subject).neighbours
      expect(neighbours, q.subject).toContain(q.answer)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(neighbours, `${q.subject} / ${option}`).not.toContain(option)
      }
    }
  })

  it('not-borders: the answer is the only one that is not a neighbour', () => {
    for (const q of sample('not-borders')) {
      const neighbours = getCountry(q.subject).neighbours
      expect(neighbours, q.subject).not.toContain(q.answer)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(neighbours, `${q.subject} / ${option}`).toContain(option)
      }
    }
  })

  it('capital-of: only the real capital is offered', () => {
    for (const q of sample('capital-of')) {
      expect(q.answer).toBe(getCountry(q.subject).capital)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(option, q.subject).not.toBe(getCountry(q.subject).capital)
      }
    }
  })

  it('whose-capital: only the country whose capital it is', () => {
    for (const q of sample('whose-capital')) {
      const capital = getCountry(q.subject).capital
      expect(q.answer).toBe(q.subject)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(getCountry(option).capital, option).not.toBe(capital)
      }
    }
  })

  it('currency: no distractor is a currency the country actually uses', () => {
    for (const q of sample('currency')) {
      const mine = getCountry(q.subject).currencies
      expect(mine, q.subject).toContain(q.answer)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(mine, `${q.subject} / ${option}`).not.toContain(option)
      }
    }
  })

  it('language: no distractor is a language the country actually speaks', () => {
    // Switzerland is the reason this test exists: it has four official
    // languages, so a generator that only knew the first would happily offer
    // German as a wrong answer about Switzerland.
    expect(getCountry('CHE').languages.length).toBeGreaterThan(1)

    for (const q of sample('language')) {
      const mine = getCountry(q.subject).languages
      expect(mine, q.subject).toContain(q.answer)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(mine, `${q.subject} / ${option}`).not.toContain(option)
      }
    }
  })

  it('landlocked: the answer is the only one without a coast', () => {
    for (const q of sample('landlocked')) {
      expect(getCountry(q.answer).landlocked, q.answer).toBe(true)
      for (const option of q.options) {
        if (option === q.answer) continue
        expect(getCountry(option).landlocked, option).toBe(false)
      }
    }
  })
})

describe('playing', () => {
  const question: TriviaQuestion = {
    kind: 'capital-of',
    subject: 'FRA',
    options: ['Paris', 'Berlin', 'Madrid', 'Rome'],
    answer: 'Paris',
  }
  const second: TriviaQuestion = {
    kind: 'borders',
    subject: 'PRT',
    options: ['ESP', 'FRA', 'ITA', 'DEU'],
    answer: 'ESP',
  }

  it('accepts only what the current question offered', () => {
    const game = triviaGame([question])
    expect(checkMove(game, 'Paris')).toEqual({ ok: true, code: 'Paris' })
    expect(checkMove(game, 'Berlin')).toEqual({ ok: true, code: 'Berlin' })
    expect(checkMove(game, 'Lisbon')).toMatchObject({ ok: false, reason: 'not-an-option' })
    // A real country code is still not an option here, which is the point of
    // checking against the question rather than against the country list.
    expect(checkMove(game, 'FRA')).toMatchObject({ ok: false, reason: 'not-an-option' })
  })

  it('moves on whether you are right or wrong', () => {
    const game = applyMove(triviaGame([question, second]), 'Berlin', 0)
    expect(currentQuestion(game)).toEqual(second)
    expect(triviaScore(game)).toMatchObject({ right: 0, asked: 1 })
  })

  it('says what the last answer should have been', () => {
    const wrong = applyMove(triviaGame([question, second]), 'Berlin', 0)
    expect(previousAnswer(wrong)).toEqual({ answer: 'Paris', right: false })

    const right = applyMove(triviaGame([question, second]), 'Paris', 0)
    expect(previousAnswer(right)).toEqual({ answer: 'Paris', right: true })
  })

  it('scores and finishes', () => {
    const game = answer(triviaGame([question, second]), ['Paris', 'FRA'])
    expect(game.status).toBe('won')
    expect(isOver(game)).toBe(true)
    expect(triviaScore(game)).toMatchObject({ right: 1, total: 2 })
    expect(triviaScore(game).wrong[0]).toMatchObject({
      question: 'PRT',
      given: 'FRA',
      answer: 'ESP',
    })
    expect(checkMove(game, 'ESP')).toMatchObject({ ok: false, reason: 'game-over' })
  })

  it('paints nothing on the map — the question is the whole screen', () => {
    expect(claimedBy(triviaGame([question])).size).toBe(0)
  })

  it('offers the autocomplete nothing, because it is answered by tapping', () => {
    expect(namableCodes(triviaGame([question])).size).toBe(0)
  })

  it('can be given up on', () => {
    const game = reveal(triviaGame([question, second]))
    expect(game.status).toBe('revealed')
    expect(checkMove(game, 'Paris')).toMatchObject({ ok: false, reason: 'game-over' })
  })
})

describe('over the wire', () => {
  it('carries the questions, so both phones ask the same ones', () => {
    const game = dealTrivia()
    expect(setupOf(game)).toEqual({ mode: 'trivia', questions: game.questions })
  })

  it('survives a round trip through JSON', () => {
    const game = dealTrivia()
    const played = applyMove(game, game.questions[0]!.options[0]!, 0)
    const wire = JSON.parse(JSON.stringify({ setup: setupOf(played), moves: played.moves }))
    expect(replay(wire.setup, wire.moves)).toEqual(played)
  })

  it('goes through the same request path as every other mode', () => {
    expect(deal({ mode: 'trivia' }).mode).toBe('trivia')
    expect(repeatOf(dealTrivia())).toEqual({ mode: 'trivia' })
  })

  it('deals a different round next time', () => {
    const first = dealTrivia().questions.map((q) => `${q.kind}:${q.subject}`)
    const again = dealTrivia().questions.map((q) => `${q.kind}:${q.subject}`)
    expect(again).not.toEqual(first)
  })
})
