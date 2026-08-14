function getTokenFromURL(){
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
}

function showToast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2200);
}

function setError(id, msg){
    document.getElementById(id).textContent = msg;
    const input = document.getElementById(id.replace('Err',''));
    if(input) input.classList.toggle('err', !!msg);
}

async function handleResetPassword(e){
    e.preventDefault();
    let valid = true;

    const token = getTokenFromURL();
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    if(!token){
        showToast('Reset link is missing or invalid.');
        return false;
    }

    if(!newPassword){setError('newPasswordErr', 'Password is required'); valid=false;}
    else if(newPassword.length < 8 || newPassword.length > 20){setError('newPasswordErr','Use 8-20 characters'); valid=false;}
    else setError('newPasswordErr','');

    if(confirmPassword !== newPassword || !confirmPassword){setError('confirmPasswordErr','Passwords don\'t match'); valid=false;}
    else setError('confirmPasswordErr','');

    if(valid){
        try {
            const response = await fetch('http://localhost:3000/api/reset-password', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({token, newPassword})
            });
            const data = await response.json();
            if(!response.ok){
                showToast(data.error || 'Reset failed');
                return false;
            }

            showToast('Password reset successfully! Redirecting to login...');
            setTimeout(() => {
                window.location.href = 'QSLoginScreen.html';}, 2000);
            } catch(err){
                showToast('Could not reach the server');
            }
        }
    return false;
}