'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/dashboard/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Upload, Trash2, Star, Download, Loader2, AlertCircle } from 'lucide-react'

interface UserDocument {
  id: string
  document_type: 'cv' | 'cover_letter'
  file_name: string
  file_size: number
  is_master: boolean
  display_name: string | null
  created_at: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

interface DocumentSectionProps {
  title: string
  description: string
  uploadId: string
  documents: UserDocument[]
  type: 'cv' | 'cover_letter'
  uploading: boolean
  onUpload: (type: 'cv' | 'cover_letter', file: File) => Promise<void>
  onSetMaster: (id: string, type: 'cv' | 'cover_letter') => Promise<void>
  onDownload: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function DocumentSection({
  title,
  description,
  uploadId,
  documents,
  type,
  uploading,
  onUpload,
  onSetMaster,
  onDownload,
  onDelete,
}: DocumentSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
          <Label htmlFor={uploadId} className="cursor-pointer">
            <div className="flex flex-col items-center gap-2 text-center">
              {uploading ? (
                <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-gray-400" />
              )}
              <p className="text-sm font-medium">
                {uploading ? 'Uploading...' : `Upload ${title} (PDF only)`}
              </p>
              <p className="text-xs text-gray-500">Maximum file size: 5MB</p>
            </div>
          </Label>
          <Input
            id={uploadId}
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onUpload(type, file)
              e.target.value = ''
            }}
          />
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No {title.toLowerCase()}s uploaded yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-4 rounded-lg border ${
                  doc.is_master ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{doc.display_name || doc.file_name}</p>
                    {doc.is_master && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full shrink-0">
                        <Star className="h-3 w-3 fill-current" />
                        Master
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(doc.file_size)} · {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2 ml-4 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload(doc.id)}
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {!doc.is_master && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onSetMaster(doc.id, type)}
                    >
                      Set Master
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete(doc.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function DocumentsPage() {
  const [cvs, setCVs] = useState<UserDocument[]>([])
  const [coverLetters, setCoverLetters] = useState<UserDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingType, setUploadingType] = useState<'cv' | 'cover_letter' | null>(null)

  useEffect(() => {
    loadDocuments()
  }, [])

  async function loadDocuments() {
    try {
      const [cvResponse, clResponse] = await Promise.all([
        fetch('/api/documents?type=cv'),
        fetch('/api/documents?type=cover_letter'),
      ])

      const cvData = await cvResponse.json()
      const clData = await clResponse.json()

      if (cvData.success) setCVs(cvData.data || [])
      if (clData.success) setCoverLetters(clData.data || [])
    } catch (error) {
      console.error('Failed to load documents:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpload(type: 'cv' | 'cover_letter', file: File) {
    setUploadingType(type)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', type)

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        await loadDocuments()
      } else {
        alert(data.error?.message || 'Upload failed')
      }
    } catch {
      alert('Failed to upload document')
    } finally {
      setUploadingType(null)
    }
  }

  async function handleSetMaster(documentId: string, type: 'cv' | 'cover_letter') {
    try {
      const response = await fetch('/api/documents/set-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId, document_type: type }),
      })

      const data = await response.json()
      if (data.success) await loadDocuments()
    } catch (error) {
      console.error('Failed to set master:', error)
    }
  }

  async function handleDownload(documentId: string) {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`)
      const data = await response.json()
      if (data.success) window.open(data.data.url, '_blank')
    } catch (error) {
      console.error('Failed to download:', error)
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) await loadDocuments()
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <Header title="Documents" description="Manage your CV and cover letters" />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Header title="Documents" description="CV and cover letter management" />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-4xl space-y-6">
          <Alert className="bg-blue-50 border-blue-200">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-900">
              Your <strong>master CV</strong> and <strong>master cover letter</strong> will be
              automatically attached to all job application emails.
            </AlertDescription>
          </Alert>

          <DocumentSection
            title="CVs / Resumes"
            description="Upload different CV versions for different types of jobs"
            uploadId="cv-upload"
            documents={cvs}
            type="cv"
            uploading={uploadingType === 'cv'}
            onUpload={handleUpload}
            onSetMaster={handleSetMaster}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />

          <DocumentSection
            title="Cover Letters"
            description="Upload different cover letter versions"
            uploadId="cl-upload"
            documents={coverLetters}
            type="cover_letter"
            uploading={uploadingType === 'cover_letter'}
            onUpload={handleUpload}
            onSetMaster={handleSetMaster}
            onDownload={handleDownload}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </div>
  )
}
