'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '../Header'

interface Chatbot {
  id: string
  name: string
  purpose: string | null
  created_at: string
}

export default function UploadDocumentsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [chatbots, setChatbots] = useState<Chatbot[]>([])
  const [selectedChatbotId, setSelectedChatbotId] = useState<string>('')
  const [uploadMode, setUploadMode] = useState<'add' | 'replace'>('add')
  const [files, setFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadChatbots()
  }, [])

  const loadChatbots = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/components/login')
        return
      }

      const { data, error } = await supabase
        .from('chatbots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(error.message)
      }

      setChatbots(data || [])
      if (data && data.length > 0) {
        setSelectedChatbotId(data[0].id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chatbots')
    } finally {
      setLoading(false)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/xml',
        'text/xml'
      ]
      return validTypes.includes(file.type)
    })

    setFiles(prev => [...prev, ...droppedFiles])
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(file => {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/xml',
        'text/xml'
      ]
      return validTypes.includes(file.type)
    })

    setFiles(prev => [...prev, ...selectedFiles])
  }, [])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedChatbotId) {
      setError('Please select a chatbot')
      return
    }

    if (files.length === 0) {
      setError('Please select at least one file to upload')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // If replace mode, delete existing files and metadata first
      if (uploadMode === 'replace') {
        const { data: existingFiles } = await supabase.storage
          .from('chat-documents')
          .list(`${user.id}/${selectedChatbotId}`, {
            limit: 1000,
            offset: 0,
          })

        if (existingFiles && existingFiles.length > 0) {
          const filePaths = existingFiles.map(f => `${user.id}/${selectedChatbotId}/${f.name}`)
          await supabase.storage
            .from('chat-documents')
            .remove(filePaths)
        }

        // Delete document_metadata records for this chatbot
        await supabase
          .from('document_metadata')
          .delete()
          .eq('chatbot_id', selectedChatbotId)
      }

      // Upload new files
      const uploaded: string[] = []
      const failed: string[] = []

      for (const file of files) {
        try {
          const filePath = `${user.id}/${selectedChatbotId}/${Date.now()}_${file.name}`

          // Upload file to storage
          const { error } = await supabase.storage
            .from('chat-documents')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            })

          if (error) {
            failed.push(file.name)
          } else {
            // Create record in document_metadata table
            const { error: metadataError } = await supabase
              .from('document_metadata')
              .insert({
                chatbot_id: selectedChatbotId,
                user_id: user.id,
                filename: file.name,
                file_path: filePath,
                file_size: file.size,
                mime_type: file.type,
                status: 'pending'
              })

            if (metadataError) {
              console.error('Failed to create document metadata:', metadataError)
              // File is uploaded, but metadata failed - mark as failed
              failed.push(file.name)
            } else {
              uploaded.push(file.name)
            }
          }
        } catch (err) {
          failed.push(file.name)
        }
      }

      if (failed.length > 0) {
        setError(`Failed to upload: ${failed.join(', ')}`)
      } else {
        // Redirect to dashboard after successful upload
        router.push('/components/dashboard')
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600">Loading chatbots...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Header />
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link
            href="/components/dashboard"
            className="text-blue-600 hover:text-blue-700 flex items-center gap-2 mb-4"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-700 bg-clip-text text-transparent">
            Upload Documents
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg shadow-sm mb-6">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chatbot Selection */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Chatbot</h2>
            
            {chatbots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No chatbots found. Create one first!</p>
                <Link
                  href="/components/create"
                  className="inline-block bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-2 px-6 rounded-xl hover:shadow-lg transition-all"
                >
                  Create Chatbot
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="chatbot" className="block text-sm font-semibold text-gray-700 mb-2">
                    Choose Chatbot <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="chatbot"
                    value={selectedChatbotId}
                    onChange={(e) => setSelectedChatbotId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900"
                    required
                  >
                    {chatbots.map((chatbot) => (
                      <option key={chatbot.id} value={chatbot.id}>
                        {chatbot.name} {chatbot.purpose && `- ${chatbot.purpose}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Upload Mode
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="uploadMode"
                        value="add"
                        checked={uploadMode === 'add'}
                        onChange={(e) => setUploadMode('add')}
                        className="mr-2"
                      />
                      <span className="text-gray-700">Add to existing files</span>
                    </label>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="uploadMode"
                        value="replace"
                        checked={uploadMode === 'replace'}
                        onChange={(e) => setUploadMode('replace')}
                        className="mr-2"
                      />
                      <span className="text-gray-700">Replace all files</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {uploadMode === 'add' 
                      ? 'New files will be added to the existing documents'
                      : 'Warning: This will delete all existing files for this chatbot'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* File Upload */}
          {chatbots.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Select Files</h2>
              
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all mb-6 ${
                  isDragOver
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <svg
                    className="w-12 h-12 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-gray-600 font-medium mb-1">
                    Drag and drop files here, or click to select
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports: PDF, Word, Excel, Text, XML
                  </p>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-700 mb-2">Selected Files ({files.length})</h3>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="ml-4 text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          {chatbots.length > 0 && (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {uploading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </span>
                ) : (
                  `${uploadMode === 'replace' ? 'Replace' : 'Upload'} Files`
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

