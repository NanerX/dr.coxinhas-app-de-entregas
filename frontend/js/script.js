// script.js

// Recupera o carrinho e o total do localStorage ou inicializa como vazio
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseFloat(localStorage.getItem('total')) || 0;

// Função para salvar o carrinho no localStorage
function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total.toFixed(2)); // Salva o total com duas casas decimais
}

// Função para adicionar itens ao carrinho
function addToCart(itemName, itemPrice) {
    const existingItem = cart.find(item => item.name === itemName);
    if (existingItem) {
        existingItem.quantity += 1; // Aumenta a quantidade se o item já existir
    } else {
        cart.push({ name: itemName, price: itemPrice, quantity: 1 }); // Adiciona novo item
    }
    updateCart();
    updateCartCount();
    saveCart(); // Salva o carrinho e o total
}

// Função para atualizar a exibição do carrinho
function updateCart() {
    const cartItems = document.getElementById("cart-items");
    const totalElement = document.getElementById("total");

    if (cartItems && totalElement) {
        cartItems.innerHTML = "";
        total = 0; // Reinicia o total para recalcular

        cart.forEach((item, index) => {
            const li = document.createElement("li");

            // Nome do item com classe específica
            const itemName = document.createElement("span");
            itemName.textContent = `${item.name}`;
            itemName.classList.add("item-name");

            // Preço do item
            const itemPrice = document.createElement("span");
            itemPrice.textContent = ` - R$ ${item.price.toFixed(2)}`;

            // Campo de quantidade
            const quantityInput = document.createElement("input");
            quantityInput.type = "number";
            quantityInput.value = item.quantity;
            quantityInput.min = 1;
            quantityInput.classList.add("quantity-input");
            quantityInput.addEventListener("change", () => updateQuantity(index, quantityInput.value));

            // Botão de remover
            const removeButton = document.createElement("button");
            removeButton.innerHTML = '<i class="fas fa-trash"></i>';
            removeButton.classList.add("remove-button");
            removeButton.addEventListener("click", () => removeItem(index));

            // Adiciona elementos ao item da lista
            li.appendChild(itemName);
            li.appendChild(itemPrice);
            li.appendChild(quantityInput);
            li.appendChild(removeButton);
            cartItems.appendChild(li);

            // Atualiza o total
            total += item.price * item.quantity;
        });

        // Exibe o total atualizado
        totalElement.textContent = total.toFixed(2);
        saveCart(); // Salva o carrinho e o total no localStorage
    }
}

// Função para atualizar a quantidade de um item
function updateQuantity(index, newQuantity) {
    if (newQuantity >= 1) {
        cart[index].quantity = parseInt(newQuantity, 10);
        updateCart();
        saveCart();
    }
}

// Função para remover um item do carrinho
function removeItem(index) {
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        updateCart();
        updateCartCount();
        saveCart();
    }
}

// Função para atualizar o contador de itens no carrinho
function updateCartCount() {
    const cartCount = document.getElementById("cart-count");
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
}

// Função para limpar o carrinho
function clearCart() {
    cart = [];
    total = 0;
    updateCart();
    updateCartCount();
    saveCart();
}

// Atualiza o carrinho e o contador ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
    updateCart();
    updateCartCount();

    // Adiciona eventos aos botões de adicionar ao carrinho
    document.querySelectorAll(".item button").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.parentElement;
            const itemName = item.querySelector("h3").textContent;
            const itemPrice = parseFloat(item.querySelector(".price").textContent.replace("R$ ", "").replace(",", "."));
            addToCart(itemName, itemPrice);
        });
    });

    // Adiciona evento ao botão de limpar carrinho
    const clearCartButton = document.getElementById("clear-cart");
    if (clearCartButton) {
        clearCartButton.addEventListener("click", clearCart);
    }
});