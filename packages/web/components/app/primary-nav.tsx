import Link from "next/link";

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: "/app", label: "워크스페이스" },
  { href: "/samples", label: "예시" },
  { href: "/app/new/grade", label: "출제" },
  { href: "/login", label: "로그인" },
];

export function PrimaryNav() {
  return (
    <nav className="container-app app-nav" aria-label="주 메뉴">
      <Link href="/" className="brand-wordmark" aria-label="OpenMath — 홈으로">
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
