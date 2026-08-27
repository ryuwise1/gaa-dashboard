import { NextRequest, NextResponse } from "next/server";

// GAA_DASH_PASSWORD 환경변수가 설정돼 있으면 전체 페이지에 간단한 비밀번호 잠금을 건다.
// (아이디는 아무거나, 비밀번호만 검사)
export function proxy(req: NextRequest) {
  const pass = process.env.GAA_DASH_PASSWORD;
  if (!pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const pw = decoded.slice(decoded.indexOf(":") + 1);
      if (pw === pass) return NextResponse.next();
    } catch {
      // malformed header → 401
    }
  }
  return new NextResponse("비밀번호가 필요합니다.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="GAA Portfolio", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
