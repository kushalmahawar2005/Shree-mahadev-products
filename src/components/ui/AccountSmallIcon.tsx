"use client";

// AccountSmall icon by Vjacheslav Trushkin (line-md), MIT License.
import * as React from "react";

export type AccountSmallIconProps = {
  size?: number;
  className?: string;
  /** Change this value to replay the draw-in animation from a parent. */
  animationKey?: React.Key;
};

export function AccountSmallIcon({
  size = 24,
  className,
  animationKey = "account-small",
}: AccountSmallIconProps) {
  const [hoverKey, setHoverKey] = React.useState(0);

  return (
    <svg
      key={`${String(animationKey)}-${hoverKey}`}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      onMouseEnter={() => setHoverKey((value) => value + 1)}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeDasharray="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      >
        <path d="M6 19v-1c0 -2.21 1.79 -4 4 -4h4c2.21 0 4 1.79 4 4v1">
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            dur="0.3s"
            values="22;0"
          />
        </path>
        <path
          strokeDashoffset={22}
          d="M12 11c-1.66 0 -3 -1.34 -3 -3c0 -1.66 1.34 -3 3 -3c1.66 0 3 1.34 3 3c0 1.66 -1.34 3 -3 3Z"
        >
          <animate
            fill="freeze"
            attributeName="stroke-dashoffset"
            begin="0.3s"
            dur="0.3s"
            to="0"
          />
        </path>
      </g>
    </svg>
  );
}

export default AccountSmallIcon;
