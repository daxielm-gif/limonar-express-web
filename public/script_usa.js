// --- BUSCADOR EXTERNO ---
function buscarExterno(tienda) {
    const query = document.getElementById('usa-search-input').value;
    if (!query) return alert("Asere, escribe algo para buscar.");

    let url = "";
    if (tienda === 'amazon') url = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    if (tienda === 'ebay') url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}`;
    if (tienda === 'shein') url = `https://www.shein.com/pdsearch/${encodeURIComponent(query)}`;

    window.open(url, '_blank');
}

// --- CALCULADORA INTERNA ---
function calcularPrecioUSA() {
    const p = parseFloat(document.getElementById('usa-price').value);
    const w = parseFloat(document.getElementById('usa-weight').value);
    
    if (isNaN(p) || isNaN(w)) return alert("Pon precio y peso");

    // Tu fórmula de siempre
    const total = (p * 1.07) + (w * 7) + 5;
    
    const resDiv = document.getElementById('usa-res');
    resDiv.innerText = `Costo total en Cuba: $${total.toFixed(2)} USD`;
    resDiv.style.display = 'block';
}

// --- ENVÍO DE LINK POR WHATSAPP ---
function enviarLinkWhatsApp() {
    const link = document.getElementById('product-link').value;
    const precioCalculado = document.getElementById('usa-res').innerText;

    if (!link) return alert("Pega el link del producto primero.");

    let mensaje = `¡Hola! Quiero encargar este producto de USA:%0A%0A`;
    mensaje += `🔗 Link: ${encodeURIComponent(link)}%0A%0A`;
    
    if (precioCalculado) {
        mensaje += `📊 ${precioCalculado}`;
    }

    window.open(`https://wa.me/5358956989?text=${mensaje}`, '_blank');
}