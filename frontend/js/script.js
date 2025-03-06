let cart = [];
let total = 0;

function addToCart(itemName, itemPrice) {
    cart.push({ name: itemName, price: itemPrice });
    total += itemPrice;
    updateCart();
}

function updateCart() {
    const cartItems = document.getElementById("cart-items");
    const totalElement = document.getElementById("total");
    cartItems.innerHTML = "";
    cart.forEach(item => {
        const li = document.createElement("li");
        li.textContent = `${item.name} - R$ ${item.price.toFixed(2)}`;
        cartItems.appendChild(li);
    });
    totalElement.textContent = total.toFixed(2);
}

function checkout() {
    const notificationSound = document.getElementById("notificationSound");
    notificationSound.play();
    alert(`Pedido finalizado! Total: R$ ${total.toFixed(2)}`);
    cart = [];
    total = 0;
    updateCart();
}

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

document.querySelectorAll(".item button").forEach(button => {
    button.addEventListener("click", () => {
        const item = button.parentElement;
        const itemName = item.querySelector("h3").textContent;
        const itemPrice = parseFloat(item.querySelector(".price").textContent.replace("R$ ", "").replace(",", "."));
        addToCart(itemName, itemPrice);
    });
});