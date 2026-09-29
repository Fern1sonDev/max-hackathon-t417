import type { ReactNode } from "react";
import Reveal from "./Reveal";

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  light = false,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "center" | "left";
  light?: boolean;
}) {
  return (
    <div className={`${align === "center" ? "mx-auto text-center" : "text-left"} max-w-2xl`}>
      <Reveal>
        <p className={`text-sm font-semibold ${light ? "text-blue-300" : "text-blue-700"}`}>{eyebrow}</p>
        <h2 className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${light ? "text-white" : "text-slate-900"}`}>{title}</h2>
        {description && <p className={`mt-4 text-lg ${light ? "text-slate-300" : "text-slate-500"}`}>{description}</p>}
      </Reveal>
    </div>
  );
}
