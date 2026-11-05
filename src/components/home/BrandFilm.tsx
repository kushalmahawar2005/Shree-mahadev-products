"use client";

import { useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

/** Accepts a bare ID or any YouTube URL (watch?v=, youtu.be/, shorts/, embed/). */
export function youtubeIdFrom(input: string): string {
  const v = input.trim();
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = v.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : "";
}

const FILM = { src: "/videos/ghani-film.mp4", poster: "/videos/ghani-film.jpg" };

/**
 * Brand film. If a YouTube link is set in admin it plays that (click-to-load iframe).
 * Otherwise it plays our own ghani footage: muted loop preview, click for sound + controls.
 */
export function BrandFilm({ youtube, posterTitle, posterSub }: { youtube: string; posterTitle: string; posterSub: string }) {
  const [playing, setPlaying] = useState(false);
  const youtubeId = youtubeIdFrom(youtube);

  if (youtubeId) {
    return playing ? (
      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={posterTitle}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    ) : (
      <Poster title={posterTitle} sub={posterSub} onPlay={() => setPlaying(true)} img={`https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`} />
    );
  }
  return <OwnFilm title={posterTitle} sub={posterSub} />;
}

function OwnFilm({ title, sub }: { title: string; sub: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [full, setFull] = useState(false); // false = muted ambient loop, true = playing with sound
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  const start = () => {
    const v = ref.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    setMuted(false);
    v.play();
    setPaused(false);
    setFull(true);
  };

  return (
    <div className="group relative aspect-video overflow-hidden rounded-2xl bg-forest-deep shadow-[0_40px_70px_-40px_rgba(7,47,27,0.7)]">
      <video
        ref={ref}
        className="absolute inset-0 size-full object-cover"
        src={FILM.src}
        poster={FILM.poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onPause={() => setPaused(true)}
        onPlay={() => setPaused(false)}
      />

      {!full ? (
        <button type="button" onClick={start} className="absolute inset-0 flex flex-col justify-end text-left" aria-label={`Play film: ${title}`}>
          <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <span className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur-md transition-transform duration-300 group-hover:scale-110 md:size-24">
            <span className="absolute inset-0 animate-ping rounded-full bg-white/20" />
            <Play className="relative ml-1 size-8 fill-white text-white md:size-10" />
          </span>
          <span className="relative p-5 md:p-8">
            <span className="block text-2xl font-bold text-white md:text-4xl">{title}</span>
            <span className="mt-1 block text-sm text-white/80 md:text-base">{sub}</span>
          </span>
        </button>
      ) : (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => (paused ? ref.current?.play() : ref.current?.pause())}
            className="grid size-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30"
            aria-label={paused ? "Play" : "Pause"}
          >
            {paused ? <Play className="ml-0.5 size-4 fill-white" /> : <Pause className="size-4 fill-white" />}
          </button>
          <button
            type="button"
            onClick={() => {
              const v = ref.current;
              if (!v) return;
              v.muted = !v.muted;
              setMuted(v.muted);
            }}
            className="grid size-10 place-items-center rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30"
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

function Poster({ title, sub, img, onPlay }: { title: string; sub: string; img: string; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-forest-deep text-left" aria-label={`Play film: ${title}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
      <img src={img} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="absolute top-1/2 left-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 ring-1 ring-white/40 backdrop-blur-md transition-transform group-hover:scale-110">
        <Play className="ml-1 size-8 fill-white text-white" />
      </span>
      <span className="absolute inset-x-0 bottom-0 p-5 md:p-8">
        <span className="block text-2xl font-bold text-white md:text-4xl">{title}</span>
        <span className="mt-1 block text-sm text-white/80">{sub}</span>
      </span>
    </button>
  );
}
