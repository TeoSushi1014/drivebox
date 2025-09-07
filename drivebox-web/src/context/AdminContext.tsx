
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ADMIN_EMAIL } from '../../constants'; // Corrected path
import { GoogleUserProfile } from '../../types'; // Corrected path

interface AdminContextType {
  isAdmin: boolean;
  adminModeActive: boolean;
  toggleAdminMode: () => void;
  checkIsAdmin: (profile: GoogleUserProfile | null) => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

interface AdminProviderProps {
  children: ReactNode;
  userProfile: GoogleUserProfile | null; 
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children, userProfile }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminModeActive, setAdminModeActive] = useState(() => {
    return sessionStorage.getItem('adminModeActive') === 'true';
  });

  const checkIsAdmin = useCallback((profile: GoogleUserProfile | null) => {
    const isAdminUser = profile?.email === ADMIN_EMAIL;
    setIsAdmin(isAdminUser);
    if (!isAdminUser && adminModeActive) {
      setAdminModeActive(false);
      sessionStorage.removeItem('adminModeActive');
    }
  }, [adminModeActive]);

  useEffect(() => {
    checkIsAdmin(userProfile);
  }, [userProfile, checkIsAdmin]);

  const toggleAdminMode = () => {
    if (isAdmin) {
      setAdminModeActive(prevMode => {
        const newMode = !prevMode;
        sessionStorage.setItem('adminModeActive', String(newMode));
        return newMode;
      });
    }
  };

  return (
    <AdminContext.Provider value={{ isAdmin, adminModeActive, toggleAdminMode, checkIsAdmin }}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};
