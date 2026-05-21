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
      { label: "OpenMath 이란", href: "#about" },
      { label: "동형의 정의", href: "#isomorphism" },
      { label: "검증 6단계", href: "#verification" },
      { label: "변경 이력", href: "#changelog" },
    ],
  },
  {
    title: "도움말",
    links: [
      { label: "자주 묻는 질문", href: "#faq" },
      { label: "사용 가이드", href: "#guide" },
      { label: "키보드 단축키", href: "#shortcuts" },
      { label: "접근성", href: "#a11y" },
    ],
  },
  {
    title: "피드백",
    links: [
      { label: "이메일", href: "mailto:openmath@capstone.kr" },
      { label: "사용성 설문", href: "#survey" },
      { label: "이슈 트래커", href: "#issues" },
      { label: "강사 인터뷰 신청", href: "#interview" },
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
