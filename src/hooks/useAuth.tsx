
import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, testSupabaseConnection } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  supabaseConnected: boolean;
  isAdmin: boolean;
  pinVerified: boolean;
  hasPinSetup: boolean | null;
  setPinVerified: (verified: boolean) => void;
  checkPinStatus: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseConnected, setSupabaseConnected] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [hasPinSetup, setHasPinSetup] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Test connection quickly
        const { connected } = await testSupabaseConnection();
        if (mounted) {
          setSupabaseConnected(connected);
        }

        // Get initial session immediately
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (mounted && !error) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('Auth state change:', event, session?.user?.email);
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Handle profile creation and role check after successful sign up or sign in
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(async () => {
          try {
            // Create or update profile
            const { error } = await supabase
              .from('profiles')
              .upsert({
                user_id: session.user.id,
                username: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || '',
                updated_at: new Date().toISOString(),
              });

            if (error && error.code !== '23505') { // Ignore duplicate key errors
              console.error('Profile update error:', error);
            }

            // Check user role
            const { data: roleData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id)
              .single();

            if (roleData) {
              setIsAdmin(roleData.role === 'admin');
            }
          } catch (err) {
            console.error('Profile update failed:', err);
          }
        }, 0);
      }

      // Check PIN status on sign in
      if (event === 'SIGNED_IN' && session?.user) {
        setTimeout(() => {
          checkPinStatus();
        }, 100);
      }

      // Clear admin status and PIN verification on sign out
      if (event === 'SIGNED_OUT') {
        setIsAdmin(false);
        setPinVerified(false);
        setHasPinSetup(null);
      }
    });

    // Initialize auth
    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      // For development - disable email confirmation requirement
      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Account created!",
          description: "You can now sign in with your credentials.",
        });
      } else {
        toast({
          title: "Account created!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully.",
      });
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (error: any) {
      console.error('Sign out error:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkPinStatus = async () => {
    if (!user) {
      setHasPinSetup(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_pins_enhanced')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking PIN status:', error);
        setHasPinSetup(null);
        return;
      }

      setHasPinSetup(!!data);
    } catch (error) {
      console.error('Error checking PIN status:', error);
      setHasPinSetup(null);
    }
  };

  const value = {
    user,
    session,
    loading,
    supabaseConnected,
    isAdmin,
    pinVerified,
    hasPinSetup,
    setPinVerified,
    checkPinStatus,
    signUp,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
