import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function useAuth() {
  return useContext(AuthContext)
}

// Whitelist permission names — must match admin_permissions columns
const PERMISSION_NAMES = [
  'can_view_dashboard',
  'can_manage_projects',
  'can_manage_categories',
  'can_manage_articles',
  'can_manage_slides',
  'can_manage_requests',
  'can_manage_users',
  'can_manage_settings',
  'can_manage_popup_banners',
]

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [permissions, setPermissions] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setPermissions(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setProfile(data)

      // Fetch permissions if role is admin
      if (data?.role === 'admin') {
        const { data: perms } = await supabase
          .from('admin_permissions')
          .select('*')
          .eq('user_id', userId)
          .single()
        setPermissions(perms || null)
      } else {
        setPermissions(null)
      }
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfile(null)
      setPermissions(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
    setProfile(null)
    setPermissions(null)
  }

  // Role checks
  const isArchitect = profile?.role === 'architect'
  const isAdmin = profile?.role === 'admin'
  const isAdminOrAbove = isArchitect || isAdmin

  // Permission check — architect always has all permissions
  const hasPermission = useCallback((permName) => {
    if (!PERMISSION_NAMES.includes(permName)) return false
    if (isArchitect) return true
    if (!isAdmin || !permissions) return false
    return permissions[permName] === true
  }, [isArchitect, isAdmin, permissions])

  const value = {
    user,
    profile,
    permissions,
    loading,
    isArchitect,
    isAdmin,
    isAdminOrAbove,
    hasPermission,
    signIn,
    signOut,
    refreshProfile: () => user && fetchProfile(user.id),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
