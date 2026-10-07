/** SEO mega-menu content for the shared home/results header. Links are display-only in the prototype. */
export const HEADER_MENU_COLUMN_COUNT = 5;

export const headerMenus = [
  {
    id: 'comprar',
    labelKey: 'Comprar',
    columns: [
      {
        titleKey: 'Estado',
        items: [
          'Ciudad de México',
          'Edo. de México',
          'Querétaro',
          'Morelos',
          'Nuevo León',
          'Yucatán',
          'Quintana Roo',
          'Jalisco',
          'Veracruz',
          'Puebla',
          'Hidalgo',
        ],
      },
      {
        titleKey: 'Tipo de propiedad',
        items: [
          'Casa',
          'Departamento',
          'Terreno / Lote',
          'Casa en condominio',
          'Local Comercial',
        ],
      },
      {
        titleKey: 'Recámaras',
        items: [
          '3 recámaras',
          '2 recámaras',
          '4 recámaras',
          '5 o más recámaras',
          '1 recámara',
        ],
      },
      {
        titleKey: 'Servicios',
        items: [
          'El ABC de comprar y rentar una propiedad',
          'Guía para comprar un inmueble',
          '¿Cómo saber el precio de mi casa?',
          'Publicar inmueble para venta',
        ],
      },
      {
        titleKey: 'Otras operaciones',
        items: ['Desarrollos'],
      },
    ],
  },
  {
    id: 'rentar',
    labelKey: 'Rentar',
    columns: [
      {
        titleKey: 'Estado',
        items: [
          'Ciudad de México',
          'Edo. de México',
          'Nuevo León',
          'Querétaro',
          'Jalisco',
          'Puebla',
          'Veracruz',
          'Morelos',
          'Quintana Roo',
          'Yucatán',
          'Chihuahua',
        ],
      },
      {
        titleKey: 'Tipo de propiedad',
        items: [
          'Departamento',
          'Oficina',
          'Casa',
          'Local Comercial',
          'Bodega comercial',
          'Villa',
          'Casa en condominio',
          'Quinta',
        ],
      },
      {
        titleKey: 'Recámaras',
        items: [
          '3 recámaras',
          '2 recámaras',
          '4 recámaras',
          '1 recámara',
          '5 o más recámaras',
        ],
      },
      {
        titleKey: 'Temporada',
        items: [
          'Guerrero',
          'Quintana Roo',
          'Nayarit',
          'Jalisco',
          'Yucatán',
          'Morelos',
          'Villa',
          'Quinta',
          'Casa en condominio',
        ],
      },
      {
        titleKey: 'Servicios',
        items: [
          'El ABC de comprar y rentar una propiedad',
          'Guía para rentar un inmueble',
          'Conoce la mejor forma de publicar la renta de departamentos',
          'Publicar inmueble para renta',
        ],
      },
    ],
  },
  {
    id: 'servicios',
    labelKey: 'Servicios',
    columns: [
      {
        titleKey: 'Seguro de arrendamiento',
        items: [
          '¿Qué necesito para rentar?',
          'Tips de Mudanza',
          'Sugerencia de ciudades donde rentar',
        ],
      },
      {
        titleKey: 'Inmuebles24 te explica',
        items: [
          'Sácale provecho a tu cuenta de Inmuebles24',
          '¿Qué necesito para comprar?',
          '¿Qué necesito para vender?',
          'Publica un inmueble',
        ],
      },
      {
        titleKey: 'Importante tomar en cuenta',
        items: [
          '¿Cuánto vale?',
          '¿Cómo consultar el adeudo predial?',
          'Impuestos a pagar al comprar o vender una casa',
          'Costo de escritura de una casa',
          'Remates Hipotecarios',
          'Como evitar fraudes',
        ],
      },
      {
        titleKey: 'Números del mercado',
        items: ['Index CDMX', 'Index Monterrey', 'Index Guadalajara'],
      },
      {
        titleKey: 'Novedades',
        items: ['Blog', 'Tips', 'Encuestas'],
      },
    ],
  },
];

export function padMenuColumns(columns, count = HEADER_MENU_COLUMN_COUNT) {
  const padded = columns.slice(0, count);
  while (padded.length < count) padded.push(null);
  return padded;
}
