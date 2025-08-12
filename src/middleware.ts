import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // For now, let the authentication be handled by the pages themselves
  // This avoids the Edge Runtime compatibility issue with NextAuth
  return NextResponse.next();
}

export const config = {
  matcher: ['/draw/:path*', '/dashboard/:path*'],
};