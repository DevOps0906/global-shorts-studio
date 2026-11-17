import { clsx, cn as baseCn } from "cn";

/**
 * 프로젝트 글자 크기 토큰(design/tokens.css → globals.css @theme).
 * 기본 cn은 text-caption·text-body 같은 이름을 글자색으로 오인해 text-sub 등과 합칠 때 한쪽을 지운다.
 * 그래서 글자 크기 클래스는 여기서 직접 골라 "같은 접두사(md:·hover: 등)끼리 마지막 것만" 남긴다.
 */
const FONT_SIZE =
  /^((?:[^:\s]+:)*)!?text-(?:micro|2xs|xs|caption|sm|base|body|md|lg|xl|2xl|3xl|display|h1|h2|\[length:[^\]]+\])(?:\/\S+)?$/;

export function cn(...inputs: Parameters<typeof clsx>): string {
  const sizes = new Map<string, string>();
  const rest: string[] = [];
  for (const cls of clsx(...inputs).split(/\s+/)) {
    if (!cls) continue;
    const m = FONT_SIZE.exec(cls);
    if (m) {
      sizes.delete(m[1]); // 순서를 뒤로 보내고 마지막 값으로
      sizes.set(m[1], cls);
    } else {
      rest.push(cls);
    }
  }
  return [baseCn(rest.join(" ")), ...sizes.values()].filter(Boolean).join(" ");
}
