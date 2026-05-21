const features = [
  {
    num: "01 / 생성",
    title: "수학적으로 옳은 문제",
    body: "LLM 이 만든 답을 그대로 믿지 않습니다. SymPy 가 6단계 결정론적 게이트로 풀이를 검증한 문항만 사용자에게 노출됩니다.",
  },
  {
    num: "02 / 동형성",
    title: "진짜 동형 문제",
    body: "숫자만 바꾼 표면 변형이 아닙니다. 구조 동형(같은 풀이 단계)과 개념 동형(같은 학습 목표, 다른 풀이 경로) 두 가지를 명시적으로 분리합니다.",
  },
  {
    num: "03 / 교육과정",
    title: "2022 개정 교육과정 정렬",
    body: "중1 ~ 중3 전 단원의 성취기준 코드와 1:1 매핑됩니다. 출제 의도와 평가 차원이 문제마다 명시되어, 강사가 학습 목표를 직접 확인할 수 있습니다.",
  },
];

export function FeatureStrip() {
  return (
    <section className="container-landing relative z-[2] pb-20 pt-6">
      <div className="feature-grid">
        {features.map((f, i) => (
          <div
            key={f.num}
            className="feature-cell"
            style={i === 0 ? { paddingLeft: 0 } : undefined}
          >
            <span className="num">{f.num}</span>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
