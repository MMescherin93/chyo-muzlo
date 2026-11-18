/**
 * Работа со ссылками Яндекс Музыки — БЕЗ неофициального API.
 *
 * Принцип (по договорённости):
 *  - Хост логинится в Яндекс Музыку под своим аккаунтом внутри WebView приложения.
 *  - Приложение только разбирает ссылки и строит URL официального iframe-плеера
 *    / страницы трека. Никаких запросов к внутренним эндпоинтам.
 *  - Отрывок играет С НАЧАЛА трека; длительность (15–30 сек) задаёт таймер хоста.
 *
 * Ограничения (честно):
 *  - Случайную точку трека через официальный плеер задать нельзя (`#t=start,end`
 *    не поддерживается у iframe ЯМузыки).
 *  - Плейлисты разложить на треки без API нельзя → в MVP принимаем только ссылки
 *    на отдельные треки.
 *  - Название/исполнитель для комментария берём из текста шаринга (если игрок
 *    вставил его вместе со ссылкой) либо показываем через сам iframe (визуально).
 */

/** Результат разбора ссылки. */
export interface ParsedLink {
  type: 'track';
  trackId: string;
  /** ID альбома, если был в ссылке (нужен для iframe-эмбеда). */
  albumId?: string;
}

/** Что достали из вставленного игроком текста шаринга. */
export interface ShareInput {
  /** Ссылка на трек. */
  url: string;
  /** Название, если было в тексте шаринга (необязательно). */
  title?: string;
  /** Исполнитель, если был в тексте (необязательно). */
  artist?: string;
}

/**
 * Разбирает ссылку на трек Яндекс Музыки.
 * Поддерживаемые форматы:
 *   https://music.yandex.ru/album/{albumId}/track/{trackId}
 *   https://music.yandex.ru/track/{trackId}
 *   https://music.yandex.ru/album/{albumId}            (альбом — не для MVP)
 */
export function parseYandexUrl(url: string): ParsedLink | null {
  // Полный формат с альбомом.
  const withAlbum = url.match(/\/album\/(\d+)\/track\/(\d+)/);
  if (withAlbum) {
    return { type: 'track', trackId: withAlbum[2], albumId: withAlbum[1] };
  }

  // Короткий формат без альбома.
  const shortTrack = url.match(/\/track\/(\d+)/);
  if (shortTrack) {
    return { type: 'track', trackId: shortTrack[1] };
  }

  return null;
}

/**
 * Парсит текст, который игрок вставил в поле «ссылка». Яндекс при шаринге трека
 * обычно копирует строку вида:
 *   «Название — Исполнитель\nhttps://music.yandex.ru/...»
 * Здесь мы вытаскиваем и URL, и (если повезло) название/исполнителя.
 */
export function parseShareInput(input: string): ShareInput | null {
  const text = input.trim();
  if (!text) return null;

  // Ищем URL внутри текста.
  const urlMatch = text.match(/https?:\/\/music\.yandex\.ru\/[^\s]+/);
  if (!urlMatch) return null;

  const url = urlMatch[0];
  const parsed = parseYandexUrl(url);
  if (!parsed) return null;

  // Всё, что до ссылки — потенциально «Название — Исполнитель».
  const head = text.slice(0, urlMatch.index).trim();
  const sep = head.indexOf(' — ');
  const title = sep >= 0 ? head.slice(0, sep).trim() : head || undefined;
  const artist = sep >= 0 ? head.slice(sep + 3).trim() : undefined;

  return { url, title: title || undefined, artist: artist || undefined };
}

/**
 * URL официального iframe-плеера для отображения трека (обложка + название +
 * исполнитель). Подходит для экрана раскрытия на ВСЕХ устройствах.
 *
 * NOTE: точный формат iframe сверьте с текущим виджетом ЯМузыки:
 *   https://music.yandex.ru/iframe/#track/{trackId}/{albumId}
 * Если albumId нет (короткая ссылка), надёжнее встроить страницу трека.
 */
export function buildIframeUrl(link: ParsedLink): string {
  if (link.albumId) {
    return `https://music.yandex.ru/iframe/#track/${link.trackId}/${link.albumId}`;
  }
  // Без albumId iframe-эмбед может не открыться — отдаём страницу трека.
  return buildTrackPageUrl(link.trackId);
}

/** Прямая страница трека (используется для воспроизведения в WebView хоста). */
export function buildTrackPageUrl(trackId: string): string {
  return `https://music.yandex.ru/track/${trackId}`;
}

/** HTML iframe для встраивания (экран раскрытия). */
export function buildEmbedHtml(link: ParsedLink): string {
  const src = buildIframeUrl(link);
  return `<iframe src="${src}" frameborder="0" allow="autoplay; encrypted-media"></iframe>`;
}

/**
 * Длительность отрывка (15–30 сек) для таймера хоста.
 * Сам отрывок играет с начала трека; здесь только выбираем, сколько секунд слушать.
 */
export function pickExcerptLengthSeconds(): number {
  return 15 + Math.floor(Math.random() * 16); // 15..30
}

/** Проверка, является ли текст ссылкой на трек ЯМузыки (для UI-валидации). */
export function isYandexTrackLink(input: string): boolean {
  return parseShareInput(input) !== null;
}
