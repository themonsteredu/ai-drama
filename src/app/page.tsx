import { HomeHero } from "@/components/home-hero";
import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return <><SiteHeader/><main><HomeHero/></main><footer className="border-t border-black/8 bg-white py-8 text-center text-sm text-[var(--muted)]">문학을 읽고, 해석하고, 무대 위에서 다시 만듭니다.</footer></>;
}
