import { createContext, useContext } from "react";

const noOp = () => {};

interface IAuthContext {
  user?: {
    username: string;
  },
  setIsAuthModalOpen: (nextValue: boolean) => void;
}

const AuthContext = createContext<IAuthContext>({
  setIsAuthModalOpen: noOp,
});

const useAuthContext = () => useContext(AuthContext);

export {
  AuthContext,
  useAuthContext
}