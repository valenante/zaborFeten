import React, { useState } from "react";
import api from "../utils/api";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import * as logger from "../utils/logger";
import "../styles/Usuarios.css";

const ESTACIONES = [
  { value: "frito", label: "Frito" },
  { value: "plancha", label: "Plancha" },
  { value: "frio", label: "Frío" },
];

const CrearUsuario = () => {
  const [formData, setFormData] = useState({
    name: "",
    password: "",
    confirmPassword: "",
    role: "",
    estacion: "", // 👈 nuevo
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState(null);

  const validateField = (name, value, ctx = formData) => {
    let error = "";
    switch (name) {
      case "name":
        if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(value || "")) {
          error = "El nombre solo puede contener letras y espacios.";
        }
        break;
      case "password":
        if (!value || value.length < 8 || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
          error = "La contraseña debe tener al menos 8 caracteres, una letra y un número.";
        }
        break;
      case "confirmPassword":
        if (value !== ctx.password) {
          error = "Las contraseñas no coinciden.";
        }
        break;
      case "role":
        if (!["admin", "cocinero", "camarero"].includes(value)) {
          error = "El role seleccionado no es válido.";
        }
        break;
      case "estacion":
        if (ctx.role === "cocinero" && !value) {
          error = "Selecciona una estación para el cocinero.";
        }
        break;
      default:
        break;
    }
    return error;
  };

  const validateAll = () => {
    const nextErrors = {};
    Object.keys(formData).forEach((k) => {
      const e = validateField(k, formData[k], formData);
      if (e) nextErrors[k] = e;
    });
    // si no es cocinero, limpiamos error de estación si quedó
    if (formData.role !== "cocinero") delete nextErrors.estacion;
    return nextErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    setFormData(next);
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value, next) }));

    // Si cambia el rol a algo que no es cocinero, limpia estación y su error
    if (name === "role" && value !== "cocinero") {
      setFormData((p) => ({ ...p, estacion: "" }));
      setErrors((p) => {
        const { estacion, ...rest } = p;
        return rest;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validateAll();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        name: formData.name,
        password: formData.password,
        role: formData.role,
        ...(formData.role === "cocinero" ? { estacion: formData.estacion } : {}),
      };

      await api.post("/auth/register", payload);
      setMensajeAlerta({ tipo: "exito", mensaje: "Usuario creado exitosamente" });
      setFormData({ name: "", password: "", confirmPassword: "", role: "", estacion: "" });
      setErrors({});
    } catch (error) {
      logger.error("Error al crear el usuario:", error);
      setMensajeAlerta({ tipo: "error", mensaje: error?.response?.data?.error || "Error al crear el usuario" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="crear-usuario--register">
      <h2 className="titulo--register">Crear Usuario</h2>

      <form onSubmit={handleSubmit} className="formulario--register">
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className="input--register"
          placeholder="Nombre"
          autoComplete="off"
        />
        {errors.name && <p className="error--register">{errors.name}</p>}

        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          className="input--register"
          placeholder="Contraseña"
          autoComplete="new-password"
        />
        {errors.password && <p className="error--register">{errors.password}</p>}

        <input
          type="password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={handleChange}
          className="input--register"
          placeholder="Confirmar Contraseña"
          autoComplete="new-password"
        />
        {errors.confirmPassword && <p className="error--register">{errors.confirmPassword}</p>}

        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className="select--register"
        >
          <option value="">Selecciona un rol</option>
          <option value="admin">Admin</option>
          <option value="cocinero">Cocinero</option>
          <option value="camarero">Camarero</option>
        </select>
        {errors.role && <p className="error--register">{errors.role}</p>}

        {/* 👇 Solo cuando es cocinero pedimos estación */}
        {formData.role === "cocinero" && (
          <>
            <select
              name="estacion"
              value={formData.estacion}
              onChange={handleChange}
              className="select--register"
            >
              <option value="">Selecciona estación</option>
              {ESTACIONES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.estacion && <p className="error--register">{errors.estacion}</p>}
          </>
        )}

        <button type="submit" className="boton--register" disabled={isLoading}>
          {isLoading ? "Creando..." : "Crear Usuario"}
        </button>
      </form>

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

export default CrearUsuario;
