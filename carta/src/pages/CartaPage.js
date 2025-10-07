import React, { useContext, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ProductosContext } from '../context/ProductosContext';
import Carta from '../components/Carta/Carta';
import TopBar from '../components/Navbar/Topbar';
import { Helmet } from 'react-helmet-async';

const CartaPage = () => {
  const { numeroMesa } = useParams();
  const { obtenerMesaId } = useContext(ProductosContext);

  useEffect(() => {
    if (numeroMesa) {
      obtenerMesaId(numeroMesa);
    }
  }, [numeroMesa, obtenerMesaId]);

  return (
    <div className="container">
      <Helmet>
        <title>Carta del Restaurante | {process.env.REACT_APP_NOMBRE_RESTAURANTE}</title>
        <meta
          name="description"
          content="Explora nuestra carta digital y disfruta de nuestros platos, tapas y bebidas. Realiza tu pedido desde tu mesa fácilmente."
        />
        <meta
          name="keywords"
          content="carta, restaurante, pedidos, menú, pizza, tapas, bebidas, comida, Zabor Fetén, Torremolinos"
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:title" content="Carta | Zabor Fetén" />
        <meta
          property="og:description"
          content="Consulta la carta digital desde tu mesa y haz tu pedido fácilmente."
        />
      </Helmet>

      <TopBar />

      <main>
        <Carta />
      </main>
    </div>
  );
};

export default CartaPage;
