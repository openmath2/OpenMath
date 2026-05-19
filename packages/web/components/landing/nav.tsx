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
    <nav className="container-landing relative z-10 flex items-center justify-between py-6">
      <div className="brand-wordmark">
        <BrandMark />
        <span>OpenMath</span>
      </div>

      <div className="hidden gap-7 md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </div>

      <Link href="#start" className="btn btn-primary">
        <span>문제 생성하기</span>
        <span className="opacity-70">→</span>
      </Link>
    </nav>
  );
}
