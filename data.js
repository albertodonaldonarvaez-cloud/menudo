/**
 * DATA INICIAL POR DEFECTO
 * Estos valores se cargan la primera vez y luego se sincronizan con localStorage.
 * Puedes modificar títulos, precios, fotos, descripciones, dirección y guisados desde admin.html.
 */
const DEFAULT_STORE_DATA = {
  business: {
    name: "Menudería y Antojitos 'Doña Güera'",
    slogan: "El auténtico sabor tradicional, recién hecho y bien calientito",
    address: "Av. Hidalgo #104, Col. Centro (Frente a la plaza)",
    schedule: "Martes a Domingo: 7:00 AM - 2:00 PM",
    isOpen: true,
    currency: "MXN",
    currencySymbol: "$"
  },
  prices: {
    menudo: 120,
    gordita: 25,
    burrito: 35,
    cafeOlla: 25,
    refresco: 25
  },
  titles: {
    menudo: "Plato de Menudo Tradicional",
    gorditas: "Gorditas de Guisado al Comal",
    burritos: "Burritos Norteños de Guisado",
    cafeOlla: "Café de Olla Artesanal",
    refresco: "Refresco de Vidrio Bien Helado"
  },
  images: {
    menudo: "https://images.unsplash.com/photo-1543339308-43e59d6b73a6?auto=format&fit=crop&w=900&q=80",
    gorditas: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=900&q=80",
    burritos: "https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=900&q=80",
    cafeOlla: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
    refresco: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80"
  },
  descriptions: {
    menudo: "Receta casera servida bien calientita. Acompañado con su plato de verdura (cebolla picada, orégano serrano, chile de árbol quebrado, limones) y tortillas calientitas recién hechas.",
    gorditas: "Gorditas de masa de maíz hechas a mano al comal, rellenas con tus guisados favoritos del día.",
    burritos: "En tortilla grande de harina casera bien doradita con guisados tradicionales.",
    cafeOlla: "Hervido en olla de barro tradicional con canela pura de raja y auténtico piloncillo.",
    refresco: "Coca-Cola de vidrio bien helada, Jarritos de sabores variados y refrescos de 355ml."
  },
  // Guisados del día compartidos entre Gorditas y Burritos
  guisados: [
    { id: "g1", name: "Chicharrón Prensado en Salsa Roja", available: true },
    { id: "g2", name: "Deshebrada a la Mexicana", available: true },
    { id: "g3", name: "Asado de Puerco Tradicional", available: true },
    { id: "g4", name: "Rajas con Queso y Crema", available: true },
    { id: "g5", name: "Picadillo Casero con Papitas", available: true },
    { id: "g6", name: "Frijolitos Refritos con Queso", available: true },
    { id: "g7", name: "Chicharrón en Salsa Verde", available: true },
    { id: "g8", name: "Huevo con Chorizo Casero", available: true }
  ]
};
