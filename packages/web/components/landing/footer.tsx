import Link from "next/link";

type FooterLink = {
  label: string;
  href: string;
};

type FooterColumn = {
  title: string;
  links: FooterLink[];
};

const columns: FooterColumn[] = [
  {
    title: "소개",
    links: [
      { label: "OpenMath 홈", href: "/" },
      { label: "검증 예시", href: "/samples" },
      { label: "문제 생성", href: "/app" },
      { label: "학년 선택", href: "/app/new/grade" },
    ],
  },
  {
    title: "도움말",
    links: [
      { label: "워크스페이스", href: "/app" },
      { label: "샘플 문항", href: "/samples" },
      { label: "로그인", href: "/login" },
      { label: "PDF 출력", href: "/app/new/export" },
    ],
  },
  {
    title: "피드백",
    links: [
      { label: "이메일", href: "mailto:openmath@capstone.kr" },
      { label: "데모 시작", href: "/app/new/grade" },
      { label: "결과 화면", href: "/app/new/result" },
      { label: "홈으로", href: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="container-landing footer-grid">
        {columns.map((col) => (
          <div key={col.title} className="footer-col">
            <h3>{col.title}</h3>
            <ul>
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container-landing footer-fineprint">
        <div className="left">
          <span>© 2026 OpenMath</span>
          <span aria-hidden="true">·</span>
          <span>Seoul · Open Source</span>
        </div>
        <div className="right">
          <span>build alpha-0.1</span>
        </div>
      </div>
    </footer>
  );
}
