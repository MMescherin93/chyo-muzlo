/** Нормализованный снимок комнаты — общий для хоста и гостей (уходит по MQTT). */

import type { Room } from '@muzlo/shared';

export interface RoomView {
  code: string;
  phase: string;
  hostId: string;
  durationMinutes: number;
  players: { id: string; nickname: string; isHost: boolean; score: number; avatar: string }[];
  tracks: {
    trackId: string;
    albumId?: string;
    url: string;
    title?: string;
    artist?: string;
    submittedBy: string;
  }[];
  currentTrack?: {
    trackId: string;
    albumId?: string;
    url: string;
    title?: string;
    artist?: string;
  };
  reveal?: { comment: string; scores: Record<string, number> };
  roundIndex: number;
  votesCount: number;
}

/** Превращает внутреннее состояние движка в снимок для UI/сети. */
export function toRoomView(room: Room): RoomView {
  const round = room.rounds[room.currentRound];
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    durationMinutes: room.durationMinutes,
    players: room.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      isHost: p.isHost,
      score: p.score,
      avatar: p.avatar,
    })),
    tracks: room.tracks.map((t) => ({
      trackId: t.trackId,
      albumId: t.albumId,
      url: t.url,
      title: t.title,
      artist: t.artist,
      submittedBy: t.submittedBy,
    })),
    currentTrack: round?.track
      ? {
          trackId: round.track.trackId,
          albumId: round.track.albumId,
          url: round.track.url,
          title: round.track.title,
          artist: round.track.artist,
        }
      : undefined,
    reveal: round?.reveal,
    roundIndex: room.currentRound,
    votesCount: round ? Object.keys(round.votes).length : 0,
  };
}
