import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import renovarToken from '../../utils/RenovarToken';
import './RutaProtegida.css';

const RutaProtegida = ({ children, rolesPermitidos }) => {
  const { accessToken, setAccessToken, user, loading } = useAuth();

  useEffect(() => {
    if (!accessToken) {
      renovarToken(setAccessToken);
    }
  }, [accessToken, setAccessToken]);

  if (loading) {
    return <div className="protegida-cargando">Cargando...</div>;
  }

  if (!accessToken) {
    return <Navigate to="/login" />;
  }

  console.log("Ruta protegida renderizada", { accessToken, user });

  if (rolesPermitidos && user && !rolesPermitidos.includes(user.role)) {
    return (
      <div className="protegida-denegado">
        <div className="protegida-cartel">
          <h2>Acceso denegado</h2>
          <p>Permisos insuficientes para acceder a esta sección.</p>
        </div>
      </div>
    );
  }

  return children;
};

export default RutaProtegida;
