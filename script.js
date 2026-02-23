const URL_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRjE6vdEqcQhXg1JdXfuqa_rppynPYR2GZ_TrIeki_ABimmzRQs7BpT4V6awQBVBek4PGAPWRLY36vp/pub?output=csv";

let productosGlobales = [];
// En la línea 4 de script.js cambia esto:
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let limiteActual = 8; 
let listaFiltradaActual = [];

// 1. CARGA DE DATOS DESDE EXCEL
async function cargarProductosDesdeExcel() {
    try {
        const respuesta = await fetch(`${URL_CSV}&cachebust=${new Date().getTime()}`);
        const datos = await respuesta.text();
        const filas = datos.split(/\r?\n/).slice(1); 
        
        productosGlobales = filas.map(fila => {
            const col = fila.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            if(col.length < 6) return null;
            return {
    id: col[0]?.trim(),
    name: col[1]?.trim(),
    category: col[2]?.trim(),
    location: col[3]?.trim(),
    priceUSD: parseFloat(col[4]) || 0,
    priceMN: parseFloat(col[5]) || 0,
    stock: col[6]?.trim(),
    image: col[7]?.trim(),
    descripcion: col[8]?.trim(),
    garantia: col[9]?.trim(),
    pagos: col[10]?.trim(),
    tipoEntrega: col[11]?.trim(), // Esta es la columna L (Entrega: Recogida/Domicilio)
    mapa: col[12]?.trim()         // Esta es la columna M (Link de Google Maps)
};
        }).filter(p => p !== null);
        
        listaFiltradaActual = productosGlobales;
        mostrarEnGrid(listaFiltradaActual);
        actualizarBarraFlotante(); // Cargar barra si ya había algo en memoria
    } catch (e) { console.error("Error cargando Excel:", e); }
}

// 2. MOSTRAR PRODUCTOS (CORREGIDO PRECIOS)
function mostrarEnGrid(lista) {
    const grid = document.getElementById('tienda-productos');
    const btnMas = document.getElementById('btn-cargar-mas');
    if (!grid) return;
    
    grid.innerHTML = "";
    const productosVisibles = lista.slice(0, limiteActual);

    if (productosVisibles.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding:20px;'>No hay productos que coincidan.</p>";
        if(btnMas) btnMas.style.display = 'none';
        return;
    }

    productosVisibles.forEach(p => {
        let stockLabel = p.stock <= 0 ? '<b style="color:red;">Agotado</b>' : 
                         p.stock < 3 ? `<b style="color:orange;">¡Últimos ${p.stock}!</b>` : 'Disponible';

        // Lógica de precios inteligente para mostrar MN
        let preciosHTML = "";
        if (p.priceUSD > 0 && p.priceMN > 0) {
            preciosHTML = `
                <p style="margin:0; color:#2ecc71; font-weight:bold;">$${p.priceUSD} USD</p>
                <p style="margin:0; color:#888; font-size:0.8rem;">${p.priceMN.toLocaleString()} MN</p>`;
        } else if (p.priceUSD > 0) {
            preciosHTML = `<p style="margin:0; color:#2ecc71; font-weight:bold;">$${p.priceUSD} USD</p>`;
        } else {
            preciosHTML = `<p style="margin:0; color:#e67e22; font-weight:bold;">${p.priceMN.toLocaleString()} MN</p>`;
        }

        grid.innerHTML += `
        <div class="product-card">
            <span class="tag">${p.category}</span>
            <div onclick="verDetalle('${p.id}')" style="cursor:pointer;">
                <div class="img-container"><img src="${p.image}" onerror="this.src='https://via.placeholder.com/150'"></div>
                <div class="card-info">
                    <small>📍 ${p.location}</small>
                    <h3 style="font-size:0.9rem; margin:5px 0;">${p.name}</h3>
                    <div class="prices">${preciosHTML}</div>
                </div>
            </div>
            <div class="card-info" style="margin-top:auto;">
                <button onclick="agregarAlCarrito('${p.id}')">🛒 Añadir</button>
            </div>
        </div>`;
    });

    if (btnMas) {
        btnMas.style.display = (lista.length > limiteActual) ? 'inline-block' : 'none';
    }
}

// 3. LÓGICA DEL CARRITO Y MEMORIA
if (localStorage.getItem('carrito')) {
    carrito = JSON.parse(localStorage.getItem('carrito'));
}

