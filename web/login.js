document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const user = document.getElementById('username').value;
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-message');

    if (user === 'rummy' && pass === '1234') {
        window.location.href = 'index.html';
    } else {
        errorMsg.textContent = 'Usuario o contraseña incorrectos.';
    }
});