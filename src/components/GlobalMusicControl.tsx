import React from 'react';
import { Music, Pause, Play } from 'lucide-react';
import { MUSIC_TRACKS } from '../config/music';
import { useTour } from '../context/TourContext';

interface Props {
  variant?: 'default' | 'gate';
}

export const GlobalMusicControl: React.FC<Props> = ({ variant = 'default' }) => {
  const { lang, musicState, toggleMusic, showToast } = useTour();

  const trackConfig = musicState.currentTrack ? MUSIC_TRACKS[musicState.currentTrack] : null;
  const trackName = trackConfig
    ? lang === 'bn'
      ? trackConfig.labelBn
      : trackConfig.labelEn
    : '';

  const handleClick = () => {
    if (!musicState.isConfigured && trackConfig) {
      showToast(
        lang === 'bn'
          ? `অডিও URL এখনো সেট করা হয়নি (${trackConfig.fileName}) — src/config/music.ts-এ যোগ করুন।`
          : `Audio URL not configured yet for ${trackConfig.fileName} — paste it in src/config/music.ts.`,
      );
      return;
    }
    if (musicState.hasError && trackConfig) {
      showToast(
        lang === 'bn'
          ? `মিউজিক লোড করা যায়নি (${trackConfig.fileName})।`
          : `Could not load ${trackConfig.fileName}.`,
      );
    }
    toggleMusic();
  };

  const isPlaying = musicState.isPlaying;
  const needsTap = musicState.autoplayBlocked && !musicState.userPaused && musicState.isConfigured;

  const baseClass =
    variant === 'gate'
      ? isPlaying
        ? 'border-[#D4AF37] bg-[#D4AF37]/20 text-[#FAF7F0]'
        : needsTap
          ? 'border-[#D4AF37] bg-[#D4AF37] text-[#0E1612] animate-pulse'
          : 'border-white/20 bg-white/10 text-[#FAF7F0] hover:bg-white/20'
      : isPlaying
        ? 'border-[#14452F] bg-[#14452F]/12 text-[#14452F] dark:border-[#D4AF37] dark:bg-[#D4AF37]/15 dark:text-[#D4AF37]'
        : needsTap
          ? 'border-[#C45C3E] bg-[#C45C3E] text-white animate-pulse'
          : 'border-[#14452F]/15 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/5';

  const titleText = isPlaying
    ? `${lang === 'bn' ? 'বিরতি দিন' : 'Pause Music'}${trackName ? ` • ${trackName}` : ''}`
    : needsTap
      ? lang === 'bn'
        ? 'মিউজিক চালাতে ট্যাপ করুন'
        : 'Tap to play music'
      : `${lang === 'bn' ? 'মিউজিক চালান' : 'Play Music'}${trackName ? ` • ${trackName}` : ''}`;

  return (
    <button
      type="button"
      data-music-control="true"
      onClick={handleClick}
      aria-label={titleText}
      aria-pressed={isPlaying}
      title={titleText}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${baseClass}`}
    >
      {isPlaying ? (
        <>
          <span className="flex items-end gap-[2px] h-3.5" aria-hidden="true">
            <span className="w-[2px] h-2 bg-current rounded-full animate-pulse" />
            <span className="w-[2px] h-3.5 bg-current rounded-full animate-bounce" />
            <span className="w-[2px] h-2.5 bg-current rounded-full animate-pulse" />
          </span>
          <Pause className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline max-w-[100px] truncate">{trackName}</span>
        </>
      ) : needsTap ? (
        <>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{lang === 'bn' ? 'মিউজিক' : 'Play'}</span>
        </>
      ) : (
        <>
          <Music className="w-3.5 h-3.5 opacity-75" />
          <span className="hidden sm:inline opacity-80">
            {lang === 'bn' ? 'পজ' : 'Paused'}
          </span>
        </>
      )}
    </button>
  );
};
