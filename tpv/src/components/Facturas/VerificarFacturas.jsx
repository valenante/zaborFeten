import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import publicApi from '../../utils/publicApi';
import './VerificarFacturas.css'; // 👈 importa el CSS aquí

export default function VerificarFacturaPage() {
    const { hash } = useParams();
    const [factura, setFactura] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        publicApi.get(`/facturas/verificar-factura/${hash}`)
            .then(res => setFactura(res.data))
            .catch(err => setError(err.response?.data?.error || err.message));
    }, [hash]);

    if (error) return <div style={{ color: 'red' }}>❌ {error}</div>;
    if (!factura) return <div>Cargando...</div>;

    return (
        <div className="verificar-container">
            <h2 className="verificar-title">🔎 Verificación de Factura</h2>
            <p className="verificar-info"><strong>Factura Nº:</strong> {factura.numeroFactura}</p>
            <p className="verificar-info"><strong>Fecha:</strong> {new Date(factura.fecha).toLocaleString()}</p>
            <p className="verificar-info"><strong>Cliente:</strong> {factura.cliente} ({factura.clienteNIF})</p>
            <p className="verificar-info"><strong>Total:</strong> {factura.total} EUR</p>
            <p><strong>Hash:</strong> <span className="verificar-hash">{factura.hash}</span></p>
            <p><strong>Hash anterior:</strong> <span className="verificar-hash">{factura.hashAnterior || 'N/A'}</span></p>

            <p
                className={`verificar-validacion ${factura.valido ? 'verificar-valido' : 'verificar-no-valido'
                    }`}
            >
                {factura.valido ? '✅ Factura válida' : '❌ Hash no coincide'}
            </p>
        </div>
    );
}
