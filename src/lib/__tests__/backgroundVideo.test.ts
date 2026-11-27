import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BackgroundVideo } from '../../components/BackgroundVideo';
import { ExploreScene } from '../../components/ExploreScene';
import { DEFAULT_EXPLORE_DESTINATIONS } from '../../data/defaultSeed';

describe('Shared BackgroundVideo & ExploreScene rendering', () => {
  it('renders YouTube background video directly without poster/image layers or blur filters', () => {
    const html = renderToStaticMarkup(
      React.createElement(BackgroundVideo, {
        src: 'https://youtu.be/G5oeAwgew6k?si=EnBD6ttc1SEcLVmC',
        title: 'Homepage background video',
        isOnline: true,
        shouldMount: true,
        overlayClassName: 'bg-gradient-to-b from-[#0A2015]/68 via-[#0E2D1E]/24 to-[#0A1911]/88',
      }),
    );

    expect(html).not.toContain('<img');
    expect(html).not.toContain('poster=');
    expect(html).not.toContain('backdrop-blur');
    expect(html).not.toContain('filter:blur');
    expect(html).toContain('<iframe');
    expect(html).toContain('youtube-nocookie.com/embed/G5oeAwgew6k');
    expect(html).toContain('autoplay=1');
    expect(html).toContain('mute=1');
    expect(html).toContain('loop=1');
    expect(html).toContain('playsinline=1');
    expect(html).toContain('opacity-100');
    expect(html).not.toContain('opacity-80');
    expect(html).not.toContain('opacity-90');
    expect(html).toContain('container-type:size');
  });

  it('renders native MP4 background video cleanly with autoplay, muted, loop, playsInline, and object-cover without poster', () => {
    const html = renderToStaticMarkup(
      React.createElement(BackgroundVideo, {
        src: 'https://cdn.example.com/panam-tour.mp4',
        title: 'Direct background clip',
        isOnline: true,
        shouldMount: true,
      }),
    );

    expect(html).not.toContain('<img');
    expect(html).not.toContain('poster=');
    expect(html).not.toContain('backdrop-blur');
    expect(html).toContain('<video');
    expect(html).toContain('src="https://cdn.example.com/panam-tour.mp4"');
    expect(html).toContain('autoPlay=""');
    expect(html).toContain('muted=""');
    expect(html).toContain('loop=""');
    expect(html).toContain('playsInline=""');
    expect(html).toContain('object-cover');
    expect(html).toContain('opacity-100');
  });

  it('falls back to a clean gradient background rather than an image when offline or unmounted', () => {
    const offlineHtml = renderToStaticMarkup(
      React.createElement(BackgroundVideo, {
        src: 'https://www.youtube.com/watch?v=oxF2UKB0VjY',
        title: 'Offline scene',
        isOnline: false,
        shouldMount: true,
      }),
    );

    expect(offlineHtml).not.toContain('<img');
    expect(offlineHtml).not.toContain('<iframe');
    expect(offlineHtml).not.toContain('<video');
    expect(offlineHtml).toContain('bg-gradient-to-br');

    const unmountedHtml = renderToStaticMarkup(
      React.createElement(BackgroundVideo, {
        src: 'https://www.youtube.com/watch?v=oxF2UKB0VjY',
        title: 'Offscreen scene',
        isOnline: true,
        shouldMount: false,
      }),
    );

    expect(unmountedHtml).not.toContain('<img');
    expect(unmountedHtml).not.toContain('<iframe');
    expect(unmountedHtml).toContain('bg-gradient-to-br');
  });

  it('renders ExploreScene with direct background video and zero fallback artwork img overlay', () => {
    const dest = DEFAULT_EXPLORE_DESTINATIONS[0];
    const html = renderToStaticMarkup(
      React.createElement(ExploreScene, {
        dest,
        index: 0,
        total: 4,
        lang: 'en',
        isActive: true,
        isNearViewport: true,
        isOnline: true,
        isAdmin: false,
        prefersReducedMotion: false,
        nextDestination: DEFAULT_EXPLORE_DESTINATIONS[1],
        onSceneRef: () => {},
        onOpenDetails: () => {},
        onConfigureMedia: () => {},
        onJumpToScene: () => {},
      }),
    );

    expect(html).not.toContain('<img');
    expect(html).not.toContain(dest.fallback_image_url);
    expect(html).toContain('youtube-nocookie.com/embed/oxF2UKB0VjY');
    expect(html).toContain('Panam Nagar');
    expect(html).toContain('opacity-100');
  });
});
