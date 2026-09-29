import { Check, Info, X } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";
import type { Vacancy } from "../lib/api";
import { Avatar, MatchRing, SkillChip } from "./ui";

const SWIPE_THRESHOLD = 110;

export default function SwipeCard({ vacancy, position, onApply, onSkip, onOpen, busy }: {
  vacancy: Vacancy;
  position: string;
  onApply: () => void;
  onSkip: () => void;
  onOpen: () => void;
  busy: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"none" | "x" | "y">("none");

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    axisRef.current = "none";
    setDragging(true);
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const deltaX = e.clientX - startRef.current.x;
    const deltaY = e.clientY - startRef.current.y;
    // Commit to a horizontal drag only once movement clearly dominates one
    // axis — otherwise a vertical scroll near the card reads as a swipe.
    if (axisRef.current === "none" && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      axisRef.current = Math.abs(deltaX) > Math.abs(deltaY) * 1.5 ? "x" : "y";
    }
    if (axisRef.current === "x") setDx(deltaX);
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (axisRef.current === "x") {
      if (dx > SWIPE_THRESHOLD) onApply();
      else if (dx < -SWIPE_THRESHOLD) onSkip();
    }
    setDx(0);
    setDragging(false);
    startRef.current = null;
    axisRef.current = "none";
  }

  const match = vacancy.match;
  const hint = dx > 40 ? "Откликнуться" : dx < -40 ? "Пропустить" : "";

  return (
    <div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ transform: `translateX(${dx}px) rotate(${dx / 22}deg)` }}
        className={`card relative touch-pan-y select-none p-5 ${dragging ? "" : "transition-transform duration-200"}`}
      >
        {hint && <span className={`absolute left-1/2 top-4 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white ${dx > 0 ? "bg-emerald-500" : "bg-slate-500"}`}>{hint}</span>}
        <div className="flex items-center justify-between text-xs font-medium text-slate-400"><span>{position}</span><button onClick={onOpen} className="btn-ghost"><Info className="h-3.5 w-3.5" />Подробнее</button></div>
        <div className="mt-4 flex flex-col items-center text-center">
          <MatchRing score={match?.score ?? 0} potential={match?.potential} size={96} />
          <h3 className="mt-4 text-xl font-bold leading-tight text-slate-900">{vacancy.title}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Avatar name={vacancy.company_name} size={22} />{vacancy.company_name}</p>
        </div>
        {match && <div className="mt-4 flex flex-wrap justify-center gap-1.5">{match.items.map((item) => <SkillChip key={item.skill} item={item} />)}</div>}
        <p className="mt-4 line-clamp-4 text-center text-sm leading-6 text-slate-600">{vacancy.description}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button onClick={onSkip} className="btn-secondary"><X className="h-4 w-4" />Пропустить</button>
        <button onClick={onApply} disabled={busy} className="btn-primary"><Check className="h-4 w-4" />Откликнуться</button>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">Смахните вправо, чтобы откликнуться, влево — чтобы пропустить</p>
    </div>
  );
}
