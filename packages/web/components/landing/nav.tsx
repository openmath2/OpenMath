import Link from "next/link";
import { BrandMark } from "./brand-mark";

const navItems = [
  { href: "#curriculum", label: "교육과정" },
  { href: "#verification", label: "검증" },
  { href: "#docs", label: "문서" },
  { href: "#research", label: "연구" },
];

export function Nav() {
  return (
    <nav className="container-landing relative z-10 grid grid-cols-3 items-center py-6">
      <div className="brand-wordmark justify-self-start">
        <BrandMark />
        <span>OpenMath</span>
      </div>

      <div className="hidden justify-self-center gap-7 md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </div>

      {/* OM-76: 1차 MVP 무인증 정책 (D-3, D-12) → 로그인 링크 제거.
          /login 페이지 자체는 북마크 접근용으로 유지 (D-10 v2 인증 도입 시 복원). */}
      <div className="flex items-center justify-self-end gap-2">
        <Link href="/app" className="btn btn-ghost">
          <span>문제 생성하기</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </nav>
  );
}
