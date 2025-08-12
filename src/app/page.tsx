'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-600 animate-pulse">Loading Visual Learning AI...</p>
        </div>
      </div>
    );
  }

  if (status === 'authenticated') {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -inset-10 opacity-50">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
              }}
            >
              <div className="w-2 h-2 bg-indigo-400 rounded-full opacity-60"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="relative z-50 bg-white/10 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AI</span>
                </div>
                <h1 className="text-xl font-bold text-white">
                  Visual Learning AI
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/auth/signin"
                className="text-gray-300 hover:text-white px-3 py-2 text-sm font-medium transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/auth/signup"
                className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-20 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="text-6xl mb-8">🎓🎨</div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Learn Visually with
              <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent block">AI-Powered Drawings</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Transform complex concepts into interactive visual diagrams. Ask questions about any topic and watch AI create 
              step-by-step explanations with real-time drawings that make learning intuitive and engaging.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link
                href="/auth/signup"
                className="group px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl text-lg font-semibold hover:from-indigo-600 hover:to-purple-600 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 hover:-translate-y-1"
              >
                <span className="flex items-center justify-center gap-2">
                  Start Learning Free
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
              </Link>
              <Link
                href="/auth/signin"
                className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white border-2 border-white/20 rounded-xl text-lg font-semibold hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-lg"
              >
                Sign In
              </Link>
            </div>

            {/* Features */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="group bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <div className="text-4xl mb-4 group-hover:animate-bounce">💬</div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Ask Anything
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Type or speak your questions about any topic. Our AI understands context and provides detailed explanations tailored to your learning style.
                </p>
              </div>
              
              <div className="group bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <div className="text-4xl mb-4 group-hover:animate-pulse">✏️</div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Visual Learning
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Watch concepts come to life with auto-generated diagrams, flowcharts, and interactive visual representations that adapt to your questions.
                </p>
              </div>
              
              <div className="group bg-white/10 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-xl hover:shadow-2xl hover:bg-white/15 transition-all duration-300 hover:scale-105">
                <div className="text-4xl mb-4 group-hover:animate-spin">📚</div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  Track Progress
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  Review your learning journey with saved sessions, chat history, and visual notes. Monitor your progress across different topics.
                </p>
              </div>
            </div>

            {/* Example Topics */}
            <div className="mt-20">
              <h2 className="text-3xl font-bold text-white mb-8">
                Perfect for Learning...
              </h2>
              <div className="flex flex-wrap gap-3 justify-center">
                {[
                  'Photosynthesis', 'Machine Learning', 'Programming', 'Physics', 
                  'Chemistry', 'Mathematics', 'History', 'Economics', 'Biology',
                  'Data Structures', 'Philosophy', 'Business Strategy'
                ].map((topic, index) => (
                  <span
                    key={topic}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 backdrop-blur-sm text-white border border-white/20 rounded-full text-sm font-medium hover:from-indigo-500/30 hover:to-purple-500/30 hover:scale-105 transition-all duration-300 cursor-default"
                    style={{
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative bg-white/5 backdrop-blur-sm border-t border-white/10 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-purple-400 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AI</span>
              </div>
              <span className="text-xl font-bold text-white">Visual Learning AI</span>
            </div>
            <p className="text-gray-400 mb-6">Empowering education through interactive visualization</p>
            <div className="text-sm text-gray-500">
              <p>&copy; 2024 Visual Learning AI. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
