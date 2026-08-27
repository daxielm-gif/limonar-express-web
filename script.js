const API_URL = '/api/productos';

let productosGlobales = [];
let carrito = JSON.parse(localStorage.getItem('carrito')) || [];
let limiteActual = 8;
let listaFiltradaActual = [];

async function cargarProductos() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) throw new Error('Error al cargar productos');
        
        productosGlobales = await respuesta.json();
        productosGlobales = productosGlobales.map(p => ({
            ...p,
            stock: parseInt(p.stock) || 0,
            priceUSD: parseFloat(p.priceUSD) || 0,
            priceMN: parseFloat(p.priceMN) || 0
        }));

        listaFiltradaActual = productosGlobales;
        mostrarEnGrid(listaFiltradaActual);
        actualizarBarraFlotante();
    } catch (e) {
        console.error("Error cargando productos:", e);
        const grid = document.getElementById('tienda-productos');
        if (grid) {
            grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; padding:30px; color:#c0392b;">
                No se pudieron cargar los productos.
            </p>`;
        }
    }
}

function mostrarEnGrid(lista) {
    const grid = document.getElementById('tienda-productos');
    const btnMas = document.getElementById('btn-cargar-mas');
    if (!grid) return;

    grid.innerHTML = "";
    const productosVisibles = lista.slice(0, limiteActual);

    if (productosVisibles.length === 0) {
        grid.innerHTML = "<p style='grid-column:1/-1; text-align:center; padding:30px; color:var(--texto-suave);'>No hay productos que coincidan.</p>";
        if (btnMas) btnMas.style.display = 'none';
        return;
    }

    productosVisibles.forEach(p => {
        let stockLabel = '';
        if (p.stock <= 0) stockLabel = '<span style="color:#c0392b; font-size:0.7rem; font-weight:600;">⚠ Agotado</span>';
        else if (p.stock < 3) stockLabel = `<span style="color:#d4a017; font-size:0.7rem; font-weight:600;">¡Últimos ${p.stock}!</span>`;

        let preciosHTML = '';
        if (p.priceUSD > 0 && p.priceMN > 0) {
            preciosHTML = `<div class="precio-usd">$${p.priceUSD} USD</div><div class="precio-mn">${p.priceMN.toLocaleString()} MN</div>`;
        } else if (p.priceUSD > 0) {
            preciosHTML = `<div class="precio-usd">$${p.priceUSD} USD</div>`;
        } else {
            preciosHTML = `<div class="precio-usd" style="color:var(--dorado);">${p.priceMN.toLocaleString()} MN</div>`;
        }

        grid.innerHTML += `
        <div class="product-card" onclick="verDetalle('${p.id}')">
            <div class="img-container">
                <span class="tag">${p.category || 'Otros'}</span>
                <img src="${p.image || ''}" onerror="this.src='https://via.placeholder.com/300x200/e8f5ee/1a7a4a?text=Limonar+Express'" loading="lazy">
            </div>
            <div class="card-info">
                <div class="card-zona">📍 ${p.location || ''} ${stockLabel}</div>
                <div class="card-nombre">${p.name}</div>
                <div class="prices">${preciosHTML}</div>
                <button class="btn-carrito" onclick="event.stopPropagation(); agregarAlCarrito('${p.id}')">🛒 Añadir al carrito</button>
            </div>
        </div>`;
    });

    if (btnMas) btnMas.style.display = (lista.length > limiteActual) ? 'block' : 'none';
}

function cargarMasProductos() {
    limiteActual += 8;
    mostrarEnGrid(listaFiltradaActual);
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
    if (itemExistente) itemExistente.cantidad += 1;
    else carrito.push({ ...prod, cantidad: 1 });
    
    guardarCarrito();
    alert(`Añadido: ${prod.name}`);
}

function actualizarBarraFlotante() {
    let cartDiv = document.getElementById('carrito-flotante');
    if (!cartDiv) return;

    const carritoMemoria = JSON.parse(localStorage.getItem('carrito')) || [];
    if (carritoMemoria.length === 0) {
        cartDiv.style.display = 'none';
        return;
    }

    let totalItems = carritoMemoria.reduce((sum, p) => sum + p.cantidad, 0);
    let totalUSD = carritoMemoria.reduce((sum, p) => sum + (p.priceUSD * p.cantidad), 0);

    cartDiv.style.display = 'block';
    cartDiv.innerHTML = `
        <div class="cart-minimized" onclick="window.location.href='carrito.html'">
            <span>🛒 ${totalItems} producto${totalItems > 1 ? 's' : ''}</span>
            <span>Total $${totalUSD.toFixed(2)} USD →</span>
        </div>
    `;
}

function verDetalle(id) {
    const prod = productosGlobales.find(p => p.id === id);
    if (!prod) return;
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
    listaFiltradaActual = productosGlobales.filter(p => p.location === zona);
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

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const esOscuro = document.body.classList.contains('dark-mode');
    const icono = document.getElementById('theme-icon');
    if (icono) icono.innerText = esOscuro ? '☀️' : '🌙';
    localStorage.setItem('tema', esOscuro ? 'oscuro' : 'claro');
}

function renderizarCarritoIndependiente() {
    const listaDiv = document.getElementById('lista-carrito-detallada');
    const resumenDiv = document.getElementById('resumen-pago');
    if (!listaDiv) return;

    const carritoActual = JSON.parse(localStorage.getItem('carrito')) || [];
    if (carritoActual.length === 0) {
        listaDiv.innerHTML = "<h3 style='text-align:center;'>Tu carrito está vacío asere.</h3>";
        if (resumenDiv) resumenDiv.innerHTML = "";
        actualizarBarraFlotante();
        return;
    }

    let tabla = `<table style="width:100%; border-collapse:collapse;">`;
    let tUSD = 0, tMN = 0;

    carritoActual.forEach((p, index) => {
        const subUSD = p.priceUSD * p.cantidad;
        const subMN = (p.priceMN || 0) * p.cantidad;
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

    if (resumenDiv) {
        resumenDiv.innerHTML = `
            <div style="font-size:1.2rem; font-weight:bold; margin-bottom:15px; text-align:right;">
                Total: $${tUSD.toFixed(2)} USD / ${tMN.toLocaleString()} MN
            </div>
            <button onclick="enviarPedidoWhatsApp()" style="background:#25D366; width:100%; font-size:1.1rem; padding:15px; font-weight:bold; color:white; border-radius:10px; border:none; cursor:pointer;">🚀 Pedir por WhatsApp</button>
            <button onclick="vaciarCarritoTotal()" style="background:none; color:gray; margin-top:15px; width:100%; text-decoration:underline; border:none; cursor:pointer;">Vaciar Carrito</button>
        `;
    }
}

function eliminarDelCarrito(index) {
    let tempCart = JSON.parse(localStorage.getItem('carrito')) || [];
    tempCart.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(tempCart));
    carrito = tempCart;
    actualizarBarraFlotante();
}

function cambiarCantidad(index, cambio) {
    let tempCart = JSON.parse(localStorage.getItem('carrito')) || [];
    tempCart[index].cantidad += cambio;
    if (tempCart[index].cantidad <= 0) tempCart.splice(index, 1);
    localStorage.setItem('carrito', JSON.stringify(tempCart));
    carrito = tempCart;
    renderizarCarritoIndependiente();
    actualizarBarraFlotante();
}

function vaciarCarritoTotal() {
    if (confirm('¿Vaciar todo?')) {
        localStorage.removeItem('carrito');
        carrito = [];
        renderizarCarritoIndependiente();
        actualizarBarraFlotante();
    }
}

window.onload = () => {
    cargarProductos();
    if (!document.getElementById('carrito-flotante')) {
        const c = document.createElement('div');
        c.id = 'carrito-flotante';
        document.body.appendChild(c);
    }
    if (localStorage.getItem('tema') === 'oscuro') {
        document.body.classList.add('dark-mode');
        const icono = document.getElementById('theme-icon');
        if (icono) icono.innerText = '☀️';
    }
    actualizarBarraFlotante();
};

window.onpageshow = function(event) {
    if (event.persisted || (window.performance && window.performance.navigation.type === 2)) {
        carrito = JSON.parse(localStorage.getItem('carrito')) || [];
        actualizarBarraFlotante();
    }
};