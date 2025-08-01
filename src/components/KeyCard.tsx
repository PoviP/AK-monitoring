import React from 'react'
import { Shield, User, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface KeyCardProps {
  keyData: {
    id: string
    character_name: string
    key_level: number
    dungeon_name: string
    last_updated: string
    profiles?: {
      display_name: string
    }
  }
  isOwner: boolean
}

export function KeyCard({ keyData, isOwner }: KeyCardProps) {
  const getKeyLevelColor = (level: number) => {
    if (level >= 20) return 'text-wow-orange'
    if (level >= 15) return 'text-wow-purple'
    if (level >= 10) return 'text-wow-blue'
    if (level >= 5) return 'text-wow-green'
    return 'text-gray-400'
  }

  const getKeyLevelBg = (level: number) => {
    if (level >= 20) return 'bg-orange-900/30 border-orange-500/50'
    if (level >= 15) return 'bg-purple-900/30 border-purple-500/50'
    if (level >= 10) return 'bg-blue-900/30 border-blue-500/50'
    if (level >= 5) return 'bg-green-900/30 border-green-500/50'
    return 'bg-gray-800 border-gray-600'
  }

  return (
    <div className={`card p-4 border ${getKeyLevelBg(keyData.key_level)}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <Shield className={`h-5 w-5 ${getKeyLevelColor(keyData.key_level)}`} />
          <span className={`text-2xl font-bold ${getKeyLevelColor(keyData.key_level)}`}>
            +{keyData.key_level}
          </span>
        </div>
        {isOwner && (
          <span className="bg-wow-gold text-gray-900 text-xs px-2 py-1 rounded-full font-medium">
            Mine
          </span>
        )}
      </div>

      <h3 className="text-white font-medium mb-2 line-clamp-2">
        {keyData.dungeon_name}
      </h3>

      <div className="space-y-2 text-sm text-gray-400">
        <div className="flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>{keyData.character_name}</span>
        </div>

        {keyData.profiles?.display_name && !isOwner && (
          <div className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>by {keyData.profiles.display_name}</span>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4" />
          <span>
            {formatDistanceToNow(new Date(keyData.last_updated), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  )
}