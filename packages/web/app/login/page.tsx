import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/landing/brand-mark";
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
          <BrandMark />
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

          {/* OM-76: 1차 MVP 무인증 정책 안내. v2 Better Auth 도입 (D-10) 전까지 mock. */}
          <div
            className="inline-notice inline-notice-warn"
            role="status"
            style={{ marginBottom: 16 }}
          >
            <span className="icon" aria-hidden="true">⚠</span>
            <span className="body">
              1차 MVP 는 무인증 운영 중입니다. 로그인 기능은 v2 에서
              제공됩니다 (D-3, D-10).
            </span>
          </div>

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
