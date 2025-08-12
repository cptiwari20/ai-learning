import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

// Add debugging to see what's happening
console.log('🔧 Initializing NextAuth with config:', {
  hasAdapter: !!authConfig.adapter,
  hasProviders: !!authConfig.providers,
  hasSecret: !!authConfig.secret,
  envVars: {
    hasMongoUri: !!(process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING),
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  }
});

let nextAuth;
try {
  nextAuth = NextAuth(authConfig);
} catch (error) {
  console.error('❌ Failed to initialize NextAuth:', error);
  throw error;
}

// Debug the nextAuth object
console.log('🔧 NextAuth object created:', {
  hasHandlers: !!nextAuth.handlers,
  hasAuth: !!nextAuth.auth,
  hasSignIn: !!nextAuth.signIn,
  hasSignOut: !!nextAuth.signOut,
  handlersType: typeof nextAuth.handlers,
  handlersKeys: nextAuth.handlers ? Object.keys(nextAuth.handlers) : 'undefined'
});

// Export the handlers for API routes (NextAuth v4 syntax)
// Add fallback in case handlers is undefined
export const handlers = nextAuth.handlers || {
  GET: () => new Response('NextAuth not properly initialized', { status: 500 }),
  POST: () => new Response('NextAuth not properly initialized', { status: 500 })
};

export const auth = nextAuth.auth;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

// Type extensions for NextAuth
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      provider?: string;
    };
  }

  interface User {
    id: string;
    provider?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    provider?: string;
  }
}