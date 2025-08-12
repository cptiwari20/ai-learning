import { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import bcryptjs from 'bcryptjs';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import { MongoClient } from 'mongodb';

// MongoDB client for NextAuth adapter with fallback connection strings
const getMongoClient = () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
  
  if (!mongoUri) {
    throw new Error('MongoDB connection string not found in environment variables');
  }
  
  console.log('Connecting to MongoDB with URI:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'));
  
  return new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
    connectTimeoutMS: 15000, // Give up initial connection after 15s
    maxPoolSize: 10, // Maintain up to 10 socket connections
    retryWrites: true,
    // Remove serverApi for better compatibility with older MongoDB versions
  });
};

const client = getMongoClient();
const clientPromise = Promise.resolve(client);

export const authConfig: NextAuthConfig = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    // Only include Google provider if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && 
        process.env.GOOGLE_CLIENT_ID !== 'your-google-client-id' ? [
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    ] : []),
    Credentials({
      id: 'credentials',
      name: 'Email and Password',
      credentials: {
        email: { 
          label: 'Email', 
          type: 'email',
          placeholder: 'Enter your email' 
        },
        password: { 
          label: 'Password', 
          type: 'password',
          placeholder: 'Enter your password'
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          await client.connect();
          const users = client.db().collection('users');
          
          const user = await users.findOne({ 
            email: credentials.email as string 
          });

          if (!user) {
            return null;
          }

          const isValidPassword = await bcryptjs.compare(
            credentials.password as string,
            user.password
          );

          if (!isValidPassword) {
            return null;
          }

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            image: user.image || null,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.userId = user.id;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.userId as string;
        session.user.provider = token.provider as string;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          await client.connect();
          const users = client.db().collection('users');
          
          // Check if user exists
          const existingUser = await users.findOne({ 
            email: user.email 
          });

          if (!existingUser) {
            // Create new user for Google sign-in
            await users.insertOne({
              email: user.email,
              name: user.name,
              image: user.image,
              provider: 'google',
              googleId: profile?.sub,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return true;
        } catch (error) {
          console.error('Google sign-in error:', error);
          return false;
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
};