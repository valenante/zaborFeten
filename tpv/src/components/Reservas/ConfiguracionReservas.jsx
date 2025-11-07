import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import DatePicker from "react-datepicker";
import * as logger from '../../utils/logger';
import "react-datepicker/dist/react-datepicker.css";
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje"; // Componente para mostrar alertas
import "../../styles/ConfiguracionReservas.css";

const ConfiguracionReservas = () => {
  const [franjas, setFranjas] = useState([
    { horaInicio: "13:00", horaFin: "17:00", maxReservas: 10 },
    { horaInicio: "19:30", horaFin: "24:00", maxReservas: 15 },
  ]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [mensajeAlerta, setMensajeAlerta] = useState(null);


  const [diasHabilitados, setDiasHabilitados] = useState({
    domingo: true,
    lunes: true,
    martes: true,
    miércoles: true,
    jueves: true,
    viernes: true,
    sábado: true,
  });

  const diasSemana = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const fetchDatos = async () => {
      const fecha = fechaSeleccionada.toISOString().slice(0, 10);

      try {
        const resFranjas = await api.get(`/reservasConfiguracion?fecha=${fecha}`);
        if (resFranjas.data?.franjas) setFranjas(resFranjas.data.franjas);
        else setFranjas([]); // si no hay, deja vacío para personalizar

        const resDisp = await api.get("/disponibilidad");
        if (resDisp.data) {
          setDiasHabilitados(resDisp.data);
        }
      } catch (error) {
        logger.error("Error al obtener configuración:", error);
      }
    };

    fetchDatos();
  }, [fechaSeleccionada]);

  const toggleDia = (dia) => {
    setDiasHabilitados((prev) => ({
      ...prev,
      [dia]: !prev[dia],
    }));
  };

  const handleChange = (index, field, value) => {
    const actualizadas = [...franjas];
    actualizadas[index][field] = value;
    setFranjas(actualizadas);
  };

  const agregarFranja = () => {
    setFranjas([...franjas, { horaInicio: "", horaFin: "", maxReservas: 5 }]);
  };

  const eliminarFranja = (index) => {
    const actualizadas = franjas.filter((_, i) => i !== index);
    setFranjas(actualizadas);
  };

  const guardarConfiguracion = async () => {
    try {
      await api.post("/reservasConfiguracion", {
        fecha: fechaSeleccionada.toISOString().slice(0, 10),
        franjas,
      });

      await api.put("/disponibilidad", diasHabilitados);

      setMensajeAlerta({ tipo: "exito", mensaje: "Configuración y disponibilidad guardadas correctamente" });
    } catch (err) {
      logger.error("Error al guardar:", err);
      setMensajeAlerta({ tipo: "error", mensaje: "Error al guardar la configuración" });
    }
  };

  const generarHoras24 = () => {
    const horas = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        horas.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    return horas;
  };

  const horasDisponibles = generarHoras24();

  return (
    <div className="configuracion-reservas">
      <h2>Configuración de Reservas</h2>

      <h3>Selecciona el día a configurar</h3>

      <DatePicker
        selected={fechaSeleccionada}
        onChange={setFechaSeleccionada}
        dateFormat="yyyy-MM-dd"
        minDate={new Date()} // 👈 Esto bloquea días pasados
      />

      {franjas.map((franja, index) => (
        <div key={index} className="franja-config">
          <label>
            Inicio:
            <select
              value={franja.horaInicio}
              onChange={(e) => handleChange(index, "horaInicio", e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {horasDisponibles.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>

          <label>
            Fin:
            <select
              value={franja.horaFin}
              onChange={(e) => handleChange(index, "horaFin", e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {horasDisponibles.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </label>

          <label>
            Máx reservas:
            <input
              type="number"
              min="1"
              value={franja.maxReservas}
              onChange={(e) => handleChange(index, "maxReservas", e.target.value)}
            />
          </label>

          <button onClick={() => eliminarFranja(index)}>❌</button>
        </div>
      ))}

      <button onClick={agregarFranja}>➕ Añadir franja</button>

      <h3>Días habilitados</h3>
      <div className="dias-habilitados">
        {diasSemana.map((dia) => (
          <label key={dia}>
            <input
              type="checkbox"
              checked={!!diasHabilitados[dia]}
              onChange={() => toggleDia(dia)}
            />
            {dia.charAt(0).toUpperCase() + dia.slice(1)}
          </label>
        ))}
      </div>

      <h3>Fechas especiales</h3>
      <p>Permiten habilitar reservas en un día normalmente cerrado, o definir horarios únicos.</p>

      <div className="fechas-especiales">
        <DatePicker
          selected={fechaSeleccionada}
          onChange={setFechaSeleccionada}
          dateFormat="yyyy-MM-dd"
          minDate={new Date()}
        />
        <button
          onClick={async () => {
            try {
              await api.post("/reservas/fechasEspeciales", {
                fecha: fechaSeleccionada.toISOString().slice(0, 10),
                habilitado: true,
                franjas,
              });
              setMensajeAlerta({
                tipo: "exito",
                mensaje: `Fecha especial creada para ${fechaSeleccionada.toISOString().slice(0, 10)}`,
              });
            } catch (err) {
              logger.error("Error al guardar fecha especial:", err);
              setMensajeAlerta({
                tipo: "error",
                mensaje: "No se pudo guardar la fecha especial",
              });
            }
          }}
        >
          🌟 Guardar como fecha especial
        </button>
      </div>

      <button onClick={guardarConfiguracion}>💾 Guardar configuración</button>
      {mensajeAlerta && (
        <AlertaMensaje
          tipo={mensajeAlerta.tipo}
          mensaje={mensajeAlerta.mensaje}
          onClose={() => setMensajeAlerta(null)}
        />
      )}
    </div>
  );
};

export default ConfiguracionReservas;
