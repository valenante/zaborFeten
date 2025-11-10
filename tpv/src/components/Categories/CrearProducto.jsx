import React, { useState, useContext } from 'react';
import { useEffect } from 'react';
import { ProductosContext } from '../../context/ProductosContext';
import { ImageContext } from '../../context/ImagesContext';
import * as logger from '../../utils/logger';
import api from '../../utils/api';
import './CrearProducto.css';

const CrearProducto = ({ onClose }) => {
  const { cargarProductos } = useContext(ProductosContext);
  const { dragging, handleDragOver, handleDragLeave, handleDrop, handleFileChange } = useContext(ImageContext);
  const [imageFile] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [usarOtraCategoria, setUsarOtraCategoria] = useState(false);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    categoria: "",
    tipo: "",
    stock: 0,
    seccion: "",
    img: "",
    estacion : "",
    aliases: [],
    estado: "habilitado",
    precios: { precioBase: 0, tapa: null, racion: null, precioCopa: null, precioBotella: null },
    ingredientes: [],
    alergenos: [],
    traducciones: {
      en: { nombre: "", descripcion: "" },
      fr: { nombre: "", descripcion: "" },
    },
  });

  useEffect(() => {
    const fetchCategorias = async () => {
      try {
        const response = await api.get("/productos");
        const productos = response.data;

        // Extraer y limpiar las categorías únicas
        const categoriasUnicas = [...new Set(productos
          .map((p) => p.categoria?.trim()?.toLowerCase())
          .filter((cat) => !!cat))];

        setCategorias(categoriasUnicas);
      } catch (error) {
        logger.error("Error al cargar categorías:", error);
      }
    };
    fetchCategorias();
  }, []);


  // Manejo de los cambios en los campos de formulario
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Manejar precios (que están dentro de un objeto)
    if (name.startsWith("precios.")) {
      const key = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        precios: { ...prev.precios, [key]: value },
      }));
    }
    // Manejo de traducciones (por idiomas)
    else if (name.startsWith("traducciones.")) {
      const [_, lang, key] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        traducciones: {
          ...prev.traducciones,
          [lang]: { ...prev.traducciones[lang], [key]: value },
        },
      }));
    }
    // Manejo de otros campos
    else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  // Función para manejar el envío del formulario
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Crear una copia de formData y limpiar los datos innecesarios según el tipo de producto
    const productData = { ...formData };

    if (productData.tipo === "plato") {
      delete productData.conHielo;
      delete productData.conLimon;
      delete productData.tamaño;
    } else if (productData.tipo === "bebida") {
      delete productData.ingredientes;
      delete productData.puntosDeCoccion;
    }

    try {
      const response = await api.post("/productos", productData, { withCredentials: true });
      if (response.status === 201) {
        cargarProductos(); // Recarga la lista de productos
        onClose(); // Cierra el modal
      }
    } catch (error) {
      logger.error("Error al crear el producto:", error.response?.data || error.message);
    }
  };

  return (
    <div className="crear-producto-modal--crear">
      <form onSubmit={handleSubmit} className="form--crear">
        <div className="form-group--crear">
          <label className="label--crear">
            Nombre:
            <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} className="input--crear" required />
          </label>

          <label className="label--crear">
            Descripción:
            <textarea name="descripcion" value={formData.descripcion} onChange={handleChange} className="textarea--crear" required />
          </label>

          {/* Traducción al inglés */}
          <label className="label--editar">
            Nombre en inglés:
            <input
              type="text"
              value={formData.traducciones?.en?.nombre || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  traducciones: {
                    ...prev.traducciones,
                    en: {
                      ...prev.traducciones?.en,
                      nombre: e.target.value,
                    },
                  },
                }))
              }
              className="input--editar"
              placeholder="Ej: Ham croquettes"
            />
          </label>

          <label className="label--editar">
            Descripción en inglés:
            <input
              type="text"
              value={formData.traducciones?.en?.descripcion || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  traducciones: {
                    ...prev.traducciones,
                    en: {
                      ...prev.traducciones?.en,
                      descripcion: e.target.value,
                    },
                  },
                }))
              }
              className="input--editar"
              placeholder="Ej: Delicious ham croquettes"
            />
          </label>

          {/* Traducción al francés */}
          <label className="label--editar">
            Nombre en francés:
            <input
              type="text"
              value={formData.traducciones?.fr?.nombre || ""}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  traducciones: {
                    ...prev.traducciones,
                    fr: {
                      ...prev.traducciones?.fr,
                      nombre: e.target.value,
                    },
                  },
                }))
              }
              className="input--editar"
              placeholder="Ej: Croquettes au jambon"
            />
          </label>

          <label className="label--editar">
            Descripción en francés:
            <input
              type="text"
              value={formData.traducciones?.fr?.descripcion || ""}
              onChange={(e) =>

                setFormData((prev) => ({
                  ...prev,
                  traducciones: {
                    ...prev.traducciones,
                    fr: {
                      ...prev.traducciones?.fr,
                      descripcion: e.target.value,
                    },
                  },
                }))
              }
              className="input--editar"
              placeholder="Ej: Délicieuses croquettes au jambon"
            />
          </label>

          <fieldset className="fieldset--crear">
            <legend className="legend--crear">Ingredientes</legend>
            {formData.ingredientes.map((ingrediente, index) => (
              <div key={index} className="form-group--crear">
                <input
                  type="text"
                  value={ingrediente}
                  onChange={(e) => {
                    const nuevosIngredientes = [...formData.ingredientes];
                    nuevosIngredientes[index] = e.target.value;
                    setFormData((prev) => ({ ...prev, ingredientes: nuevosIngredientes }));
                  }}
                  className="input--crear"
                />
                <button type="button" onClick={() => {
                  const nuevosIngredientes = formData.ingredientes.filter((_, i) => i !== index);
                  setFormData((prev) => ({ ...prev, ingredientes: nuevosIngredientes }));
                }}>❌</button>
              </div>
            ))}
            <button type="button" onClick={() => {
              setFormData((prev) => ({ ...prev, ingredientes: [...prev.ingredientes, ""] }));
            }}>➕ Agregar Ingrediente</button>
          </fieldset>

        </div>

        <div className="form-group--crear">
          <label className="label--crear">
            Categoría:
            {!usarOtraCategoria ? (
              <select
                name="categoria"
                value={formData.categoria}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "__otra__") {
                    setUsarOtraCategoria(true);
                    setFormData(prev => ({ ...prev, categoria: "" }));
                  } else {
                    setFormData(prev => ({ ...prev, categoria: value }));
                  }
                }}
                className="input--crear"
                required
              >
                <option value="">Seleccionar categoría</option>
                {categorias.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__otra__">Otra...</option>
              </select>
            ) : (
              <input
                type="text"
                name="categoria"
                placeholder="Escribe nueva categoría"
                value={formData.categoria}
                onChange={handleChange}
                className="input--crear"
                required
              />
            )}
          </label>
          <label className="label--crear">
            Tipo:
            <select
              name="tipo"
              value={formData.tipo}
              onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
              className="input--crear"
              required
            >
              <option value="">Seleccionar</option>
              <option value="plato">Plato</option>
              <option value="bebida">Bebida</option>
            </select>
          </label>

          <label className="label--crear">
            Sección:
            <select
              name="seccion"
              value={formData.seccion}
              onChange={handleChange}
              className="input--crear"
              required
            >
              <option value="">Seleccionar sección</option>
              <option value="entrante">Entrante</option>
              <option value="medio">Medio</option>
              <option value="final">Final</option>
            </select>
          </label>

             {/* ✅ Estación */}
          <label className="label--crear">
            Estación:
            <select
              name="estacion"
              value={formData.estacion}
              onChange={handleChange}
              className="input--crear"
              required
            >
              <option value="">Seleccionar estación</option>
              <option value="frio">Frío</option>
              <option value="plancha">Plancha</option>
              <option value="frito">Frito</option>
            </select>
          </label>


          {/* Mostrar campos específicos según el tipo de producto */}
          {formData.tipo === "plato" && (
            <fieldset className="fieldset--crear">
              <legend className="legend--crear">Precios</legend>
              <div className="form-group--crear">
                <label className="label--crear">
                  Precio Base:
                  <input type="number" name="precios.precioBase" value={formData.precios.precioBase} onChange={handleChange} className="input--crear" required />
                </label>
                <label className="label--crear">
                  Precio Tapa:
                  <input type="number" name="precios.tapa" value={formData.precios.tapa || ""} onChange={handleChange} className="input--crear" />
                </label>
                <label className="label--crear">
                  Precio Ración:
                  <input type="number" name="precios.racion" value={formData.precios.racion || ""} onChange={handleChange} className="input--crear" />
                </label>
                {/* Campo para definir el precio del adicional */}
                <fieldset className="fieldset--crear">
                  <legend className="legend--crear">Adicional (Unidad extra)</legend>
                  <label className="label--crear">
                    Precio del adicional:
                    <input
                      type="number"
                      value={formData.adicionales?.[0]?.precio || ""}
                      onChange={(e) => {
                        const nuevoPrecio = parseFloat(e.target.value);
                        setFormData((prev) => ({
                          ...prev,
                          adicionales: [{ nombre: "Unidad adicional", precio: nuevoPrecio }],
                        }));
                      }}
                      className="input--crear"
                    />
                  </label>
                </fieldset>
              </div>
            </fieldset>
          )}

          {formData.tipo === "bebida" && (
            <fieldset className="fieldset--crear">
              <legend className="legend--crear">Opciones de Bebida</legend>
              <label className="label--crear">
                Precio Base:
                <input type="number" name="precios.precioBase" value={formData.precios.precioBase} onChange={handleChange} className="input--crear" required />
              </label>
              {/* Label para precios.precioCopa */}
              <label className="label--crear">
                Precio Copa:
                <input type="number" name="precios.precioCopa" value={formData.precios.precioCopa || ""} onChange={handleChange} className="input--crear" />
              </label>
              {/* Label para precios.precioBotella */}
              <label className="label--crear">
                Precio Botella:
                <input type="number" name="precios.precioBotella" value={formData.precios.precioBotella || ""} onChange={handleChange} className="input--crear" />
              </label>
            </fieldset>
          )}
        </div>


        <div className="form-group--crear">
          {/* Aliases */}
          <label className="label--editar">
            Aliases (separados por comas):
            <input
              type="text"
              value={formData.aliases?.join(", ") || ""}
              onChange={(e) => {
                const input = e.target.value;
                const nuevosAliases = input
                  .split(",")
                  .map((alias) => alias.trim())
                  .filter((alias) => alias.length > 0);
                setFormData((prev) => ({
                  ...prev,
                  aliases: nuevosAliases,
                }));
              }}
              className="input--editar"
              placeholder="Ej: croqueta, jamón, croquetas jamón"
            />
          </label>
          <label className="label--crear">
            Stock:
            <input type="number" name="stock" value={formData.stock} onChange={handleChange} className="input--crear" required />
          </label>

          {/* Alérgenos */}
          <label className="label--editar">
            Alérgenos (separados por comas):
            <input
              type="text"
              name="alergenos"
              value={formData.alergenos?.join(", ") || ""}
              onChange={(e) => {
                const value = e.target.value
                  .split(",")
                  .map((a) => a.trim().toLowerCase())
                  .filter(Boolean);
                setFormData((prev) => ({ ...prev, alergenos: value }));
              }}
              className="input--editar"
              placeholder="Ej: gluten, lactosa, huevo"
            />
          </label>

          {/* ✅ Área de subida de imágenes con Drag & Drop */}
          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, setFormData)} // Pasamos setFormData aquí
            onClick={() => document.getElementById("file-upload").click()} // 🔹 Abrir el input al hacer clic
          >
            <p>Arrastra una imagen aquí o haz clic para subir</p>
            <input
              type="file"
              id="file-upload" // 🔹 Añadir un ID único
              onChange={(e) => handleFileChange(e, setFormData)} // Pasamos setFormData aquí
              accept="image/*"
              className="hidden-file-input"
            />
            {imageFile && <p>📂 {imageFile.name}</p>}
          </div>

          {formData.img && (
            <div className="preview-container">
              <img src={formData.img} alt="Vista previa" className="preview-img" />
            </div>
          )}
        </div>

        <div className="botones--crear">
          <button type="submit" className="boton--crear">Guardar</button>
          <button type="button" onClick={onClose} className="boton--cancelar">Cancelar</button>
        </div>
      </form >
    </div >
  );
};

export default CrearProducto;