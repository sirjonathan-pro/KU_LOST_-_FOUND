
console.log("KUJ Lost and Found system loaded");

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
    getDocs,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// =================================
// ADMIN AUTHORIZATION
// =================================

async function checkAdmin(user) {
    const adminRef = doc(db, "admins", user.uid);
    const snapshot = await getDoc(adminRef);

    return snapshot.exists() &&
           snapshot.data().role === "admin";
}

// =================================
// ADMIN LOGIN
// =================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = document.getElementById("adminEmail").value.trim();
        const password = document.getElementById("adminPassword").value;
        const result = document.getElementById("loginResult");

        result.textContent = "Signing in...";

        try {
            const credential =
                await signInWithEmailAndPassword(auth, email, password);

            if (await checkAdmin(credential.user)) {
                result.textContent = "Login successful!";
                window.location.href = "admin.html";
            } else {
                await signOut(auth);
                result.textContent = "Access denied. Not an administrator.";
            }

        } catch (error) {
            console.error("Login error:", error);
            result.textContent = "Login failed. Check your details.";
        }
    });
}

// =================================
// PROTECT ADMIN DASHBOARD
// =================================

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
            console.error("Admin verification error:", error);
            adminMessage.textContent =
                "Unable to verify administrator access.";
        }
    });
}

// =================================
// ADMIN LOGOUT
// =================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener("click", async function() {
        try {
            await signOut(auth);
            window.location.href = "login.html";
        } catch (error) {
            console.error("Logout error:", error);
            alert("Logout failed. Please try again.");
        }
    });
}

// =================================
// GENERAL ITEM REPORTING FUNCTION
// =================================

async function submitItemReport(config) {

    const form = document.getElementById(config.formId);

    if (!form) return;

    form.addEventListener("submit", async function(event) {

        event.preventDefault();

        const result = document.getElementById(config.resultId);
        const button = form.querySelector('button[type="submit"]');

        const itemName =
            document.getElementById(config.nameId).value.trim();

        const category =
            document.getElementById(config.categoryId).value;

        const description =
            document.getElementById(config.descriptionId).value.trim();

        const date =
            document.getElementById(config.dateId).value;

        const location =
            document.getElementById(config.locationId).value.trim();

        const email =
            document.getElementById(config.emailId).value.trim();

        result.textContent = "Submitting report...";
        button.disabled = true;

        try {

            const batch = writeBatch(db);

            // Create a new report document
            const reportRef = doc(collection(db, config.collectionName));

            // Public report: no contact email is stored here
            batch.set(reportRef, {
                itemName: itemName,
                category: category,
                description: description,
                [config.dateField]: date,
                location: location,
                status: config.status,
                createdAt: serverTimestamp()
            });

            // Private contact information
            const contactRef = doc(
                db,
                "private_contacts",
                reportRef.id
            );

            batch.set(contactRef, {
                email: email,
                type: config.status,
                createdAt: serverTimestamp()
            });

            await batch.commit();

            result.textContent =
                config.successMessage;

            form.reset();

        } catch (error) {

            console.error("Item reporting error:", error);

            result.textContent =
                "Reporting failed: " + error.code;

        } finally {
            button.disabled = false;
        }
    });
}

// =================================
// REPORT LOST ITEM
// =================================

submitItemReport({
    formId: "lostForm",
    resultId: "formResult",
    nameId: "itemName",
    categoryId: "category",
    descriptionId: "description",
    dateId: "dateLost",
    locationId: "location",
    emailId: "email",
    dateField: "dateLost",
    collectionName: "lost_items",
    status: "Lost",
    successMessage: "Lost item reported successfully!"
});

// =================================
// REPORT FOUND ITEM
// =================================

submitItemReport({
    formId: "foundForm",
    resultId: "foundResult",
    nameId: "foundItemName",
    categoryId: "foundCategory",
    descriptionId: "foundDescription",
    dateId: "dateFound",
    locationId: "foundLocation",
    emailId: "finderEmail",
    dateField: "dateFound",
    collectionName: "found_items",
    status: "Found",
    successMessage: "Found item reported successfully!"
});

// =================================
// SEARCH LOST AND FOUND ITEMS
// =================================

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

if (searchInput && searchResults) {

    searchInput.addEventListener("input", async function() {

        const searchTerm = searchInput.value.trim().toLowerCase();

        searchResults.replaceChildren();

        if (!searchTerm) {
            searchResults.textContent = "Enter an item name to search.";
            return;
        }

        searchResults.textContent = "Searching...";

        try {

            const [lostSnapshot, foundSnapshot] = await Promise.all([
                getDocs(collection(db, "lost_items")),
                getDocs(collection(db, "found_items"))
            ]);

            const reports = [];

            lostSnapshot.forEach(function(item) {
                reports.push({
                    ...item.data(),
                    reportType: "Lost"
                });
            });

            foundSnapshot.forEach(function(item) {
                reports.push({
                    ...item.data(),
                    reportType: "Found"
                });
            });

            const matches = reports.filter(function(item) {

                const searchableText = [
                    item.itemName,
                    item.category,
                    item.description,
                    item.location,
                    item.reportType
                ].join(" ").toLowerCase();

                return searchableText.includes(searchTerm);
            });

            searchResults.replaceChildren();

            if (matches.length === 0) {
                searchResults.textContent = "No matching items found.";
                return;
            }

            matches.forEach(function(item) {

                const card = document.createElement("div");
                card.className = "search-result";

                const heading = document.createElement("h3");
                heading.textContent = item.itemName;

                const type = document.createElement("p");
                type.textContent = "Report type: " + item.reportType;

                const category = document.createElement("p");
                category.textContent = "Category: " + item.category;

                const description = document.createElement("p");
                description.textContent = "Description: " + item.description;

                const location = document.createElement("p");
                location.textContent = "Location: " + item.location;

                const status = document.createElement("p");
                status.textContent = "Status: " + item.status;

                card.append(
                    heading,
                    type,
                    category,
                    description,
                    location,
                    status
                );

                searchResults.appendChild(card);
            });

        } catch (error) {

            console.error("Search error:", error);
            searchResults.textContent =
                "Search failed. Please try again.";
        }
    });
}
