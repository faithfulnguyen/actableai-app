import React, { useEffect, useState } from 'react'
import { AuthContext } from 'src/hooks/context';
import AuthModal from '../Modal/AuthModal';

interface IAuthProviderProps {
  children: React.ReactNode;
}

function AuthProvider({ children }: IAuthProviderProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [user, setUser] = useState<{ username: string }>();

  useEffect(() => {
    const current_user = document
      ?.getElementById('data-current_user')
      ?.getAttribute('data-current_user');
    ;
    if (current_user) {
      setUser({ username: current_user })
    } else {
      (window as any).login = () => setIsAuthModalOpen(true)
    };
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        setIsAuthModalOpen
      }}
    >
      {children}
      <AuthModal
        isOpen={isAuthModalOpen}
        onRequestClose={() => setIsAuthModalOpen(false)}
      />
    </AuthContext.Provider>
  )
}

export default AuthProvider