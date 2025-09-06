import React, { useState, useEffect } from 'react';
import api from '../../utils/api'; // ajustá la ruta según tu estructura
import './Admin.css';

const Admin = () => {
  const [archivo, setArchivo] = useState(null);
  const [password, setPassword] = useState('');
  const [mensaje, setMensaje] = useState('');

  // === NUEVO: estado VeriFactu
  const [verifactuEnabled, setVerifactuEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // Obtener estado inicial de VeriFactu
  const fetchVerifactu = async () => {
    try {
      const res = await api.get('/admin/verifactu');
      setVerifactuEnabled(!!res.data.enabled);
    } catch (e) {
      console.error("Error obteniendo estado VeriFactu:", e);
    }
  };

  useEffect(() => {
    fetchVerifactu();
  }, []);

  // Toggle VeriFactu
  const toggleVerifactu = async () => {
    setLoading(true);
    try {
      const next = !verifactuEnabled;
      const res = await api.post('/admin/verifactu/toggle', { enabled: next });
      setVerifactuEnabled(!!res.data.enabled);
    } catch (e) {
      console.error("Error al cambiar VeriFactu:", e);
    } finally {
      setLoading(false);
    }
  };

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

      <hr className="admin-separador" />

      {/* === NUEVO: Botón VeriFactu === */}
      <div className="admin-boton-contenedor">
        <p>
          Estado VeriFactu:{" "}
          <b style={{ color: verifactuEnabled ? "green" : "tomato" }}>
            {verifactuEnabled ? "ACTIVADO" : "DESACTIVADO"}
          </b>
        </p>
        <button
          onClick={toggleVerifactu}
          disabled={loading}
          className={`admin-boton-${verifactuEnabled ? "secundario" : "primario"}`}
        >
          {verifactuEnabled ? "Desactivar VeriFactu" : "Activar VeriFactu"}
        </button>
      </div>
    </div>
  );
};

export default Admin;
