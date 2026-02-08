'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Header from '../../Header'

interface FileItem {
  name: string
  id: string
  created_at: string
  metadata: {
    size: number
    mimetype: string
  }
}

export default function ChatbotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const chatbotId = params.id as string

  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [ingesting, setIngesting] = useState(false)
  const [documentStatuses, setDocumentStatuses] = useState<any[]>([])
  const [loadingStatuses, setLoadingStatuses] = useState(false)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  // Backend API URL
  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://bot-studio-zixn.onrender.com'

  const WIDGET_SCRIPT_URL = process.env.NEXT_PUBLIC_WIDGET_SCRIPT_URL ?? 'https://bot-studio-dc6.pages.dev/index.global.js'

  const embedSnippet = useMemo(() => {
    const widgetOptions = {
      chatbotId,
      apiBaseUrl: API_URL,
      launcherLabel: 'Chat with support',
      title: name || 'Chat Assistant',
      subtitle: 'Powered by Bot Studio',
      welcomeMessage: 'Hi there! I’m here to help. Ask me anything about our services.',
      accentColor: '#2563eb',
      theme: 'light',
      position: 'bottom-right',
      panelHeight: 550,
    }

    // Build options block WITHOUT outer braces so it fits inside init({ ... })
    const optionsJsonLines = JSON.stringify(widgetOptions, null, 2).split('\n')
    const optionsInner = optionsJsonLines.slice(1, Math.max(1, optionsJsonLines.length - 1)) // drop first '{' and last '}'
      .map((line) => `      ${line}`)
      .join('\n')

    const lines = [
      `<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>`,
      `<script src="${WIDGET_SCRIPT_URL}" defer></script>`,
      `<script>`,
      `  window.addEventListener('DOMContentLoaded', () => {`,
      `    window.BotStudioWidget.init({`,
      `${optionsInner ? optionsInner + ',' : ''}`,
      `      // Optional renderer: safely render Markdown content if available on host page`,
      `      markdownRenderer: (text) => {`,
      `        try {`,
      `          if (window.marked && typeof window.marked.parse === 'function') {`,
      `            return window.marked.parse(text ?? '')`,
      `          }`,
      `        } catch (e) {}`,
      `        return text || ''`,
      `      }`,
      `    });`,
      `  });`,
      `</script>`,
    ]

    return lines.join('\n')
  }, [API_URL, WIDGET_SCRIPT_URL, chatbotId, name])

  const handleCopyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedSnippet)
      setCopySuccess('Copied!')
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      setCopySuccess('Copy failed. Try again.')
      setTimeout(() => setCopySuccess(null), 3000)
    }
  }

  useEffect(() => {
    if (chatbotId && typeof chatbotId === 'string') {
      loadChatbot()
      loadDocumentStatuses()
    }
  }, [chatbotId])

  const loadDocumentStatuses = async () => {
    if (!chatbotId || !API_URL) return
    
    setLoadingStatuses(true)
    try {
      const url = `${API_URL}/api/chatbot/${chatbotId}/documents`
      const response = await fetch(url)
      
      if (response.ok) {
        const data = await response.json()
        setDocumentStatuses(data.documents || [])
      } else {
        console.error('Failed to load document statuses:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('Error loading document statuses:', err)
      // Don't show error to user, just log it
    } finally {
      setLoadingStatuses(false)
    }
  }

  const handleIngestDocuments = async () => {
    if (!chatbotId) {
      setError('Chatbot ID is missing')
      return
    }

    setIngesting(true)
    setError(null)

    try {
      // Start polling for status updates
      const statusInterval = setInterval(() => {
        if (chatbotId) {
          loadDocumentStatuses()
        }
      }, 20000) // Poll every 20 seconds

      const response = await fetch(`${API_URL}/api/ingest/${chatbotId}`, {
        method: 'POST',
      })

      // Clear interval once request completes
      clearInterval(statusInterval)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to start ingestion' }))
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      // Final status refresh
      await loadDocumentStatuses()
      setIngesting(false)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start document ingestion')
      setIngesting(false)
    }
  }

  const loadChatbot = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/components/login')
        return
      }

      // Load chatbot details
      const { data: chatbot, error: chatbotError } = await supabase
        .from('chatbots')
        .select('*')
        .eq('id', chatbotId)
        .eq('user_id', user.id)
        .single()

      if (chatbotError || !chatbot) {
        setError('Chatbot not found')
        return
      }

      setName(chatbot.name)
      setPurpose(chatbot.purpose || '')

      // Load files
      await loadFiles(user.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chatbot')
    } finally {
      setLoading(false)
    }
  }

  const loadFiles = async (userId: string) => {
    try {
      const { data: fileList, error } = await supabase.storage
        .from('chat-documents')
        .list(`${userId}/${chatbotId}`, {
          limit: 1000,
          offset: 0,
        })

      if (error) {
        console.error('Error loading files:', error)
        return
      }

      if (fileList) {
        setFiles(fileList.map(file => ({
          name: file.name,
          id: file.id || file.name,
          created_at: file.created_at || '',
          metadata: {
            size: file.metadata?.size || 0,
            mimetype: file.metadata?.mimetype || '',
          },
        })))
      }
    } catch (err) {
      console.error('Error loading files:', err)
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

    setUploadingFiles(prev => [...prev, ...droppedFiles])
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

    setUploadingFiles(prev => [...prev, ...selectedFiles])
  }, [])

  const uploadFiles = async () => {
    if (uploadingFiles.length === 0) return

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setUploading(false)
      return
    }

    const uploaded: string[] = []
    const failed: string[] = []

    for (const file of uploadingFiles) {
      try {
        const filePath = `${user.id}/${chatbotId}/${Date.now()}_${file.name}`

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
              chatbot_id: chatbotId,
              user_id: user.id,
              filename: file.name,
              file_path: filePath,
              file_size: file.size,
              mime_type: file.type,
              status: 'pending'
            })

          if (metadataError) {
            console.error('Failed to create document metadata:', metadataError)
            failed.push(file.name)
          } else {
            uploaded.push(file.name)
          }
        }
      } catch (err) {
        failed.push(file.name)
      }
    }

    setUploadingFiles([])
    await loadFiles(user.id)
    setUploading(false)

    if (failed.length > 0) {
      setError(`Failed to upload: ${failed.join(', ')}`)
    } else {
      // Redirect to dashboard after successful upload
      router.push('/components/dashboard')
      router.refresh()
    }
  }

  const deleteFile = async (fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // Delete file from storage
      const filePath = `${user.id}/${chatbotId}/${fileName}`
      const { error } = await supabase.storage
        .from('chat-documents')
        .remove([filePath])

      if (error) {
        setError(`Failed to delete file: ${error.message}`)
      } else {
        // Delete document_metadata record
        await supabase
          .from('document_metadata')
          .delete()
          .eq('chatbot_id', chatbotId)
          .eq('file_path', filePath)

        await loadFiles(user.id)
      }
    } catch (err) {
      setError('Failed to delete file')
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase
        .from('chatbots')
        .update({
          name: name.trim(),
          purpose: purpose.trim() || null,
        })
        .eq('id', chatbotId)

      if (error) {
        throw new Error(error.message)
      }

      // Redirect to dashboard after successful save
      router.push('/components/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update chatbot')
    } finally {
      setSaving(false)
    }
  }


  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Step 1: Delete all files from storage
      // Get all files in the directory (including files with timestamp prefixes)
      const { data: fileList, error: listError } = await supabase.storage
        .from('chat-documents')
        .list(`${user.id}/${chatbotId}`, {
          limit: 1000,
          offset: 0,
        })

      if (listError) {
        console.error('Error listing files:', listError)
      } else if (fileList && fileList.length > 0) {
        // Build full paths for all files
        const filePaths = fileList.map(file => `${user.id}/${chatbotId}/${file.name}`)
        
        // Delete all files from storage
        const { error: removeError } = await supabase.storage
          .from('chat-documents')
          .remove(filePaths)
        
        if (removeError) {
          console.error('Error deleting files from storage:', removeError)
          // Continue with deletion even if file removal fails
        }
      }

      // Step 2: Delete all document_metadata records for this chatbot
      // (These should cascade, but let's be explicit)
      const { error: metadataError } = await supabase
        .from('document_metadata')
        .delete()
        .eq('chatbot_id', chatbotId)

      if (metadataError) {
        console.error('Error deleting document metadata:', metadataError)
        // Continue with chatbot deletion
      }

      // Step 3: Delete the chatbot record
      // This should cascade to document_metadata if ON DELETE CASCADE is set
      const { error: chatbotError } = await supabase
        .from('chatbots')
        .delete()
        .eq('id', chatbotId)

      if (chatbotError) {
        throw new Error(chatbotError.message)
      }

      // Step 4: Note - Zilliz collection deletion would need to be done via backend API
      // For now, we'll leave it (can be cleaned up later or via a backend endpoint)

      router.push('/components/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chatbot')
      setDeleting(false)
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
          <p className="text-gray-600">Loading chatbot...</p>
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
            Edit Chatbot
          </h1>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg shadow-sm mb-6">
            <p className="font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          {/* Chatbot Details */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Chatbot Details</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Chatbot Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900 placeholder-gray-400"
                  placeholder="e.g., Customer Support Bot"
                />
              </div>

              <div>
                <label htmlFor="purpose" className="block text-sm font-semibold text-gray-700 mb-2">
                  Purpose (Optional)
                </label>
                <textarea
                  id="purpose"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-gray-900 placeholder-gray-400 resize-none"
                  placeholder="Describe what this chatbot will do..."
                />
              </div>
            </div>
          </div>

          {/* File Management */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Documents</h2>

            {/* Upload Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all mb-6 ${
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

            {/* Files to Upload */}
            {uploadingFiles.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-2">New Files to Upload ({uploadingFiles.length})</h3>
                <div className="space-y-2 mb-4">
                  {uploadingFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-sm text-gray-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setUploadingFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={uploadFiles}
                  disabled={uploading}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold py-2 px-6 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Uploading...' : 'Upload Files Now'}
                </button>
              </div>
            )}

            {/* Existing Files */}
            {files.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">Current Files ({files.length})</h3>
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.metadata.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteFile(file.name)}
                        className="ml-4 text-red-500 hover:text-red-700"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length === 0 && uploadingFiles.length === 0 && (
              <p className="text-gray-500 text-center py-8">No documents uploaded yet</p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-4">
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
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {saving ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>

            {/* Document Status Display */}
            {documentStatuses.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">Document Processing Status</h3>
                  <button
                    type="button"
                    onClick={loadDocumentStatuses}
                    disabled={loadingStatuses}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {loadingStatuses ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="space-y-2">
                  {documentStatuses.map((doc) => {
                    const status = doc.status || 'unknown'
                    const statusColors = {
                      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                      processing: 'bg-blue-100 text-blue-800 border-blue-300',
                      completed: 'bg-green-100 text-green-800 border-green-300',
                      failed: 'bg-red-100 text-red-800 border-red-300',
                    }
                    return (
                      <div
                        key={doc.id}
                        className={`p-3 rounded-lg border ${statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800 border-gray-300'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium">{doc.filename}</p>
                            <p className="text-xs mt-1">
                              Status: <span className="font-semibold capitalize">{status}</span>
                              {doc.chunk_count > 0 && ` • ${doc.chunk_count} chunks`}
                            </p>
                            {doc.error_message && (
                              <p className="text-xs mt-1 text-red-700 font-mono break-all">
                                Error: {doc.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Widget Embed Snippet */}
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Embed Chat Widget</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Paste this snippet into any webpage to load the chatbot widget for <span className="font-semibold text-gray-800">{name || 'this chatbot'}</span>.
                    Update labels or colors as needed before sharing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmbed}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="w-4 h-4"
                  >
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 01-2-2V4c0-1.1.9-2 2-2h9a2 2 0 012 2v1"></path>
                  </svg>
                  Copy
                </button>
              </div>

              <div className="relative mt-4">
                <textarea
                  readOnly
                  value={embedSnippet}
                  rows={embedSnippet.split('\n').length + 2}
                  className="w-full font-mono text-sm bg-slate-900 text-slate-100 rounded-xl p-4 border border-slate-800 shadow-inner resize-none"
                />
                {copySuccess && (
                  <span className="absolute bottom-3 right-4 text-xs font-medium text-emerald-400">
                    {copySuccess}
                  </span>
                )}
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold">Heads up:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>
                    The script loads from <span className="font-mono text-xs bg-blue-100 px-2 py-0.5 rounded">{WIDGET_SCRIPT_URL}</span>.
                  </li>
                  <li>
                    You can customize the chatbot's appearance (launcher, welcome message, color, theme & height).
                  </li>
                </ul>
              </div>
            </div>

            {/* (Chat preview removed to keep this page focused on configuration) */}

            {/* Ingest Documents Button */}
            {files.length > 0 && (
              <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h3 className="text-lg font-bold text-blue-800 mb-2">Process Documents</h3>
                <p className="text-sm text-blue-700 mb-4">
                  Extract text from uploaded documents, chunk them, and store in the vector database for RAG.
                </p>
                <button
                  type="button"
                  onClick={handleIngestDocuments}
                  disabled={ingesting || saving}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {ingesting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Ingest Documents'
                  )}
                </button>
              </div>
            )}

          </div>

          {/* Delete Button */}
          <div className="border-t border-gray-200 pt-6">
            <div className="bg-red-50 rounded-xl p-6 border border-red-200">
              <h3 className="text-lg font-bold text-red-800 mb-2">Danger Zone</h3>
              <p className="text-sm text-red-700 mb-4">
                Once you delete a chatbot, there is no going back. Please be certain.
              </p>
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-red-700 transition-all"
                >
                  Delete Chatbot
                </button>
              ) : (
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="bg-red-600 text-white font-semibold py-2 px-6 rounded-xl hover:bg-red-700 transition-all disabled:opacity-50"
                  >
                    {deleting ? 'Deleting...' : 'Yes, Delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-gray-200 text-gray-700 font-semibold py-2 px-6 rounded-xl hover:bg-gray-300 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

