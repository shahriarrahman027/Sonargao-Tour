import React, { useEffect, useState } from 'react';
import { resolveBackgroundMedia, shouldMountBackgroundMedia } from '../lib/media';

export interface BackgroundVideoProps {
  /** Video URL: YouTube link or direct video stream (.mp4, .webm, etc.). */
  src?: string | null;
  /** Accessible title for embedded video frames. */
  title: string;
  /** Network connectivity state for remote video sources. */
  isOnline?: boolean;
  /** Deferred mounting toggle (e.g. viewport proximity in Explore). */
  shouldMount?: boolean;
  /** Iframe loading strategy. */
  loading?: 'eager' | 'lazy';
  /** Timeout (ms) before falling back if an iframe stalls before firing onLoad. */
  loadTimeoutMs?: number;
  /** Optional ref attached to the inner media wrapper (e.g. scroll parallax). */
  layerRef?: React.Ref<HTMLDivElement>;
  /** Extra utility classes on the inner media wrapper. */
  mediaLayerClassName?: string;
  /** Clean solid/gradient background used before load or when video fails (never an image). */
  fallbackClassName?: string;
  /** Optional subtle readability gradient rendered above the video without blur. */
  overlayClassName?: string;
}

/**
 * Shared crisp full-bleed background video component used across Home and Explore.
 * Renders the video directly at full opacity without poster images, thumbnail layers,
 * or blur filters, falling back cleanly to a pure CSS surface if playback fails.
 */
export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({
  src,
  title,
  isOnline = true,
  shouldMount = true,
  loading = 'eager',
  loadTimeoutMs = 15000,
  layerRef,
  mediaLayerClassName = 'inset-0',
  fallbackClassName = 'bg-gradient-to-br from-[#07140D] via-[#0E2D1E] to-[#133827]',
  overlayClassName,
}) => {
  const [hasFailed, setHasFailed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const resolved = resolveBackgroundMedia(src);

  useEffect(() => {
    setHasFailed(false);
    setIframeLoaded(false);
  }, [resolved.src]);

  const canMount = shouldMountBackgroundMedia(resolved, {
    isOnline,
    shouldMount,
    hasFailed,
  });

  useEffect(() => {
    if (!canMount || resolved.kind !== 'youtube') {
      setIframeLoaded(false);
      return;
    }
    if (iframeLoaded) return;
    const timeoutId = window.setTimeout(() => {
      setHasFailed(true);
    }, loadTimeoutMs);
    return () => window.clearTimeout(timeoutId);
  }, [canMount, resolved.kind, iframeLoaded, loadTimeoutMs]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${fallbackClassName}`}
    >
      <div
        ref={layerRef}
        style={{ containerType: 'size' }}
        className={`pointer-events-none absolute overflow-hidden ${mediaLayerClassName}`}
      >
        {canMount && resolved.kind === 'youtube' && (
          <iframe
            key={resolved.src}
            src={resolved.src}
            title={title}
            loading={loading}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            tabIndex={-1}
            onLoad={() => setIframeLoaded(true)}
            onError={() => setHasFailed(true)}
            style={{
              minWidth: '100%',
              minHeight: '100%',
              width: 'max(100cqw, calc(100cqh * 16 / 9))',
              height: 'max(100cqh, calc(100cqw * 9 / 16))',
            }}
            className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0 opacity-100"
          />
        )}

        {canMount && resolved.kind === 'video' && (
          <video
            key={resolved.src}
            ref={(el) => {
              if (el) {
                el.muted = true;
                el.defaultMuted = true;
              }
            }}
            src={resolved.src}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            onCanPlay={(e) => {
              void e.currentTarget.play().catch(() => {
                // Keep muted stream mounted cleanly if device battery mode defers autoplay.
              });
            }}
            onError={() => setHasFailed(true)}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-100"
          />
        )}
      </div>

      {overlayClassName && (
        <div className={`pointer-events-none absolute inset-0 ${overlayClassName}`} />
      )}
    </div>
  );
};
