const DetallesProducto = ({ producto }) => (
  <>
    {producto.extras?.length > 0 && (
      <p><strong>Extras:</strong> {producto.extras.map(e => `${e.nombre}`).join(', ')}</p>
    )}
    {producto.adicionales?.length > 0 && (
      <p><strong>Adicionales:</strong> {producto.adicionales.map(ad => ad.nombre).join(', ')}</p>
    )}
    {producto.ingredientesEliminados?.length > 0 && (
      <p><strong>Sin:</strong> {producto.ingredientesEliminados.join(', ')}</p>
    )}
    {producto.especificaciones?.length > 0 && (
      <p><strong>Especificaciones:</strong> {producto.especificaciones.join(', ')}</p>
    )}
    {producto.sabor?.length > 0 && (
      <ul>
        {producto.sabor.map((s, i) => (
          <li key={i}>{s.cantidad}x {s.ingrediente}</li>
        ))}
      </ul>
    )}
    {producto.mensaje && <p className="mensaje-producto--cocina">{producto.mensaje}</p>}
  </>
);

export default DetallesProducto;