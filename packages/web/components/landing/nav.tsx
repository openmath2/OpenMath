import Link from "next/link";

const navItems = [
  { href: "/samples", label: "예시" },
  { href: "/app", label: "검증" },
  { href: "/app/new/grade", label: "출제" },
  { href: "/login", label: "로그인" },
];

export function Nav() {
  return (
    <nav className="container-landing relative z-10 grid grid-cols-3 items-center py-6">
      <div className="brand-wordmark justify-self-start">
        <span>OpenMath</span>
      </div>

      <div className="hidden justify-self-center gap-7 md:flex">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="nav-link">
            {item.label}
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-self-end gap-2">
        <Link href="/app" className="btn btn-ghost">
          <span>문제 생성하기</span>
          <span aria-hidden="true">→</span>
        </Link>
        <Link href="/login" className="btn btn-ghost">
          <span>로그인</span>
        </Link>
      </div>
    </nav>
  );
}
