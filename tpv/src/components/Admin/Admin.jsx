import React, { useState } from 'react';
import api from '../../utils/api'; // ajustá la ruta según tu estructura
import './Admin.css';

const Admin = () => {
  const [archivo, setArchivo] = useState(null);
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!archivo || !password) return alert('Completa ambos campos');

    const formData = new FormData();
    formData.append('archivo', archivo);
    formData.append('password', password);

    try {
      const res = await api.post('/firma/subir-certificado', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setMensaje(res.data);
    } catch (error) {
      console.error(error);
      setMensaje('Error al subir el certificado');
    }
  };

  const handleDescargarDeclaracion = () => {
    // Descarga directa (fuera de axios porque es una descarga de archivo PDF)
    window.open(`${process.env.REACT_APP_API_URL}/firma/declaracion-responsable`, '_blank');
  };

  return (
    <div className="admin-container">
      <h2 className="admin-titulo">Firma Digital y Declaración Responsable</h2>

      <form onSubmit={handleUpload} className="admin-formulario">
        <div className="admin-campo">
          <label>Certificado .p12:</label><br />
          <input
            type="file"
            accept=".p12"
            onChange={(e) => setArchivo(e.target.files[0])}
            required
          />
        </div>

        <div className="admin-campo">
          <label>Contraseña:</label><br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" className="admin-boton-primario">
          Subir Certificado
        </button>
      </form>

      {mensaje && <p className="admin-mensaje">{mensaje}</p>}

      <hr className="admin-separador" />

      <div className="admin-boton-contenedor">
        <button onClick={handleDescargarDeclaracion} className="admin-boton-secundario">
          Descargar Declaración Responsable
        </button>
      </div>
    </div>
  );
};

export default Admin;