function guardarCarrito() {
    localStorage.setItem('carrito', JSON.stringify(carrito));
    actualizarBarraFlotante();
}

function agregarAlCarrito(id) {
    const prod = productosGlobales.find(p => p.id === id);
    if (!prod) return;

    if (prod.stock <= 0) return alert("Producto agotado asere");

    const itemExistente = carrito.find(item => item.id === id);
    if (itemExistente) {
        itemExistente.cantidad += 1;
    } else {
        carrito.push({ ...prod, cantidad: 1 });
    }
    
    guardarCarrito();
    alert(`Añadido: ${prod.name}`);
}

function actualizarBarraFlotante() {
    let cartDiv = document.getElementById('carrito-flotante');
    if (!cartDiv) return;

    // IMPORTANTE: Asegurarnos de leer lo último que haya en memoria
    const carritoMemoria = JSON.parse(localStorage.getItem('carrito')) || [];

    if (carritoMemoria.length === 0) {
        cartDiv.style.display = 'none';
        return;
    }

    // Calcular sobre lo que hay en memoria real
    let totalItems = carritoMemoria.reduce((sum, p) => sum + p.cantidad, 0);
    let totalUSD = carritoMemoria.reduce((sum, p) => sum + (p.priceUSD * p.cantidad), 0);

    cartDiv.className = 'cart-minimized';
    cartDiv.style.display = 'flex';
    cartDiv.onclick = () => { window.location.href = 'carrito.html'; };
    cartDiv.innerHTML = `
        <span>🛒 ${totalItems} productos</span>
        <span style="font-weight:bold;">Total: $${totalUSD.toFixed(2)} ➡️</span>
    `;
}

// 4. FUNCIONES DE APOYO (DETALLE, FILTROS, WHATSAPP)
function verDetalle(id) {
    const prod = productosGlobales.find(p => p.id === id);
    localStorage.setItem('producto_seleccionado', JSON.stringify(prod));
    window.location.href = 'detalle.html';
}

function filtrarCategoria(cat) {
    limiteActual = 8; 
    listaFiltradaActual = (cat === 'Todos') ? productosGlobales : productosGlobales.filter(p => p.category === cat);
    mostrarEnGrid(listaFiltradaActual);
}

function filtrarPorZona(zona) {
    limiteActual = 8;
    listaFiltradaActual = (zona === 'Todos') ? productosGlobales : productosGlobales.filter(p => p.location === zona);
    mostrarEnGrid(listaFiltradaActual);
}

function filtrarProductos() {
    const texto = document.getElementById('search-input').value.toLowerCase();
    limiteActual = 8;
    listaFiltradaActual = productosGlobales.filter(p => p.name.toLowerCase().includes(texto));
    mostrarEnGrid(listaFiltradaActual);
}

function enviarPedidoWhatsApp() {
    if (carrito.length === 0) return;
    let mensaje = "👋 *¡Hola! Me interesa este pedido:*%0A%0A";
    let tUSD = 0;

    carrito.forEach(p => {
        mensaje += `• ${p.name} (x${p.cantidad})%0A`;
        tUSD += (p.priceUSD * p.cantidad);
    });

    mensaje += `%0A💰 *Subtotal mercadería:* $${tUSD.toFixed(2)} USD`;
    mensaje += `%0A%0A❓ *Consulta:* ¿Este vendedor tiene domicilio disponible hoy? ¿Cuál sería el costo adicional?`;
    
    window.open(`https://wa.me/5358956989?text=${mensaje}`, '_blank');
}

// 5. INICIALIZACIÓN
function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const esOscuro = document.body.classList.contains('dark-mode');
    const icono = document.getElementById('theme-icon');
    if (icono) icono.innerText = esOscuro ? '☀️' : '🌙';
    localStorage.setItem('tema', esOscuro ? 'oscuro' : 'claro');
}

