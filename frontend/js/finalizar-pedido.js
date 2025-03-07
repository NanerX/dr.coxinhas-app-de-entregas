// finalizar-pedido.js

// Função para confirmar o pedido
document.getElementById("customer-form").addEventListener("submit", function (event) {
    event.preventDefault(); // Impede o envio do formulário

    // Recupera os dados do formulário
    const name = document.getElementById("name").value;
    const phone = document.getElementById("phone").value;
    const address = document.getElementById("address").value;
    const payment = document.getElementById("payment").value;

    // Recupera os dados do carrinho e a observação do localStorage
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const total = parseFloat(localStorage.getItem('total')) || 0;
    const observation = localStorage.getItem('observation') || "Nenhuma observação.";

    // Cria a mensagem do pedido
    let message = `*Novo Pedido Dr. Coxinha!*\n\n`;
    message += `*Nome:* ${name}\n`;
    message += `*Telefone:* ${phone}\n`;
    message += `*Endereço:* ${address}\n`;
    message += `*Forma de Pagamento:* ${payment}\n`;
    message += `\n*Itens do Pedido:*\n`;
    cart.forEach(item => {
        message += `- ${item.name} (${item.quantity}x) - R$ ${item.price.toFixed(2)}\n`;
    });
    message += `\n*Total:* R$ ${total.toFixed(2)}\n`;
    message += `*Observação:* ${observation}\n`;

    // Codifica a mensagem para uso no link do WhatsApp
    const encodedMessage = encodeURIComponent(message);

    // Cria o link do WhatsApp
    const whatsappLink = `https://wa.me/557996278269?text=${encodedMessage}`;

    // Abre o link no WhatsApp
    window.open(whatsappLink, '_blank');

    // Limpa o carrinho e redireciona para a página inicial
    localStorage.removeItem('cart');
    localStorage.removeItem('total');
    localStorage.removeItem('observation');
    window.location.href = "index.html";
});