import React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/autoplay";
import { Autoplay } from "swiper/modules";
import Pizza1 from "../../assets/images/churrasquito.avif";
import Pizza2 from "../../assets/images/mujeresZF.avif";
import Pizza3 from "../../assets/images/parejaZF.avif";
import Pizza4 from "../../assets/images/hamburguesasZF.avif";
import "../../styles/HomeCarrousel.css";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

const HomeCarousel = () => {
  const navigate = useNavigate();

  const slides = [
    {
      src: Pizza1,
      text: "Disfruta de las mejores tapas de Torremolinos",
    },
    {
      src: Pizza2,
      text: "El cóctel perfecto para cada ocasión",
    },
    {
      src: Pizza3,
      text: "Platos gourmet que combinan tradición y calidad",
    },
    {
      src: Pizza4,
      text: "Un ambiente acogedor para compartir momentos únicos",
    },
  ];

  const handleReservaClick = useCallback(() => navigate("/reservas"), [navigate]);

  const handleCartaClick = useCallback(() => navigate("/carta"), [navigate]);

  return (
    <Swiper
      modules={[Autoplay]}
      autoplay={{ delay: 4000 }}
      loop={true}
      spaceBetween={0}
      slidesPerView={1}
    >
      {slides.map((slide, index) => (
        <SwiperSlide key={index}>
          <div className="slide-container">
            <img src={slide.src} alt={`Slide ${index + 1}`} className="carousel-img" />
            <div className="slide-overlay">
              <h2 className="title-text">{slide.text}</h2>
              <div className="carousel-buttons">
                <button className="reserva-btn" onClick={handleReservaClick}>¡RESERVA MESA!</button>
                <button className="carta-btn" onClick={handleCartaClick}>VER CARTA</button>
              </div>
            </div>
          </div>
        </SwiperSlide>
      ))}
    </Swiper>
  );
};

export default HomeCarousel;
