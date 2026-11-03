/** Glass reflection / shine sweep over a coloured band. Purely decorative, CSS-only. */
export function ReflectionSweep() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="reflection-animation absolute inset-y-0 left-0 h-full w-full" viewBox="0 0 400 100" preserveAspectRatio="none">
        <defs>
          <filter id="reflection-blur" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>
        <g fill="#fff" fillOpacity="0.12" filter="url(#reflection-blur)">
          <polygon points="150,0 178,0 150,100 122,100" />
          <polygon points="186,0 196,0 168,100 158,100" />
          <polygon points="206,0 230,0 202,100 178,100" />
        </g>
      </svg>
    </div>
  );
}