window.onload = () => {
    cargarProductosDesdeExcel();
    
    // Asegurarnos de que el contenedor de la barra flotante exista
    if (!document.getElementById('carrito-flotante')) {
        const c = document.createElement('div'); 
        c.id = 'carrito-flotante'; 
        document.body.appendChild(c);
    }

    // Cargar el tema guardado
    if (localStorage.getItem('tema') === 'oscuro') {
        document.body.classList.add('dark-mode');
        const icono = document.getElementById('theme-icon');
        if (icono) icono.innerText = '☀️';
    }
    
    // IMPORTANTE: Actualizar la barra con lo que haya en memoria al cargar
    actualizarBarraFlotante();
};
// --- FUNCIÓN PARA RENDERIZAR EL CARRITO CON SELECTORES ---
function renderizarCarritoIndependiente() {
    const listaDiv = document.getElementById('lista-carrito-detallada');
    const resumenDiv = document.getElementById('resumen-pago');
    if (!listaDiv) return;

    const carritoActual = JSON.parse(localStorage.getItem('carrito')) || [];

    if (carritoActual.length === 0) {
        listaDiv.innerHTML = "<h3 style='text-align:center;'>Tu carrito está vacío asere.</h3>";
        resumenDiv.innerHTML = "";
        actualizarBarraFlotante(); // Asegura que la barra desaparezca
        return;
    }

    let tabla = `<table style="width:100%; border-collapse:collapse;">`;
    let tUSD = 0, tMN = 0;

    carritoActual.forEach((p, index) => {
        const subUSD = p.priceUSD * p.cantidad;
        const subMN = p.priceMN * p.cantidad;
        tUSD += subUSD; tMN += subMN;
        
        tabla += `
            <tr style="border-bottom:1px solid #eee;">
                <td style="padding:10px 0;"><b>${p.name}</b><br><small>$${p.priceUSD} USD</small></td>
                <td style="text-align:center;">
                    <div style="display:flex; align-items:center; justify-content:center; gap:5px;">
                        <button onclick="cambiarCantidad(${index}, -1)" style="padding:2px 8px;">-</button>
                        <span>${p.cantidad}</span>
                        <button onclick="cambiarCantidad(${index}, 1)" style="padding:2px 8px;">+</button>
                    </div>
                </td>
                <td style="text-align:right;">$${subUSD.toFixed(2)}</td>
                <td style="text-align:right;">
                    <button onclick="eliminarDelCarrito(${index}); renderizarCarritoIndependiente();" style="background:none; color:red; font-size:1.2rem; border:none; cursor:pointer;">✕</button>
                </td>
            </tr>`;
    });
    tabla += `</table>`;
    listaDiv.innerHTML = tabla;

    resumenDiv.innerHTML = `
        <div style="font-size:1.2rem; font-weight:bold; margin-bottom:15px; text-align:right;">
            Total: $${tUSD.toFixed(2)} USD / ${tMN.toLocaleString()} MN
        </div>
        <button onclick="enviarPedidoWhatsApp()" style="background:#25D366; width:100%; font-size:1.1rem; padding:15px; font-weight:bold; color:white; border-radius:10px; border:none; cursor:pointer;">🚀 Pedir por WhatsApp</button>
        <button onclick="vaciarCarritoTotal()" style="background:none; color:gray; margin-top:15px; width:100%; text-decoration:underline; border:none; cursor:pointer;">Vaciar Carrito</button>
    `;
}

// También añade esta para que el botón de borrar funcione
function eliminarDelCarrito(index) {
    let tempCart = JSON.parse(localStorage.getItem('carrito')) || [];
    tempCart.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(tempCart));
    carrito = tempCart; // Actualizar variable global
    actualizarBarraFlotante();
}
// --- NUEVA FUNCIÓN PARA CAMBIAR CANTIDAD ---
function cambiarCantidad(index, cambio) {
    let tempCart = JSON.parse(localStorage.getItem('carrito')) || [];
    tempCart[index].cantidad += cambio;

    if (tempCart[index].cantidad <= 0) {
        tempCart.splice(index, 1); // Si llega a 0, se borra
    }

    localStorage.setItem('carrito', JSON.stringify(tempCart));
    carrito = tempCart; 
    renderizarCarritoIndependiente();
    actualizarBarraFlotante();
}

// --- VACIAR CARRITO CON RECARGA ---
function vaciarCarritoTotal() {
    if(confirm('¿Vaciar todo?')) {
        localStorage.removeItem('carrito');
        carrito = [];
        renderizarCarritoIndependiente();
        actualizarBarraFlotante();
    }
}
// Detecta cuando la pestaña vuelve a estar activa o el usuario regresa
window.onpageshow = function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        // Forzamos la actualización de la variable global y la barra
        carrito = JSON.parse(localStorage.getItem('carrito')) || [];
        actualizarBarraFlotante();
    }
};

