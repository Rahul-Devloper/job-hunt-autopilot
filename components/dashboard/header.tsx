'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, Plus } from 'lucide-react'

interface HeaderProps {
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  showSearch?: boolean
  onSearch?: (query: string) => void
}

export function Header({
  title,
  description,
  action,
  showSearch = false,
  onSearch,
}: HeaderProps) {
  return (
    <div className="border-b bg-white px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-4">
          {showSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search jobs..."
                className="w-64 pl-10"
                onChange={(e) => onSearch?.(e.target.value)}
              />
            </div>
          )}

          {action && (
            <Button onClick={action.onClick}>
              <Plus className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
