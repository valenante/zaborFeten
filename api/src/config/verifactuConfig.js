// config/verifactuConfig.js
export const SIF = {
  productor: {
    nombreRazon: 'Mi Empresa SL',         // *productor del SIF (componente principal)
    nif: 'B12345678',
    // si no tienes NIF español, usa IDOtro (codigoPais, idType, id)
  },
  sistema: {
    nombre: 'MiSIF',
    id: 'MS',                              // 2..?? seg. doc. de validaciones AEAT
    version: '1.0.0',
    numeroInstalacion: 'MI-LOCAL-001',
    soloVerifactu: 'N',                    // L4: 'S'|'N'
    multiOT: 'S',                          // L4: 'S'|'N'
    indicadorMultiplesOT: (n) => (n > 1 ? 'S' : 'N'),
  },
};
