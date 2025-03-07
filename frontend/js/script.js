// Recupera o carrinho e o total do localStorage ou inicializa como vazio
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseFloat(localStorage.getItem('total')) || 0;

// Função para adicionar itens ao carrinho
function addToCart(itemName, itemPrice) {
    cart.push({ name: itemName, price: itemPrice });
    total += itemPrice;
    updateCart();
    updateCartCount(); // Atualiza o contador de itens no carrinho
    saveCart(); // Salva o carrinho no localStorage
}

// Função para atualizar a exibição do carrinho
function updateCart() {
    const cartItems = document.getElementById("cart-items");
    const totalElement = document.getElementById("total");

    if (cartItems && totalElement) {
        cartItems.innerHTML = "";
        cart.forEach(item => {
            const li = document.createElement("li");
            li.textContent = `${item.name} - R$ ${item.price.toFixed(2)}`;
            cartItems.appendChild(li);
        });
        totalElement.textContent = total.toFixed(2);
    }
}

// Função para atualizar o contador de itens no carrinho
function updateCartCount() {
    const cartCount = document.getElementById("cart-count");
    if (cartCount) {
        cartCount.textContent = cart.length; // Atualiza o número de itens no carrinho
    }
}

// Função para finalizar o pedido
function checkout() {
    const notificationSound = document.getElementById("notificationSound");
    if (notificationSound) {
        notificationSound.play();
    }
    alert(`Pedido finalizado! Total: R$ ${total.toFixed(2)}`);
    clearCart(); // Limpa o carrinho após finalizar o pedido
}

// Função para imprimir o comprovante do pedido
function printOrder() {
    const printContent = `
        <h1>Dr. Coxinha</h1>
        <h2>Comprovante de Pedido</h2>
        <ul>
            ${cart.map(item => `<li>${item.name} - R$ ${item.price.toFixed(2)}</li>`).join("")}
        </ul>
        <p>Total: R$ ${total.toFixed(2)}</p>
    `;
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

// Função para limpar o carrinho
function clearCart() {
    cart = [];
    total = 0;
    updateCart();
    updateCartCount(); // Atualiza o contador de itens no carrinho
    saveCart(); // Atualiza o localStorage
}

// Função para salvar o carrinho no localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total.toFixed(2));
}

// Atualiza o carrinho e o contador ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    updateCart();
    updateCartCount();

    // Adiciona eventos aos botões de adicionar ao carrinho (se estiver na página index.html)
    document.querySelectorAll(".item button").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.parentElement;
            const itemName = item.querySelector("h3").textContent;
            const itemPrice = parseFloat(item.querySelector(".price").textContent.replace("R$ ", "").replace(",", "."));
            addToCart(itemName, itemPrice);
        });
    });

    // Adiciona evento ao botão de limpar carrinho (se estiver na página carrinho.html)
    const clearCartButton = document.getElementById("clear-cart");
    if (clearCartButton) {
        clearCartButton.addEventListener("click", clearCart);
    }
});