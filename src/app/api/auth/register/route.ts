import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import { MongoClient } from 'mongodb';
import { COLLECTIONS, type User } from '@/lib/auth/user.models';

console.log('process.env.MONGODB_URI', process.env.MONGODB_URI);
const client = new MongoClient(process.env.MONGODB_URI!);

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    await client.connect();
    const users = client.db().collection<User>(COLLECTIONS.USERS);

    // Check if user already exists
    const existingUser = await users.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcryptjs.hash(password, saltRounds);

    // Create new user
    const newUser: Omit<User, '_id'> = {
      email,
      name: name || null,
      password: hashedPassword,
      provider: 'credentials',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await users.insertOne(newUser);

    // Create default user settings
    const userSettings = client.db().collection(COLLECTIONS.USER_SETTINGS);
    await userSettings.insertOne({
      userId: result.insertedId.toString(),
      preferences: {
        autoTTS: true,
        voiceSpeed: 1.0,
        conversationMode: 'simple',
        theme: 'system',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return NextResponse.json({
      message: 'User created successfully',
      userId: result.insertedId,
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}