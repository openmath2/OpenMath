import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./form";

export const metadata: Metadata = {
  title: "로그인 — OpenMath",
  description: "OpenMath 워크스페이스에 로그인하여 출제를 시작하세요.",
};

export default function LoginPage() {
  return (
    <div className="landing-canvas landing-grid relative min-h-screen">
      <nav
        className="container-landing relative z-10 flex items-center justify-between py-6"
        aria-label="주 메뉴"
      >
        <Link href="/" className="brand-wordmark" aria-label="OpenMath — 홈으로">
          <span>OpenMath</span>
        </Link>
        <Link href="/" className="nav-link">
          <span aria-hidden="true">←</span> 홈으로
        </Link>
      </nav>

      <main className="container-landing auth-shell">
        <div className="auth-card">
          <span className="eyebrow">
            <span className="dot" />
            LOGIN
          </span>
          <h1 className="auth-title">OpenMath</h1>
          <p className="auth-subtitle">이메일과 비밀번호로 들어가세요.</p>

          <LoginForm />

          <div className="auth-divider" aria-hidden="true">
            <span className="auth-divider-line" />
            <span className="auth-divider-text">OR</span>
            <span className="auth-divider-line" />
          </div>

          <p className="auth-footer-note">
            처음 사용하시나요? <strong>회원가입</strong>은 캡스톤 데모 이후
            출시됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}
