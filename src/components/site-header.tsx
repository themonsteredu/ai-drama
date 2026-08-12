import Link from "next/link";
import { Clapperboard, GraduationCap } from "lucide-react";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className="no-print sticky top-0 z-50 border-b border-black/8 bg-[rgba(244,246,248,.9)] backdrop-blur-xl">
      <div className="shell flex h-18 items-center justify-between gap-4">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg">
          <span className="grid size-10 place-items-center rounded-lg bg-[#111827] text-white">
            <Clapperboard size={20} />
          </span>
          <span>
            <strong className="block text-base font-extrabold leading-none tracking-[-.03em] md:text-lg">문학이 무대가 되는 순간</strong>
            {compact ? null : <small className="mt-1 block text-[10px] font-bold tracking-[.2em] text-[var(--muted)]">LITERATURE PRODUCTION STUDIO</small>}
          </span>
        </Link>
        <nav className="flex items-center gap-2" aria-label="주요 메뉴">
          <Link className="btn btn-secondary min-h-10 px-4 text-sm" href="/student">학생 입장</Link>
          <Link className="btn btn-primary min-h-10 px-4 text-sm" href="/teacher"><GraduationCap size={16} /> 교사</Link>
        </nav>
      </div>
    </header>
  );
}
