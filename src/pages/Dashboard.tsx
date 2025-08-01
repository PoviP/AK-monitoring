import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { KeyCard } from '../components/KeyCard'
import { Shield, Users, TrendingUp, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface MythicKey {
  id: string
  character_name: string
  key_level: number
  dungeon_name: string
  dungeon_id: number
  last_updated: string
  user_id: string
  profiles?: {
    display_name: string
  }
}

export function Dashboard() {
  const { user } = useAuth()
  const [keys, setKeys] = useState<MythicKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchKeys()
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('mythic_keys_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'mythic_keys' },
        () => {
          fetchKeys()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchKeys = async () => {
    try {
      const { data, error } = await supabase
        .from('mythic_keys')
        .select(`
          *,
          profiles (
            display_name
          )
        `)
        .order('key_level', { ascending: false })

      if (error) throw error
      setKeys(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const myKeys = keys.filter(key => key.user_id === user?.id)
  const guildKeys = keys.filter(key => key.user_id !== user?.id)
  const totalKeys = keys.length
  const averageLevel = keys.length > 0 
    ? Math.round(keys.reduce((sum, key) => sum + key.key_level, 0) / keys.length)
    : 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-wow-blue"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded-lg">
        Error loading keys: {error}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Guild Mythic+ Keys</h1>
        <p className="text-gray-400">Track and share your guild's available keystones</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-wow-gold" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Total Keys</p>
              <p className="text-2xl font-bold text-white">{totalKeys}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-wow-green" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Average Level</p>
              <p className="text-2xl font-bold text-white">{averageLevel}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-wow-blue" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">My Keys</p>
              <p className="text-2xl font-bold text-white">{myKeys.length}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-wow-purple" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-400">Last Update</p>
              <p className="text-sm font-bold text-white">
                {keys.length > 0 
                  ? formatDistanceToNow(new Date(Math.max(...keys.map(k => new Date(k.last_updated).getTime()))), { addSuffix: true })
                  : 'Never'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* My Keys */}
      {myKeys.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">My Keys</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myKeys.map((key) => (
              <KeyCard key={key.id} keyData={key} isOwner={true} />
            ))}
          </div>
        </div>
      )}

      {/* Guild Keys */}
      {guildKeys.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-white mb-4">Guild Keys</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {guildKeys.map((key) => (
              <KeyCard key={key.id} keyData={key} isOwner={false} />
            ))}
          </div>
        </div>
      )}

      {keys.length === 0 && (
        <div className="text-center py-12">
          <Shield className="mx-auto h-16 w-16 text-gray-600 mb-4" />
          <h3 className="text-xl font-medium text-gray-400 mb-2">No keys found</h3>
          <p className="text-gray-500">Upload your AstralKeys.lua file to get started!</p>
        </div>
      )}
    </div>
  )
}