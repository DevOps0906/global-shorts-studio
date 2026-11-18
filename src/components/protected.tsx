import { Suspense, type ReactNode } from "react";
import type { Role } from "@/lib/nav";
import { requireSession } from "@/server/auth";

async function Gate({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  await requireSession(roles);
  return children;
}

/**
 * 보호 화면 감싸기(proxy 다음 2차 관문). 세션 확인이 끝나야 내용을 보여 준다.
 * 비로그인 → /login, 미승인 → /pending, roles 밖 → 404.
 */
export function Protected({
  roles,
  fallback = null,
  children,
}: {
  roles?: Role[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense fallback={fallback}>
      <Gate roles={roles}>{children}</Gate>
    </Suspense>
  );
}
