import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle } from 'lucide-react'

const DUNGEON_NAMES: { [key: number]: string } = {
  370: "Operation: Mechagon - Workshop",
  382: "Theater of Pain", 
  499: "Priory of the Sacred Flame",
  500: "The Rookery",
  504: "Darkflame Cleft",
  506: "Cinderbrew Meadery",
  525: "Operation: Floodgate",
  247: "The MOTHERLODE!!",
  // Add more dungeons as needed
}

interface ParsedKey {
  character_name: string
  key_level: number
  dungeon_id: number
  dungeon_name: string
}

export function Upload() {
  const { user } = useAuth()
  const [dragActive, setDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; keys?: ParsedKey[] } | null>(null)

  const parseLuaFile = (content: string): ParsedKey[] => {
    const keys: ParsedKey[] = []
    
    try {
      // Look for AstralKeys table data
      const astralKeysMatch = content.match(/AstralKeys\s*=\s*{([\s\S]*?)}/m)
      if (!astralKeysMatch) {
        throw new Error('AstralKeys table not found in file')
      }

      // Extract individual key entries
      const keyPattern = /{[^}]*"unit"\s*=\s*"([^"]+)"[^}]*"key_level"\s*=\s*(\d+)[^}]*"dungeon_id"\s*=\s*(\d+)[^}]*}/g
      let match

      while ((match = keyPattern.exec(content)) !== null) {
        const character_name = match[1]
        const key_level = parseInt(match[2])
        const dungeon_id = parseInt(match[3])
        const dungeon_name = DUNGEON_NAMES[dungeon_id] || `Unknown Dungeon (${dungeon_id})`

        keys.push({
          character_name,
          key_level,
          dungeon_id,
          dungeon_name
        })
      }

      return keys
    } catch (error) {
      console.error('Error parsing Lua file:', error)
      throw new Error('Failed to parse Lua file. Make sure it\'s a valid AstralKeys.lua file.')
    }
  }

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.lua')) {
      setResult({ success: false, message: 'Please upload a .lua file' })
      return
    }

    setUploading(true)
    setResult(null)

    try {
      const content = await file.text()
      const parsedKeys = parseLuaFile(content)

      if (parsedKeys.length === 0) {
        setResult({ success: false, message: 'No keys found in the file' })
        return
      }

      // Delete existing keys for this user
      await supabase
        .from('mythic_keys')
        .delete()
        .eq('user_id', user!.id)

      // Insert new keys
      const keysToInsert = parsedKeys.map(key => ({
        user_id: user!.id,
        character_name: key.character_name,
        key_level: key.key_level,
        dungeon_id: key.dungeon_id,
        dungeon_name: key.dungeon_name,
        last_updated: new Date().toISOString()
      }))

      const { error } = await supabase
        .from('mythic_keys')
        .insert(keysToInsert)

      if (error) throw error

      setResult({ 
        success: true, 
        message: `Successfully uploaded ${parsedKeys.length} keys!`,
        keys: parsedKeys
      })
    } catch (error: any) {
      setResult({ success: false, message: error.message })
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Upload Your Keys</h1>
        <p className="text-gray-400">
          Upload your AstralKeys.lua file to update your available keystones
        </p>
      </div>

      <div className="card p-8">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive
              ? 'border-wow-blue bg-blue-900/20'
              : 'border-gray-600 hover:border-gray-500'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <UploadIcon className="mx-auto h-16 w-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            Drop your AstralKeys.lua file here
          </h3>
          <p className="text-gray-400 mb-4">or click to browse</p>
          <input
            type="file"
            accept=".lua"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
            disabled={uploading}
          />
          <label
            htmlFor="file-upload"
            className="btn-primary cursor-pointer inline-block disabled:opacity-50"
          >
            {uploading ? 'Uploading...' : 'Choose File'}
          </label>
        </div>

        {result && (
          <div className={`mt-6 p-4 rounded-lg flex items-start space-x-3 ${
            result.success 
              ? 'bg-green-900/50 border border-green-500' 
              : 'bg-red-900/50 border border-red-500'
          }`}>
            {result.success ? (
              <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <div>
              <p className={result.success ? 'text-green-200' : 'text-red-200'}>
                {result.message}
              </p>
              {result.keys && result.keys.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.keys.map((key, index) => (
                    <div key={index} className="text-sm text-green-300">
                      {key.character_name}: +{key.key_level} {key.dungeon_name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-medium text-white mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2" />
          How to find your AstralKeys.lua file
        </h3>
        <div className="space-y-3 text-gray-300">
          <p>1. Navigate to your World of Warcraft installation folder</p>
          <p>2. Go to: <code className="bg-gray-700 px-2 py-1 rounded text-sm">
            _retail_/WTF/Account/[YourAccount]/SavedVariables/
          </code></p>
          <p>3. Look for the file named <code className="bg-gray-700 px-2 py-1 rounded text-sm">
            AstralKeys.lua
          </code></p>
          <p className="text-sm text-gray-400 mt-4">
            Note: Make sure you have the AstralKeys addon installed and have logged in with your characters recently.
          </p>
        </div>
      </div>
    </div>
  )
}