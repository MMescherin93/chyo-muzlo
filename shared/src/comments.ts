/**
 * Генератор мемных/ироничных комментариев по итогам раунда.
 * Шаблоны используют плейсхолдеры {ключ}; fill() подставляет значения.
 */

export interface CommentContext {
  /** Название трека. */
  trackTitle: string;
  /** Исполнитель. */
  artist: string;
  /** Авторы трека (1+). */
  authorNames: string[];
  /** Имена игроков (не авторов), правильно угадавших автора. */
  nonAuthorCorrectNames: string[];
  /** Имена ВСЕХ игроков, чей голос попал в автора. */
  correctGuesserNames: string[];
  /** Общее число игроков в комнате. */
  totalPlayers: number;
  /** Сколько игроков проголосовали за (одного из) авторов. */
  votesForAuthor: number;
}

/** Один случайный элемент массива. */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Подстановка {key}. Неизвестные ключи оставляем как есть. */
function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** «Оля», «Оля и Макс», «Оля, Макс и Ден». */
function joinNames(names: string[]): string {
  if (names.length === 0) return 'никто';
  if (names.length === 1) return names[0];
  return names.slice(0, -1).join(', ') + ' и ' + names[names.length - 1];
}

export function generateComment(ctx: CommentContext): string {
  const author = joinNames(ctx.authorNames);
  const guessers = joinNames(ctx.correctGuesserNames);
  const detectives = joinNames(ctx.nonAuthorCorrectNames);

  const base = {
    track: ctx.trackTitle,
    artist: ctx.artist,
    author,
    guessers,
    detectives,
  };

  // 1) Пул разыгран: хотя бы один не-автор угадал.
  if (ctx.nonAuthorCorrectNames.length > 0) {
    return fill(
      pick([
        '«{track}» ({artist}) — это {author}. {guessers} угадали! Пул очков разыгран.',
        '{guessers} раскусили {author} с треком «{track}» ({artist}). Музыкальный вкус не спрячешь!',
        'Трек «{track}» ({artist}) от {author} вычислен. {detectives} — детективы вечеринки!',
        '{author}, твоя маскировка под «{track}» ({artist}) провалилась: {guessers} угадали.',
        'Автор «{track}» ({artist}) — {author}. {guessers} знали это. Респект!',
      ]),
      base,
    );
  }

  // 2) Несколько авторов, угадали только они сами.
  if (ctx.authorNames.length > 1) {
    return fill(
      pick([
        '«{track}» ({artist}) скинули {author}, и угадали только они сами. Коллективный заговор — 0 очков!',
        '{author} спелись на «{track}» ({artist}) и проголосовали друг за друга. Пул аннулирован.',
        'Трек-близнец «{track}» ({artist}) от {author}. Комнату не провести — но и очков ноль.',
      ]),
      base,
    );
  }

  // 3) Угадал только сам автор.
  if (ctx.correctGuesserNames.length > 0) {
    return fill(
      pick([
        '«{track}» ({artist}) — {author}. Верно угадал только сам автор: пул сгорел, 0 очков.',
        'Единственный, кто знал, что «{track}» ({artist}) скинул {author}, — это сам {author}. Заговор раскрыт.',
        '{author} притащил «{track}» ({artist}) и сам себя выдал. Но так нечестно — пул сгорел.',
      ]),
      base,
    );
  }

  // 4) Никто не угадал.
  return fill(
    pick([
      '«{track}» ({artist}) — это {author}. Никто не угадал — музыкальная разведка провалена!',
      'Трек «{track}» ({artist}) от {author} остался неразгаданным. Все мимо.',
      '{author} слишком хорошо спрятал «{track}» ({artist}). 0 очков, но респект за конспирацию.',
    ]),
    base,
  );
}
