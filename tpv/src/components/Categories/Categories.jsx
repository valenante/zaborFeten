import React, { useState, useEffect } from "react";
import { useCategorias } from "../../context/CategoriasContext";
import * as logger from "../../utils/logger";
import EditProduct from "./EditProducts";
import CrearProducto from "./CrearProducto";
import AlertaMensaje from "../AlertaMensaje/AlertaMensaje";
import ModalConfirmacion from "../Modal/ModalConfirmacion";
import "./Categories.css";

const Categories = ({ category }) => {
  const [editingProduct, setEditingProduct] = useState(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [mensajeAlerta, setMensajeAlerta] = useState(null);
  const [productoAEliminar, setProductoAEliminar] = useState(null); // ID del producto pendiente de confirmación

  const { products, fetchProducts, updateProduct, deleteProduct } = useCategorias();

  useEffect(() => {
    if (category) {
      fetchProducts(category);
    }
  }, [category]);

  const handleEdit = (product) => {
    setEditingProduct(product);
  };

  const handleSave = async (updatedProduct) => {
    try {
      await updateProduct(updatedProduct);
      setEditingProduct(null);
    } catch (error) {
      logger.error("Error al guardar producto:", error);
    }
  };

  const confirmarEliminacion = async (id) => {
    try {
      await deleteProduct(id);
      await fetchProducts(category);
      setMensajeAlerta({ tipo: "exito", mensaje: "Producto eliminado con éxito" });
    } catch (error) {
      logger.error("Error al eliminar producto:", error);
    } finally {
      setProductoAEliminar(null);
    }
  };

  const handleCancel = () => {
    setEditingProduct(null);
  };

  return (
    <div className="categories--categories">
      {editingProduct ? (
        <EditProduct
          product={editingProduct}
          onSave={handleSave}
          onCancel={handleCancel}
          onDelete={(id) => setProductoAEliminar(id)} // Cambiamos confirm por modal
        />
      ) : (
        <>
          {products.length === 0 ? (
            <p className="sin-productos--categories">No hay productos en esta categoría.</p>
          ) : (
            <div className="productos-grid--categories">
              {products.map((product) => (
                <div key={product._id} className="producto-card--categories">
                  <p>{product.nombre}</p>
                  <div className="producto-botones--categories">
                    <button
                      onClick={() => handleEdit(product)}
                      className="boton-editar--categories"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => setProductoAEliminar(product._id)}
                      className="boton-eliminar--categories"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <button
        onClick={() => setMostrarFormulario(true)}
        className="boton-crear--categories"
      >
        Crear Producto
      </button>

      {mostrarFormulario && (
        <>
          <div
            className="crear-producto-overlay--crear"
            onClick={() => setMostrarFormulario(false)}
          ></div>
          <CrearProducto onClose={() => setMostrarFormulario(false)} />
        </>
      )}

      {productoAEliminar && (
        <ModalConfirmacion
          titulo="Eliminar producto"
          mensaje="¿Estás seguro de que quieres eliminar este producto?"
          onConfirm={() => confirmarEliminacion(productoAEliminar)}
          onClose={() => setProductoAEliminar(null)}
        />
      )}

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

export default Categories;
