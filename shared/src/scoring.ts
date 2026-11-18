/**
 * calculateScores — правила начисления очков за один раунд.
 *
 * Условия (из ТЗ §5):
 *   А) хотя бы один НЕ-автор угадал автора → пул делится поровну между ВСЕМИ
 *      (Math.floor(pool / players.length));
 *   Б) угадал только автор (одиночный) → 0 всем;
 *   В) несколько авторов, угадали только они сами → 0 всем;
 *   (вывод) никто не угадал → 0 всем.
 *
 * Б и В — частный случай одного правила: «если правильно угадали только сами
 * авторы (или никто), пул не разыгрывается».
 */

export interface VoteResult {
  /** Игроки, отправившие данный трек (может быть несколько — дубликаты ссылок). */
  authors: string[];
  /** playerId -> votedPlayerId (или null, если не успел/воздержался). */
  votes: Record<string, string | null>;
  /** Все игроки комнаты (для расчёта доли). */
  players: string[];
}

export interface ScoreDelta {
  /** playerId -> прибавка очков за раунд (0, если пул не разыгран). */
  [playerId: string]: number;
}

export interface ScoringBreakdown {
  /** Игроки, чей голос попал в автора. */
  correctGuessers: string[];
  /** Правильно угадавшие, НЕ являющиеся авторами. */
  nonAuthorCorrect: string[];
  /** Пул разыгран (условие А сработало). */
  poolAwarded: boolean;
  /** Очки, которые получит каждый (0, если пул не разыгран). */
  sharePerPlayer: number;
  /** Дробный остаток пула, «сгоревший» при округлении вниз. */
  remainder: number;
}

/**
 * Полный расчёт раунда: возвращает и дельты очков, и разбивку (для комментариев
 * и отладки).
 */
export function calculateRound(
  args: VoteResult,
  basePool = 100,
): { scores: ScoreDelta; breakdown: ScoringBreakdown } {
  const { authors, votes, players } = args;

  // Голос считается «правильным», если игрок проголосовал за любого из авторов.
  const correctGuessers = players.filter(
    (p) => votes[p] != null && authors.includes(votes[p] as string),
  );

  // Условие А: среди угадавших есть хотя бы один не-автор.
  const nonAuthorCorrect = correctGuessers.filter((p) => !authors.includes(p));

  if (nonAuthorCorrect.length === 0) {
    // Условия Б / В / никто не угадал → пул не разыгрывается.
    const scores: ScoreDelta = {};
    for (const p of players) scores[p] = 0;

    return {
      scores,
      breakdown: {
        correctGuessers,
        nonAuthorCorrect: [],
        poolAwarded: false,
        sharePerPlayer: 0,
        remainder: basePool,
      },
    };
  }

  // Условие А: делим поровну между всеми, дробная часть отбрасывается.
  const sharePerPlayer = Math.floor(basePool / players.length);
  const remainder = basePool - sharePerPlayer * players.length;

  const scores: ScoreDelta = {};
  for (const p of players) scores[p] = sharePerPlayer;

  return {
    scores,
    breakdown: {
      correctGuessers,
      nonAuthorCorrect,
      poolAwarded: true,
      sharePerPlayer,
      remainder,
    },
  };
}

/**
 * Упрощённая сигнатура «как в ТЗ» — возвращает только дельту очков.
 */
export function calculateScores(args: VoteResult, basePool = 100): ScoreDelta {
  return calculateRound(args, basePool).scores;
}
