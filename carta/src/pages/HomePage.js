import React from "react";
import { Helmet } from "react-helmet";
import "../styles/Home.css";
import TopBar from "../components/Navbar/Topbar";
import Carrousel from "../components/Carrousel/Carrousel";
import Pizza2 from "../assets/images/mirianZF.avif";
import Pizza3 from "../assets/images/frenteZF.avif";
import Pizza4 from "../assets/images/cavaZF.avif";

const Home = () => {
  const restaurantName = process.env.REACT_APP_NOMBRE_RESTAURANTE || "Zabor Fetén";

  return (
    <>
      <Helmet>
        <title>{restaurantName} - Pizzería en Torremolinos | Carta Online</title>
        <meta
          name="description"
          content={`Descubre ${restaurantName}, la mejor pizzería de Torremolinos. Consulta nuestra carta online, ubicación y horarios. ¡Haz tu pedido ahora!`}
        />
        <meta
          name="keywords"
          content="Zabor Fetén, pizzería Torremolinos, carta online, restaurante, comida italiana, pizza artesanal"
        />
        <meta property="og:title" content={`${restaurantName} - Pizzería en Torremolinos`} />
        <meta
          property="og:description"
          content="Consulta la carta online de Zabor Fetén y ven a disfrutar de las mejores pizzas artesanales en el corazón de Torremolinos."
        />
        <meta property="og:image" content="https://tusitio.com/images/preview-pizza.jpg" />
        <meta property="og:url" content="https://tusitio.com" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href="https://tusitio.com" />

        {/* Datos estructurados tipo Restaurante */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": restaurantName,
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Plaza Federico Garcia Lorca nu.1",
              "addressLocality": "Torremolinos",
              "addressRegion": "Málaga",
              "addressCountry": "ES"
            },
            "telephone": "+34 631 50 70 83",
            "servesCuisine": "Italiana, Pizza",
            "openingHours": ["Miércoles-Domingo 13:00-17:00", "Miércoles-Domingo 20:00-24:00"],
            "image": "https://tusitio.com/images/preview-pizza.jpg",
            "url": "https://tusitio.com"
          })}
        </script>
      </Helmet>

      <TopBar />
      <main className="home-container">
        <section className="hero">
          <div className="carousel">
            <Carrousel />
          </div>
        </section>

        <section className="features">
          <div className="features-title">
            <h2>¿Por qué elegirnos?</h2>
          </div>

          <div className="features-grid">
            <article className="feature">
              <div className="feature-image-wrapper">
                <img src={Pizza2} alt="Pizzas caseras hechas con amor" />
                <div className="feature-text">
                  <h3>SERVICIO Y GASTRONOMÍA</h3>
                </div>
              </div>
            </article>
            <article className="feature">
              <div className="feature-image-wrapper">
                <img src={Pizza3} alt="Servicio excepcional y cocina italiana auténtica" />
                <div className="feature-text">
                  <h3>UBICACIÓN ESTRATÉGICA</h3>
                </div>
              </div>
            </article>
            <article className="feature">
              <div className="feature-image-wrapper">
                <img src={Pizza4} alt="La mejor pizza de Torremolinos" />
                <div className="feature-text">
                  <h3>AMBIENTE ACOGEDOR</h3>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="map-section">
          <div className="map-wrapper">
            <iframe
              title="Ubicación del restaurante Zabor Fetén"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3192.722992268298!2d-4.5037909!3d36.6220126!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd72fb858d3d5b33%3A0x6b9123f5a2b0b9c4!2sC.%20de%20la%20Cruz%2C%2010%2C%2029620%20Torremolinos%2C%20M%C3%A1laga!5e0!3m2!1ses!2ses!4v1738965600000"
              width="100%"
              height="500"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            ></iframe>

            <a
              href="https://www.google.com/maps/dir/?api=1&destination=36.6220126,-4.5037909"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-llegar"
            >
              Cómo llegar
            </a>
          </div>
        </section>

        <footer className="footer">
          <div className="footer-top">
            <div className="footer-info">
              <h3 className="footer-title">Contacto</h3>
              <p className="footer-item">📞 Teléfono: 665 92 54 13</p>
              <p className="footer-item">
                📍 C. de la Cruz, 10, 29620 Torremolinos, Málaga, España
              </p>
            </div>

            <div className="footer-horario">
              <h3 className="footer-title">Horarios</h3>
              <p className="footer-item">Martes - Domingo</p>
              <p className="footer-item">🕐 13:00 - 17:00</p>
              <p className="footer-item">🕐 20:00 - 24:00</p>
            </div>
          </div>

          <div className="footer-bottom">
            <p>
              © {new Date().getFullYear()} {restaurantName}. Todos los derechos
              reservados.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
};

export default Home;
