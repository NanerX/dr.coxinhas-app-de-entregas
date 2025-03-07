// resumo.js

// Recupera os dados do carrinho e a observação do localStorage
const cart = JSON.parse(localStorage.getItem('cart')) || [];
const total = parseFloat(localStorage.getItem('total')) || 0;
let observation = localStorage.getItem('observation') || "";

// Função para salvar a observação no localStorage
function saveObservation() {
    localStorage.setItem('observation', observation);
}

// Função para exibir o resumo do pedido
function displayOrderSummary() {
    const orderItems = document.getElementById("order-items");
    const orderTotal = document.getElementById("order-total");
    const orderObservation = document.getElementById("order-observation");

    if (orderItems && orderTotal && orderObservation) {
        // Limpa a lista de itens
        orderItems.innerHTML = "";

        // Adiciona cada item do carrinho à lista
        cart.forEach(item => {
            const li = document.createElement("li");
            const itemTotal = item.price * item.quantity;
            li.textContent = `${item.name} - ${item.quantity}x - R$ ${itemTotal.toFixed(2)}`;
            orderItems.appendChild(li);
        });

        // Exibe o total e a observação
        orderTotal.textContent = total.toFixed(2);
        orderObservation.textContent = observation || "";
    }
}

// Atualiza a observação ao digitar no campo
const observationField = document.getElementById("observation");
if (observationField) {
    observationField.value = observation; // Preenche o campo com a observação salva
    observationField.addEventListener("input", () => {
        observation = observationField.value;
        saveObservation(); // Salva a observação no localStorage
    });
}

// Exibe o resumo do pedido ao carregar a página
document.addEventListener("DOMContentLoaded", displayOrderSummary);