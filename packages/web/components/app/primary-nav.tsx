import Link from "next/link";
import { BrandMark } from "@/components/landing/brand-mark";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/app", label: "워크스페이스" },
  { href: "/#curriculum", label: "교육과정" },
  { href: "/#verification", label: "검증" },
  { href: "/#docs", label: "문서" },
];

export function PrimaryNav() {
  return (
    <nav className="container-app app-nav" aria-label="주 메뉴">
      <Link href="/" className="brand-wordmark" aria-label="OpenMath — 홈으로">
        <BrandMark />
        <span>OpenMath</span>
      </Link>
      <div className="hidden gap-7 md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </div>
      <Link href="/app/new/grade" className="btn btn-secondary">
        <span>새 문제</span>
        <span aria-hidden="true">→</span>
      </Link>
    </nav>
  );
}
