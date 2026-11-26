/**
 * Parses common YouTube URL formats into a safe privacy-enhanced embed URL.
 * Never autoplays with unexpected audio (autoplay=0, controls=1).
 */
export function extractYouTubeId(rawUrl: string): string | null {
  const input = rawUrl.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = url.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) return vParam;

      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live')) {
        const id = parts[1];
        return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function toYouTubeEmbedUrl(rawUrl: string): string | null {
  const id = extractYouTubeId(rawUrl);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&autoplay=0&controls=1`;
}

export function getYouTubeThumbnailUrl(rawUrl: string): string | null {
  const id = extractYouTubeId(rawUrl);
  if (!id) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
