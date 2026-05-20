"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/* MVP 단계 — 실제 인증 백엔드 없음. 폼 제출 시 /app 으로 라우팅하여
 * UX 흐름만 시연. 입력값은 서버로 전송되지 않음. */

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setSubmitting(true);
    /* 짧은 지연으로 "로그인 중" 상태를 시각화 — 실제 인증 호출 자리. */
    window.setTimeout(() => {
      router.push("/app");
    }, 500);
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <label className="auth-field" htmlFor="login-email">
        <span className="auth-field-label">이메일</span>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          placeholder="teacher@academy.kr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="auth-field" htmlFor="login-password">
        <span className="auth-field-label">비밀번호</span>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <div className="auth-options">
        <label className="auth-remember">
          <input type="checkbox" defaultChecked />
          <span>로그인 유지</span>
        </label>
        <div className="auth-find-links">
          <Link href="#find-id">아이디 찾기</Link>
          <span className="auth-find-sep" aria-hidden="true">
            ·
          </span>
          <Link href="#forgot">비밀번호 찾기</Link>
        </div>
      </div>

      <button
        type="submit"
        className="btn btn-primary auth-submit"
        disabled={submitting}
      >
        <span>{submitting ? "들어가는 중…" : "로그인"}</span>
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );
}
