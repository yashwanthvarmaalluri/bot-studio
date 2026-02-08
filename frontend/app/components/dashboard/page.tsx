import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Header from '../Header'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/components/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get all chatbots for user
  const { data: chatbots } = await supabase
    .from('chatbots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch document metadata for storage stats
  const { data: documents } = await supabase
    .from('document_metadata')
    .select('file_size')
    .eq('user_id', user.id)

  const totalDocuments = documents?.length ?? 0
  const totalBytes = documents?.reduce((sum, doc) => sum + (doc.file_size || 0), 0) ?? 0

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    const index = Math.floor(Math.log(bytes) / Math.log(1024))
    const value = bytes / Math.pow(1024, index)
    return `${value.toFixed(index === 0 ? 0 : value < 10 ? 2 : 1)} ${units[index]}`
  }

  const storageUsed = formatBytes(totalBytes)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header />
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-700 bg-clip-text text-transparent mb-2">
            Dashboard
          </h1>
          <p className="text-gray-600 text-lg">Welcome to your chatbot workspace</p>
        </div>

        {/* Welcome Card */}
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl shadow-xl p-8 mb-6 border border-blue-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-gray-800 mb-2">
                Welcome back, {profile?.full_name || user.email?.split('@')[0]}! 👋
              </p>
              <p className="text-gray-600 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                {user.email}
              </p>
            </div>
            <div className="hidden md:block">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="text-sm font-semibold opacity-90 mb-2">Total Chatbots</div>
            <div className="text-4xl font-bold">{chatbots?.length || 0}</div>
            <div className="text-sm opacity-75 mt-2">
              {chatbots && chatbots.length > 0 ? 'Active chatbots' : 'Create your first chatbot'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="text-sm font-semibold opacity-90 mb-2">Documents</div>
            <div className="text-4xl font-bold">{totalDocuments}</div>
            <div className="text-sm opacity-75 mt-2">
              {totalDocuments > 0 ? 'Documents uploaded' : 'Upload documents'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform">
            <div className="text-sm font-semibold opacity-90 mb-2">Storage Used</div>
            <div className="text-4xl font-bold">{storageUsed}</div>
            <div className="text-sm opacity-75 mt-2">Across all documents</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              href="/components/create"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-4 px-6 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-center"
            >
              + Create New Chatbot
            </Link>
            <Link 
              href="/components/upload"
              className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-4 px-6 rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-center"
            >
              📄 Upload Documents
            </Link>
          </div>
        </div>

        {/* Chatbots List */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your Chatbots</h2>
          {chatbots && chatbots.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chatbots.map((chatbot) => (
                <Link
                  key={chatbot.id}
                  href={`/components/chatbot/${chatbot.id}`}
                  className="bg-gradient-to-br from-white to-blue-50 rounded-xl p-6 border border-blue-100 hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-bold text-gray-800">{chatbot.name}</h3>
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  </div>
                  <div className="flex-1 mb-4">
                    {chatbot.purpose ? (
                      <p className="text-sm text-gray-600 line-clamp-2">{chatbot.purpose}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No description</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mt-auto">
                    <span>Created {new Date(chatbot.created_at).toISOString().slice(0, 10)}</span>
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">View Details →</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-gray-600 text-lg mb-2">No chatbots yet</p>
              <p className="text-gray-500 text-sm mb-4">Create your first chatbot to get started</p>
              <Link
                href="/components/create"
                className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-2 px-6 rounded-xl hover:shadow-lg transition-all"
              >
                Create Chatbot
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
