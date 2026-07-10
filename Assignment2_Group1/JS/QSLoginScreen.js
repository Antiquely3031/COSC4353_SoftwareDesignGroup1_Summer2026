function switchTab(tab){
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const adminForm = document.getElementById('adminForm');
  const mainToggle = document.getElementById('mainToggle');
  const heading = document.getElementById('heading');
  const subtext = document.getElementById('subtext');
  const footLink = document.getElementById('footLink');
  const adminLink = document.getElementById('adminLink');

  // Resets forms
  loginForm.classList.add('hidden');
  signupForm.classList.add('hidden');
  adminForm.classList.add('hidden');

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

function isValidEmail(v){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function handleLogin(e){
  e.preventDefault();
  let valid = true;
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;

  if(!email){ setError('loginEmailErr','Email is required'); valid=false; }
  else if(!isValidEmail(email)){ setError('loginEmailErr','Enter a valid email'); valid=false; }
  else setError('loginEmailErr','');

  if(!pass){ setError('loginPasswordErr','Password is required'); valid=false; }
  else setError('loginPasswordErr','');

  if(valid){
    // Real auth API goes here
    showToast('Login validated — The API will be connected later');
  }
  return false;
}

function handleSignup(e){
  e.preventDefault();
  let valid = true;
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pass = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;

  if(!name){ setError('signupNameErr','Name is required'); valid=false; }
  else if(name.length > 50){ setError('signupNameErr','Name must be under 50 characters in length.')}
  else setError('signupNameErr','');

  if(!email){ setError('signupEmailErr','Email is required'); valid=false; }
  else if(!isValidEmail(email)){ setError('signupEmailErr','Enter a valid email'); valid=false; }
  else setError('signupEmailErr','');

  if(!pass){ setError('signupPasswordErr','Password is required'); valid=false; }
  else if(pass.length < 8){ setError('signupPasswordErr','Use at least 8 characters'); valid=false; }
  else if(pass.length > 20){ setError('signupPasswordErr','Password must be between 8 and 20 characters in length'); valid=false; }
  else setError('signupPasswordErr','');

  if(confirm !== pass || !confirm){ setError('signupConfirmErr','Passwords don\'t match'); valid=false; }
  else setError('signupConfirmErr','');

  if(valid){
    // Plug in your real signup API call here
    showToast('Signup validated — wire up your API here');
  }
  return false;
}
