import Link from "next/link";

export default function NotFound() {
  return <main className="shell grid min-h-screen place-items-center"><section className="paper-card max-w-xl rounded-[32px] p-10 text-center"><p className="eyebrow">404 · 빈 무대</p><h1 className="display-serif mt-3 text-4xl font-bold">이 장면은 아직 준비되지 않았어요.</h1><Link className="btn btn-primary mt-7" href="/">첫 화면으로</Link></section></main>;
}
