/**
 * Общие типы игры. Используются и host-app (Expo), и guest-web (PWA),
 * и shared-логикой. Для MVP — npm workspace-пакет `@muzlo/shared`.
 */

export interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  /** Суммарные очки за партию. */
  score: number;
  /** Цвет/эмодзи-аватар для голосования. */
  avatar: string;
}

/** Трек, привязанный к отправителю (работаем только со ссылкой, без API). */
export interface SubmittedTrack {
  /** Уникальный id записи. */
  id: string;
  /** ID трека в Яндекс Музыке, вытащенный из ссылки. */
  trackId: string;
  /** ID альбома (если был в ссылке; нужен для iframe-эмбеда). */
  albumId?: string;
  /** Оригинальная ссылка, которую скинул игрок. */
  url: string;
  /** Название (если игрок вставил текст шаринга вместе со ссылкой). */
  title?: string;
  /** Исполнитель (если был в тексте шаринга). */
  artist?: string;
  /** Кто отправил (playerId). */
  submittedBy: string;
}

export type RoomPhase =
  | 'lobby'      // сбор игроков и ссылок
  | 'playing'    // идёт раунд (проигрывание с начала)
  | 'voting'     // открыто голосование
  | 'reveal'     // показ итога раунда
  | 'finished';  // финальная таблица

export interface RoundState {
  index: number;
  track: SubmittedTrack;
  /** Авторы (все, кто отправил этот же трек — дубликаты ссылок). */
  authorIds: string[];
  /** Голоса: playerId -> votedPlayerId. */
  votes: Record<string, string>;
  /** Итог (заполняется на фазе reveal). */
  reveal?: {
    comment: string;
    scores: Record<string, number>;
  };
}

export interface Room {
  code: string;
  hostId: string;
  phase: RoomPhase;
  players: Player[];
  tracks: SubmittedTrack[];
  rounds: RoundState[];
  currentRound: number;
  /** Длительность партии в минутах (1 мин ≈ 1 трек). */
  durationMinutes: number;
  createdAt: number;
}
