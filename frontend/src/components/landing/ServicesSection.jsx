import React from 'react';
import '../../styles/services.css';

export default function ServicesSection() {
  const ports = [
    { 
      name: 'Nellore (Krishnapatnam)', 
      image: '/images/nellore_port.jpg', 
      desc: 'A major hub for our fresh fish exports, ensuring rapid coastal delivery across Andhra Pradesh and beyond. We utilize top-tier cold storage.' 
    },
    { 
      name: 'Chennai Port', 
      image: '/images/chennai_port.jpg', 
      desc: 'Serving Tamil Nadu and southern India with daily fresh catches. Our seamless logistics network guarantees same-day freshness.' 
    },
    { 
      name: 'Mumbai Port', 
      image: '/images/kandla_port.jpg', 
      desc: 'Delivering premium seafood to the commercial capital of India. Our advanced supply chain ensures zero compromise on quality.' 
    },
    { 
      name: 'Goa (Mormugao Port)', 
      image: '/images/kakinada_port.jpg', 
      desc: 'Exporting premium sea catches to the coastal paradise, catering perfectly to high-demand hospitality and fine dining markets.' 
    },
    { 
      name: 'Kolkata Port', 
      image: '/images/haldia_port.jpg', 
      desc: 'Connecting our products to the eastern corridor. We maintain strict temperature-controlled logistics for long-distance transit.' 
    },
    { 
      name: 'Visakhapatnam Port', 
      image: '/images/vizag_port.jpg', 
      desc: 'A massive coastal gateway allowing us to ship large volumes of fresh marine catch instantly across the East coast.' 
    },
    { 
      name: 'Kochi (Cochin Port)', 
      image: '/images/kochi_port.jpg', 
      desc: 'Our vital link to Kerala, ensuring the finest marine products reach the local markets fresh and perfectly preserved.' 
    },
    { 
      name: 'Mangalore Port', 
      image: '/images/machilipatnam_port.jpg', 
      desc: 'Handling massive seafood exports across the Karnataka coastline with dedicated port-side cold storage facilities.' 
    },
    { 
      name: 'Paradip Port', 
      image: '/images/paradip_port.jpg', 
      desc: 'Serving Odisha and neighboring regions with highly efficient, rapid marine transport and expert logistics handling.' 
    },
    { 
      name: 'Haldia Port', 
      image: '/images/haldia_port.jpg', 
      desc: 'A major export node managing bulk container shipments of both frozen and fresh commercial fish.' 
    },
    { 
      name: 'Tuticorin Port', 
      image: '/images/chennai_port.jpg', 
      desc: 'Facilitating deep-sea catches and acting as a primary distribution hub for the extreme southern regions.' 
    },
    { 
      name: 'Kandla Port', 
      image: '/images/kandla_port.jpg', 
      desc: 'Exporting our premium marine yield to Gujarat and the western borders of India with unmatched speed.' 
    },
    { 
      name: 'Ennore Port', 
      image: '/images/nellore_port.jpg', 
      desc: 'An essential corporate port handling our large-scale commercial seafood supply chain seamlessly.' 
    },
    { 
      name: 'Kakinada Port', 
      image: '/images/kakinada_port.jpg', 
      desc: 'Direct access to the rich Godavari basin fisheries, shipping premium harvest both locally and nationally.' 
    },
    { 
      name: 'Machilipatnam Port', 
      image: '/images/machilipatnam_port.jpg', 
      desc: 'A historic port now modernized for our fresh marine and freshwater exports, connecting local fishermen to the nation.' 
    }
  ];

  return (
    <section className="services-section" id="services">
      <div className="services-container">
        <h2 className="section-heading">Our Services</h2>
        <h3 className="section-subheading">Pan-India Export & Supply</h3>
        
        <p className="services-lead-text">
          We are proud to export premium quality fresh water and sea water products all over India. 
          Our extensive logistical network operates through major shipping ports, ensuring that the harvest reaches you in pristine condition, preserving nature's exact freshness.
        </p>

        <div className="ports-grid">
          {ports.map((port, index) => (
            <div className="port-card" key={index} style={{ animationDelay: `${index * 0.15}s` }}>
              <div className="port-img-wrapper">
                <img src={port.image} alt={`${port.name} Sea Port`} className="port-img" />
                <div className="port-overlay" />
                <h4 className="port-name">{port.name}</h4>
              </div>
              <div className="port-content">
                <p className="port-desc">{port.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
