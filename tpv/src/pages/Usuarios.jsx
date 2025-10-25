import React, { useState, useEffect } from "react";
import api from "../utils/api";
import AlertaMensaje from "../components/AlertaMensaje/AlertaMensaje";
import ModalConfirmacion from "../components/Modal/ModalConfirmacion";
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
    estacion: "",
  });
  const [usuarios, setUsuarios] = useState([]);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState(null);
  const [mostrarModalConfirmacion, setMostrarModalConfirmacion] = useState(false);
  const [accionModal, setAccionModal] = useState(null);

  // ✏️ Modal de edición
  const [usuarioEditando, setUsuarioEditando] = useState(null);
  const [mostrarModalEditar, setMostrarModalEditar] = useState(false);
  const [passwordEdit, setPasswordEdit] = useState({ nueva: "", confirmar: "" });
  const [errorPasswordEdit, setErrorPasswordEdit] = useState("");

  // === VALIDACIONES ===
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
          error = "Debe tener al menos 8 caracteres, una letra y un número.";
        }
        break;
      case "confirmPassword":
        if (value !== ctx.password) {
          error = "Las contraseñas no coinciden.";
        }
        break;
      case "role":
        if (!["admin", "cocinero", "camarero"].includes(value)) {
          error = "El rol seleccionado no es válido.";
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
    if (formData.role !== "cocinero") delete nextErrors.estacion;
    return nextErrors;
  };

  // === CREAR USUARIO ===
  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    setFormData(next);
    setErrors((prev) => ({ ...prev, [name]: validateField(name, value, next) }));

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
      cargarUsuarios();
    } catch (error) {
      logger.error("Error al crear el usuario:", error);
      setMensajeAlerta({
        tipo: "error",
        mensaje: error?.response?.data?.error || "Error al crear el usuario",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // === OBTENER USUARIOS ===
  const cargarUsuarios = async () => {
    try {
      const { data } = await api.get("/auth/usuarios");
      setUsuarios(data);
    } catch (error) {
      logger.error("Error al obtener usuarios:", error);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // === ELIMINAR USUARIO ===
  const eliminarUsuario = async (id) => {
    try {
      await api.delete(`/auth/usuarios/${id}`);
      setUsuarios((prev) => prev.filter((u) => u._id !== id));
      setMensajeAlerta({ tipo: "exito", mensaje: "Usuario eliminado correctamente." });
    } catch (error) {
      logger.error("Error al eliminar usuario:", error);
      setMensajeAlerta({ tipo: "error", mensaje: "Error al eliminar el usuario." });
    }
  };

  // === EDITAR USUARIO ===
  const abrirModalEditar = (usuario) => {
    setUsuarioEditando(usuario);
    setPasswordEdit({ nueva: "", confirmar: "" });
    setErrorPasswordEdit("");
    setMostrarModalEditar(true);
  };

  const handleEditarChange = (e) => {
    const { name, value } = e.target;
    setUsuarioEditando((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "role" && value !== "cocinero" ? { estacion: "" } : {}),
    }));
  };

  const guardarCambiosUsuario = async () => {
    if (passwordEdit.nueva || passwordEdit.confirmar) {
      if (passwordEdit.nueva.length < 8 || !/[0-9]/.test(passwordEdit.nueva) || !/[A-Za-z]/.test(passwordEdit.nueva)) {
        setErrorPasswordEdit("La contraseña debe tener al menos 8 caracteres, con letras y números.");
        return;
      }
      if (passwordEdit.nueva !== passwordEdit.confirmar) {
        setErrorPasswordEdit("Las contraseñas no coinciden.");
        return;
      }
    }

    try {
      const payload = {
        name: usuarioEditando.name,
        role: usuarioEditando.role,
        estacion: usuarioEditando.role === "cocinero" ? usuarioEditando.estacion : "",
        ...(passwordEdit.nueva ? { password: passwordEdit.nueva } : {}),
      };
      await api.put(`/auth/usuarios/${usuarioEditando._id}`, payload);
      setMensajeAlerta({ tipo: "exito", mensaje: "Usuario actualizado correctamente." });
      setMostrarModalEditar(false);
      cargarUsuarios();
    } catch (error) {
      logger.error("Error al editar usuario:", error);
      setMensajeAlerta({ tipo: "error", mensaje: "Error al actualizar usuario." });
    }
  };

  return (
    <div className="crear-usuario--register">
      <h2 className="titulo--register">Gestión de Usuarios</h2>

      {/* === FORMULARIO CREAR === */}
      <form onSubmit={handleSubmit} className="formulario--register">
        <input type="text" name="name" value={formData.name} onChange={handleChange} className="input--register" placeholder="Nombre" autoComplete="off" />
        {errors.name && <p className="error--register">{errors.name}</p>}

        <input type="password" name="password" value={formData.password} onChange={handleChange} className="input--register" placeholder="Contraseña" />
        {errors.password && <p className="error--register">{errors.password}</p>}

        <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="input--register" placeholder="Confirmar Contraseña" />
        {errors.confirmPassword && <p className="error--register">{errors.confirmPassword}</p>}

        <select name="role" value={formData.role} onChange={handleChange} className="select--register">
          <option value="">Selecciona un rol</option>
          <option value="admin">Admin</option>
          <option value="cocinero">Cocinero</option>
          <option value="camarero">Camarero</option>
        </select>
        {errors.role && <p className="error--register">{errors.role}</p>}

        {formData.role === "cocinero" && (
          <>
            <select name="estacion" value={formData.estacion} onChange={handleChange} className="select--register">
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

      {/* === TABLA DE USUARIOS === */}
      <h3 className="titulo--register" style={{ marginTop: "2rem" }}>Usuarios Existentes</h3>
      <table className="tabla-usuarios">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Estación</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <tr key={u._id}>
              <td>{u.name}</td>
              <td>{u.role}</td>
              <td>{u.estacion || "-"}</td>
              <td>
                <button className="boton-editar" onClick={() => abrirModalEditar(u)}>✏️</button>
                <button
                  className="boton-eliminar"
                  onClick={() => {
                    setAccionModal({
                      titulo: "Eliminar usuario",
                      mensaje: `¿Seguro que deseas eliminar a ${u.name}?`,
                      onConfirm: () => eliminarUsuario(u._id),
                    });
                    setMostrarModalConfirmacion(true);
                  }}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* === MODALES Y ALERTAS === */}
      {mensajeAlerta && (
        <AlertaMensaje tipo={mensajeAlerta.tipo} mensaje={mensajeAlerta.mensaje} onClose={() => setMensajeAlerta(null)} />
      )}

      {mostrarModalConfirmacion && (
        <ModalConfirmacion
          titulo={accionModal?.titulo}
          mensaje={accionModal?.mensaje}
          onConfirm={() => {
            accionModal?.onConfirm();
            setMostrarModalConfirmacion(false);
          }}
          onClose={() => setMostrarModalConfirmacion(false)}
        />
      )}

      {/* === MODAL EDITAR === */}
      {mostrarModalEditar && usuarioEditando && (
        <div className="modal-overlay">
          <div className="modal-contenido">
            <h2>Editar Usuario</h2>

            <input
              type="text"
              name="name"
              value={usuarioEditando.name}
              onChange={handleEditarChange}
              className="input--register"
            />

            <select
              name="role"
              value={usuarioEditando.role}
              onChange={handleEditarChange}
              className="select--register"
            >
              <option value="">Selecciona un rol</option>
              <option value="admin">Admin</option>
              <option value="cocinero">Cocinero</option>
              <option value="camarero">Camarero</option>
            </select>

            {usuarioEditando.role === "cocinero" && (
              <select
                name="estacion"
                value={usuarioEditando.estacion || ""}
                onChange={handleEditarChange}
                className="select--register"
              >
                <option value="">Selecciona estación</option>
                {ESTACIONES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {/* 🔒 Contraseña actual (no visible) */}
            {/* 🔓 Contraseña actual visible (solo admin) */}
            <div className="info-password-actual">
              <label>Contraseña actual:</label>
              <input
                type="text"
                value={usuarioEditando.claveVisible || ""}
                readOnly
                className="input--register"
                style={{ backgroundColor: "var(--gris-claro)" }}
              />
            </div>

            <h4 style={{ marginTop: "1rem", color: "var(--color-principal)" }}>
              Cambiar contraseña (opcional)
            </h4>
            <input
              type="password"
              placeholder="Nueva contraseña"
              value={passwordEdit.nueva}
              onChange={(e) =>
                setPasswordEdit({ ...passwordEdit, nueva: e.target.value })
              }
              className="input--register"
            />
            <input
              type="password"
              placeholder="Confirmar contraseña"
              value={passwordEdit.confirmar}
              onChange={(e) =>
                setPasswordEdit({ ...passwordEdit, confirmar: e.target.value })
              }
              className="input--register"
            />
            {errorPasswordEdit && (
              <p className="error--register">{errorPasswordEdit}</p>
            )}

            <div className="botones-modal">
              <button className="boton--register" onClick={guardarCambiosUsuario}>
                Guardar
              </button>
              <button
                className="boton--register"
                onClick={() => setMostrarModalEditar(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CrearUsuario;
