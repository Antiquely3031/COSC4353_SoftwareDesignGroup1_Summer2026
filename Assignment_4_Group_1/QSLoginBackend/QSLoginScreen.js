function switchTab(tab){
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const adminForm = document.getElementById('adminForm');
  const updateForm = document.getElementById('updateForm');
  const mainToggle = document.getElementById('mainToggle');
  const heading = document.getElementById('heading');
  const subtext = document.getElementById('subtext');
  const footLink = document.getElementById('footLink');
  const adminLink = document.getElementById('adminLink');
  const forgotForm = document.getElementById('forgotForm');

  // Resets forms
  loginForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  adminForm.classList.add('hidden');
  updateForm.classList.add('hidden');
  document.getElementById('manageAccountLink').classList.add('hidden');
  forgotForm.classList.add('hidden');

  loginForm.reset();
  signupForm.reset();
  adminForm.reset();
  updateForm.reset();
  forgotForm.reset();
  clearAllErrors();

  if(tab === 'login'){
    mainToggle.classList.remove('hidden');
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    heading.textContent = 'Welcome';
    subtext.textContent = 'The smart solution to your queue needs.';
    footLink.textContent = 'New here? Create an account';
    footLink.onclick = () => switchTab('signup');
    adminLink.style.display = '';
    adminLink.textContent = 'Administrator Login';
    adminLink.onclick = () => switchTab('admin');
  } else if(tab === 'signup'){
    mainToggle.classList.remove('hidden');
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupForm.classList.remove('hidden');
    heading.textContent = 'Create your account';
    subtext.textContent = 'Set up your first queue in under a minute.';
    footLink.textContent = 'Already have an account? Log in';
    footLink.onclick = () => switchTab('login');
    adminLink.style.display = '';
    adminLink.textContent = 'Administrator Login';
    adminLink.onclick = () => switchTab('admin');
  } else if(tab === 'admin'){
    mainToggle.classList.add('hidden');
    adminForm.classList.remove('hidden');
    heading.textContent = 'Administrator Login';
    subtext.textContent = 'Restricted access for QueueSmart staff.';
    footLink.textContent = 'Back to login';
    footLink.onclick = () => switchTab('login');
    adminLink.style.display = 'none';
  } else if(tab === 'update'){
    mainToggle.classList.add('hidden');
    updateForm.classList.remove('hidden');
    heading.textContent = 'Manage Your Account';
    subtext.textContent = 'Update your name or password using your current credentials.';
    footLink.textContent = 'Back to login';
    footLink.onclick = () => switchTab('login');
    adminLink.style.display = 'none';
  } else if(tab === 'forgot'){
    mainToggle.classList.add('hidden');
    forgotForm.classList.remove('hidden');
    heading.textContent = 'Reset Your Password';
    subtext.textContent = "Enter your email to be sent a reset link.";
    footLink.textContent = 'Back to login';
    footLink.onclick = () => switchTab('login');
    adminLink.style.display = 'none';
  }
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

function clearAllErrors(){
  const errorIds = [
    'loginEmailErr', 'loginPasswordErr',
    'signupNameErr', 'signupEmailErr', 'signupPasswordErr', 'signupConfirmErr',
    'adminEmailErr', 'adminPasswordErr'
  ];
  errorIds.forEach(id => setError(id, ''));
}

function isValidEmail(v){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function handleLogin(e){
  e.preventDefault();
  let valid = true;
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;

  if(!email) {setError('loginEmailErr','Email is required'); valid=false; }
  else if(!isValidEmail(email)) {setError('loginEmailErr','Enter a valid email'); valid=false; }
  else setError('loginEmailErr','');

  if(!pass) {setError('loginPasswordErr','Password is required'); valid=false; }
  else setError('loginPasswordErr','');

  if(valid){
    try {
      const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password: pass})
      });
      const data = await response.json();

      if(!response.ok) {
        showToast(data.error || 'Login failed');
        document.getElementById('manageAccountLink').classList.remove('hidden');
        return false;
      }

      showToast(`Welcome back, ${data.name}`);
      sessionStorage.setItem('qs_user', JSON.stringify(data));
      window.location.href = '../A2_HTML/QSUserDashboard.html';
    } catch(err) {
    showToast('Could not reach the server');
    }
  }
  return false;
}

async function handleAdminLogin(e){
  e.preventDefault();
  let valid = true;
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPassword').value;

  if(!email) {setError('adminEmailErr','Admin email is required'); valid=false; }
  else if(!isValidEmail(email)) {setError('adminEmailErr','Enter a valid email'); valid=false; }
  else setError('adminEmailErr','');

  if(!pass) {setError('adminPasswordErr','Password is required'); valid=false; }
  else setError('adminPasswordErr','');

  if(valid){
    try {
      const response = await fetch('http://localhost:3000/api/admin-login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, password: pass})
      });
      const data = await response.json();

      if(!response.ok) {
        showToast(data.error || 'Admin login failed');
        return false;
      }

      showToast(`Welcome, adminstrator ${data.name}`);
      sessionStorage.setItem('qs_user', JSON.stringify(data));
      window.location.href = '../A2_HTML/AdminDash.html';
    } catch(err) {
    showToast('Could not reach the server');
    }
  }
  return false;
}

async function handleSignup(e){
  e.preventDefault();
  let valid = true;
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;

  if(!name) {setError('signupNameErr','Name is required'); valid=false; }
  else setError('signupNameErr','');

  if(!email) {setError('signupEmailErr','Email is required'); valid=false; }
  else if(!isValidEmail(email)) {setError('signupEmailErr','Enter a valid email'); valid=false; }
  else setError('signupEmailErr','');

  if(!pass) {setError('signupPasswordErr','Password is required'); valid=false; }
  else if(pass.length < 8) {setError('signupPasswordErr','Use at least 8 characters'); valid=false; }
  else setError('signupPasswordErr','');

  if(confirm !== pass || !confirm) {setError('signupConfirmErr','Passwords don\'t match'); valid=false; }
  else setError('signupConfirmErr','');

  if(valid) {
    try {
      const response = await fetch('http://localhost:3000/api/signup', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name, email, password: pass})
      });

      const data = await response.json();

      if(!response.ok) {
        showToast(data.error || 'Signup failed');
        return false;
      }

      showToast(`Account created for ${data.name}`);
    } catch(err) {
      showToast('Could not reach the server.');
    }
  }
  return false;
}

async function handleUpdateAccount(e) {
  e.preventDefault();
  const currentUser = JSON.parse(sessionStorage.getItem('qs_user') || 'null');
  if(!currentUser) {
    showToast('You must be logged in to update your account.');
    return false;
  }

  const email = currentUser.email;
  const currentPassword = document.getElementById('currentPassword').value;
  const newName = document.getElementById('newName').value.trim();
  const newPassword = document.getElementById('newPassword').value;
  
  const response = await fetch('http://localhost:3000/api/user/update', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, currentPassword, newName, newPassword})
  });

  const data = await response.json();
  if(!response.ok) {
    showToast(data.error || 'Update failed');
    return false;
  }

  showToast('Account updated successfuly');
  return false;
}

async function handleForgotPassword(e){
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  if(!email){setError('forgotEmailErr', 'Email is required'); return false;}
  if(!isValidEmail(email)){setError('forgotEmailErr', 'Enter a valid email'); return false;}
  setError('forgotEmailErr','');

  try {
    const response = await fetch('http://localhost:3000/api/forgot-password', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email})
    });

    const data = await response.json();
    showToast(data.message || 'If that email exists, a reset link has been sent.');
  } catch(err) {
    showToast('Could not reach the server');
  }
  return false;
}

