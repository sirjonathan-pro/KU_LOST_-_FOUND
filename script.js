console.log("KUJ Lost and Found script loaded");
import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// Check whether a user is an authorized administrator
async function checkAdmin(user) {
    const adminRef = doc(db, "admins", user.uid);
    const adminSnapshot = await getDoc(adminRef);

    return adminSnapshot.exists() &&
           adminSnapshot.data().role === "admin";
}

// ADMIN LOGIN
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        const result = document.getElementById("loginResult");

        result.textContent = "Signing in...";

        try {
            const userCredential =
                await signInWithEmailAndPassword(auth, email, password);

            const authorized = await checkAdmin(userCredential.user);

            if (authorized) {
                result.textContent = "Login successful!";
                window.location.href = "admin.html";
            } else {
                await signOut(auth);
                result.textContent = "Access denied. Not an administrator.";
            }

        } catch (error) {
            console.error(error);
            result.textContent = "Login failed. Check your email and password.";
        }
    });
}

// PROTECT ADMIN DASHBOARD
const adminMessage = document.getElementById("adminMessage");

if (adminMessage) {
    onAuthStateChanged(auth, async function(user) {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        try {
            const authorized = await checkAdmin(user);

            if (!authorized) {
                await signOut(auth);
                window.location.href = "login.html";
            } else {
                adminMessage.textContent =
                    "Welcome, Administrator. You are signed in.";
            }

        } catch (error) {
            console.error(error);
            adminMessage.textContent =
                "Unable to verify administrator access.";
            await signOut(auth);
            window.location.href = "login.html";
        }
    });
}

// ADMIN LOGOUT
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async function() {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            console.error(error);
            alert("Logout failed. Please try again.");
        }
    });
}
