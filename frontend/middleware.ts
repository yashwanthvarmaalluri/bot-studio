import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If user is not signed in and trying to access protected route
  if (!user && (request.nextUrl.pathname.startsWith('/components/dashboard') ||
                request.nextUrl.pathname.startsWith('/components/create') ||
                request.nextUrl.pathname.startsWith('/components/chatbot') ||
                request.nextUrl.pathname.startsWith('/components/profile') ||
                request.nextUrl.pathname.startsWith('/components/upload'))) {
    return NextResponse.redirect(new URL('/components/login', request.url))
  }

  // If user is signed in and trying to access auth pages
  if (user && (request.nextUrl.pathname.startsWith('/components/login') || 
               request.nextUrl.pathname.startsWith('/components/signup'))) {
    return NextResponse.redirect(new URL('/components/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/components/dashboard/:path*', '/components/create/:path*', '/components/chatbot/:path*', '/components/profile/:path*', '/components/upload/:path*', '/components/login/:path*', '/components/signup/:path*'],
}

