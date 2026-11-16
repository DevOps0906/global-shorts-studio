const colors = [
  ["bg", "bg-bg"],
  ["panel", "bg-panel"],
  ["card", "bg-card"],
  ["card2", "bg-card2"],
  ["line", "bg-line"],
  ["text", "bg-text"],
  ["sub", "bg-sub"],
  ["accent", "bg-accent"],
  ["pink", "bg-pink"],
  ["ok", "bg-ok"],
  ["danger", "bg-danger"],
] as const;

export default function TokenSamplePage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-8 flex flex-col gap-6">
      <h1 className="text-h1 font-bold">디자인 토큰 견본</h1>
      <h2 className="text-h2 font-semibold">색상</h2>
      <ul className="grid grid-cols-3 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {colors.map(([name, cls]) => (
          <li key={name} className="flex flex-col gap-1">
            <span className={`${cls} h-12 rounded-lg border border-line`} />
            <span className="text-sub">{name}</span>
          </li>
        ))}
      </ul>
      <h2 className="text-h2 font-semibold">본문</h2>
      <p className="text-body">
        본문 텍스트 견본입니다. 구간별(모바일·태블릿·데스크톱)로 크기가 달라지고
        큰 글씨 모드에서 1.2배가 됩니다.
      </p>
      <div>
        <button
          type="button"
          className="bg-cta rounded-lg px-5 py-3 font-semibold text-bg"
        >
          CTA 버튼
        </button>
      </div>
    </main>
  );
}
