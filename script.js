
console.log("KUJ Lost and Found script loaded");

import { auth, db } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// CHECK ADMINISTRATOR
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

// REPORT LOST ITEM
const lostForm = document.getElementById("lostForm");

if (lostForm) {

    lostForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const result = document.getElementById("formResult");
        const submitButton = lostForm.querySelector('button[type="submit"]');

        const itemName = document.getElementById("itemName").value.trim();
        const category = document.getElementById("category").value;
        const description = document.getElementById("description").value.trim();
        const dateLost = document.getElementById("dateLost").value;
        const location = document.getElementById("location").value.trim();
        const email = document.getElementById("email").value.trim();

        result.textContent = "Sending your report...";
        submitButton.disabled = true;

        try {

            await addDoc(collection(db, "lostItems"), {
                itemName: itemName,
                category: category,
                description: description,
                dateLost: dateLost,
                location: location,
                email: email,
                status: "Pending",
                createdAt: serverTimestamp()
            });

            result.textContent =
                "Lost item reported successfully!";

            lostForm.reset();

        } catch (error) {

            console.error("Lost item submission error:", error);

            result.textContent =
                "Report failed. Please try again.";

        } finally {
            submitButton.disabled = false;
        }

    });
}
