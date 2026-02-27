'use client';

import { useEffect, useMemo, useState } from 'react';

type CooldownTimerProps = {
  initialSeconds: number;
  onExpire?: () => void;
};

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => value.toString().padStart(2, '0'))
    .join(':');
}

export function CooldownTimer({ initialSeconds, onExpire }: CooldownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.();
      return;
    }

    const id = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(id);
  }, [secondsLeft, onExpire]);

  const label = useMemo(() => formatDuration(secondsLeft), [secondsLeft]);

  return <span className="font-mono text-sm tracking-wide">{label}</span>;
}
