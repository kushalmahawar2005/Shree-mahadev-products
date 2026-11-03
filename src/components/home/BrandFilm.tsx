"use client";

import { useState } from "react";

/** Click-to-load YouTube embed (no iframe cost until the user asks). Without an ID it shows a poster only. */
export function BrandFilm({
  youtubeId,
  posterTitle,
  posterSub,
}: {
  youtubeId: string;
  posterTitle: string;
  posterSub: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing && youtubeId) {
    return (
      <div className="aspect-video overflow-hidden rounded-xl bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={posterTitle}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl bg-forest-deep text-white">
      {/* Poster: ghani + seeds illustration. TODO(client): replace with a real still from the film. */}
      <svg viewBox="0 0 800 450" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="film-glow" cx="70%" cy="40%" r="60%">
            <stop offset="0" stopColor="#B49024" stopOpacity="0.45" />
            <stop offset="1" stopColor="#072F1B" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="450" fill="url(#film-glow)" />
        <g fill="#D0B17A" opacity="0.18">
          {Array.from({ length: 40 }, (_, i) => (
            <ellipse key={i} cx={(i * 97) % 800} cy={330 + ((i * 53) % 120)} rx="9" ry="6" transform={`rotate(${(i * 37) % 180} ${(i * 97) % 800} ${330 + ((i * 53) % 120)})`} />
          ))}
        </g>
        <g transform="translate(560 120)" fill="none" stroke="#D0B17A" strokeWidth="4" opacity="0.55">
          <path d="M-70 200 L-50 40 L50 40 L70 200 Z" />
          <path d="M-60 40 Q0 0 60 40" />
          <path d="M0 -60 L0 120" />
          <path d="M-120 -60 L120 -60" />
        </g>
      </svg>

      <div className="relative flex size-full flex-col justify-between p-5 md:p-8">
        <div>
          <p className="text-2xl font-bold text-khaki md:text-4xl">{posterTitle}</p>
          <p className="mt-1 text-sm text-white/80 md:text-lg">{posterSub}</p>
        </div>
        {youtubeId ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="grid size-16 place-items-center self-center rounded-2xl bg-[#FF0000] transition-transform duration-200 hover:scale-105 md:size-20"
            aria-label={`Play film: ${posterTitle}`}
          >
            <svg viewBox="0 0 24 24" className="size-8 text-white" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        ) : (
          <p className="self-start rounded-full bg-white/10 px-3 py-1 text-xs text-khaki">
            Film coming soon
          </p>
        )}
      </div>
    </div>
  );
}
