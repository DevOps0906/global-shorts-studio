import { loadBigText } from "@/server/settings";
import { BigTextFlag } from "@/components/settings/big-text-flag";

/** 루트 레이아웃용(Suspense 안): 저장된 큰 글씨 모드를 <html class="big-text">에 반영 */
export async function BigTextSync() {
  return <BigTextFlag saved={await loadBigText()} />;
}
