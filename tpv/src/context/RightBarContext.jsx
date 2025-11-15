import { createContext, useContext } from "react";
import { useRightBar } from "../hooks/useRightBar";

const RightBarContext = createContext(null);

export const RightBarProvider = ({ mesaId, children }) => {
  const value = useRightBar(mesaId);
  return (
    <RightBarContext.Provider value={value}>
      {children}
    </RightBarContext.Provider>
  );
};

export const useRightBarContext = () => useContext(RightBarContext);
