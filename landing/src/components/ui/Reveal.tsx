import type { ReactNode } from "react";
import { useInView } from "../../hooks/useInView";

export default function Reveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`${inView ? "animate-fade-up" : "opacity-0"} ${className}`}
      style={inView ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}
