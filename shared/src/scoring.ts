/**
 * calculateScores — правила начисления очков за один раунд.
 *
 * Формула:
 *   N — количество игроков в партии;
 *   Q — количество игроков, угадавших автора трека.
 *
 *   1) Если угадали только авторы трека (даже если авторов несколько)
 *      или не угадал никто — очки не начисляются никому.
 *   2) Иначе каждый угадавший получает Math.floor(N / Q) очков.
 *      Неугадавшие получают 0.
 */

export interface VoteResult {
  /** Игроки, отправившие данный трек (может быть несколько — дубликаты ссылок). */
  authors: string[];
  /** playerId -> votedPlayerId (или null, если не успел/воздержался). */
  votes: Record<string, string | null>;
  /** Все игроки комнаты. */
  players: string[];
}

export interface ScoreDelta {
  /** playerId -> прибавка очков за раунд. */
  [playerId: string]: number;
}

export interface ScoringBreakdown {
  /** Игроки, чей голос попал в автора (Q). */
  correctGuessers: string[];
  /** Правильно угадавшие, НЕ являющиеся авторами. */
  nonAuthorCorrect: string[];
  /** Очки разыграны (сработало условие 2). */
  poolAwarded: boolean;
  /** Сколько получил каждый угадавший. */
  pointsPerGuesser: number;
  /** Остаток от деления N / Q (сгорает при округлении вниз). */
  remainder: number;
  /** N — игроков в партии, Q — угадавших. */
  playersCount: number;
  guessersCount: number;
}

export function calculateRound(args: VoteResult): {
  scores: ScoreDelta;
  breakdown: ScoringBreakdown;
} {
  const { authors, votes, players } = args;

  const correctGuessers = players.filter(
    (p) => votes[p] != null && authors.includes(votes[p] as string),
  );
  const nonAuthorCorrect = correctGuessers.filter((p) => !authors.includes(p));

  const scores: ScoreDelta = {};
  for (const p of players) scores[p] = 0;

  // Угадали только авторы (или вообще никто) → очков нет.
  if (nonAuthorCorrect.length === 0) {
    return {
      scores,
      breakdown: {
        correctGuessers,
        nonAuthorCorrect: [],
        poolAwarded: false,
        pointsPerGuesser: 0,
        remainder: players.length,
        playersCount: players.length,
        guessersCount: correctGuessers.length,
      },
    };
  }

  // Каждый угадавший получает floor(N / Q).
  const pointsPerGuesser = Math.floor(players.length / correctGuessers.length);
  const remainder = players.length - pointsPerGuesser * correctGuessers.length;
  for (const p of correctGuessers) scores[p] = pointsPerGuesser;

  return {
    scores,
    breakdown: {
      correctGuessers,
      nonAuthorCorrect,
      poolAwarded: true,
      pointsPerGuesser,
      remainder,
      playersCount: players.length,
      guessersCount: correctGuessers.length,
    },
  };
}

/** Упрощённая сигнатура — возвращает только дельту очков. */
export function calculateScores(args: VoteResult): ScoreDelta {
  return calculateRound(args).scores;
}
