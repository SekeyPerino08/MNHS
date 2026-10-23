import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // This is a convenience redirect only; real authentication and authorization happen on the backend.
  if (!request.cookies.has("school_token")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/teacher/:path*", "/student/:path*"],
};
