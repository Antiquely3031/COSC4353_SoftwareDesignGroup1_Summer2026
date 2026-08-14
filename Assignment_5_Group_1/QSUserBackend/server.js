async function handleLogin(e) {
    e.preventDefault();

    let valid = true;

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email) {
        setError("loginEmailErr", "Email is required");
        valid = false;
    } else if (!isValidEmail(email)) {
        setError("loginEmailErr", "Enter a valid email");
        valid = false;
    } else {
        setError("loginEmailErr", "");
    }

    if (!password) {
        setError("loginPasswordErr", "Password is required");
        valid = false;
    } else {
        setError("loginPasswordErr", "");
    }

    if (!valid) {
        return false;
    }

    try {
        const response = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            showToast(data.error || "Login failed.");
            return false;
        }

        sessionStorage.setItem("qs_user", JSON.stringify({
            id: data.id,
            name: data.name,
            email: data.email,
            role: data.role
        }));

        window.location.href = "../A2_HTML/QSUserDashboard.html";

    } catch (error) {
        console.error("Login error:", error);
        showToast("Unable to connect to the backend.");
    }

    return false;
}
