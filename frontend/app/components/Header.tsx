'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function Header() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/components/login')
    router.refresh()
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm mb-6">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/components/dashboard" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Bot Studio
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/components/profile"
              className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2 px-4 rounded-xl hover:shadow-lg transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

