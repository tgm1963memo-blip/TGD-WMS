import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient.js';

const HandheldContext = createContext(null);

export function HandheldProvider({ children }) {
  const [activeProfile, setActiveProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('tgd_handheld_profile');
    if (stored) {
      try {
        setActiveProfile(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse stored handheld profile', e);
      }
    }
    setIsLoading(false);
  }, []);

  const listHandheldStaff = async () => {
    if (!supabase) throw new Error('Supabase client not configured');
    const { data, error } = await supabase.rpc('tgd_handheld_list_staff');
    if (error) throw new Error(error.message);
    return Array.isArray(data) ? data : [];
  };

  const loginWithPin = async (profileId, pinCode) => {
    if (!supabase) throw new Error('Supabase client not configured');

    const { data, error } = await supabase.rpc('tgd_handheld_verify_pin_for_user', {
      p_profile_id: profileId,
      p_pin_code: pinCode,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || 'รหัส PIN ไม่ถูกต้อง');

    const profile = data.profile;
    setActiveProfile(profile);
    localStorage.setItem('tgd_handheld_profile', JSON.stringify(profile));
    return profile;
  };

  const logout = () => {
    setActiveProfile(null);
    localStorage.removeItem('tgd_handheld_profile');
  };

  return (
    <HandheldContext.Provider value={{ activeProfile, isLoading, listHandheldStaff, loginWithPin, logout }}>
      {children}
    </HandheldContext.Provider>
  );
}

export function useHandheldAuth() {
  const context = useContext(HandheldContext);
  if (!context) throw new Error('useHandheldAuth must be used within HandheldProvider');
  return context;
}
