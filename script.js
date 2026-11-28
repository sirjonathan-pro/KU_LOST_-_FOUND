
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
    getDocs,
    writeBatch,
    serverTimestamp,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";


// =================================
// CLOUDINARY CONFIGURATION
// =================================

const CLOUDINARY_NAME = "Sir-Jonathan";
const UPLOAD_PRESET = "KUJ LOST AND FOUND";


// =================================
// CLOUDINARY IMAGE UPLOAD
// =================================

async function uploadPhoto(file) {

    if (!file) return "";

    if (!file.type.startsWith("image/")) {
        throw new Error("Please select an image.");
    }

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPG, PNG,JPEG and WEBP images are allowed.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must not exceed 5 MB.");
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/image/upload`,
        {
            method: "POST",
            body: formData
        }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Cloudinary error:", data);
        throw new Error(
            data.error?.message || "Photograph upload failed."
        );
    }

    return data.secure_url;
}


// =================================
// IMAGE PREVIEW
// =================================

function setupPhotoPreview(inputId, previewId) {

    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    if (!input || !preview) return;

    input.addEventListener("change", function() {

        preview.replaceChildren();

        const file = input.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            alert("Please select an image.");
            input.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            alert("Image must not exceed 5 MB.");
            input.value = "";
            return;
        }

        const image = document.createElement("img");

        image.src = URL.createObjectURL(file);
        image.alt = "Selected item photograph";
        image.style.maxWidth = "200px";
        image.style.maxHeight = "200px";
        image.style.marginTop = "10px";

        preview.appendChild(image);
    });
}

setupPhotoPreview("itemPhoto", "photoPreview");
setupPhotoPreview("foundItemPhoto", "foundPhotoPreview");


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

            const authorized = await checkAdmin(credential.user);

            if (authorized) {

                result.textContent = "Login successful!";
                window.location.href = "admin.html";

            } else {

                await signOut(auth);
                result.textContent =
                    "Access denied. Not an administrator.";
            }

        } catch (error) {

            console.error("Login error:", error);
            result.textContent = "Login failed: " + error.message;
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
                return;
            }

            adminMessage.textContent =
                "Welcome, Administrator. You are signed in.";

            await loadAdminReports();

        } catch (error) {

            console.error("Dashboard error:", error);
            adminMessage.textContent =
                "Unable to load dashboard: " + error.message;
        }
    });
}


// =================================
// LOAD ADMIN REPORTS
// =================================

async function loadAdminReports() {

    const table = document.getElementById("reportsTable");

    if (!table) return;

    table.textContent = "Loading reports...";

    try {

        const [lostSnapshot, foundSnapshot, contactsSnapshot] =
            await Promise.all([
                getDocs(collection(db, "lost_items")),
                getDocs(collection(db, "found_items")),
                getDocs(collection(db, "private_contacts"))
            ]);

        const contacts = {};

        contactsSnapshot.forEach(function(contact) {
            contacts[contact.id] =
                contact.data().email || "Not provided";
        });

        const reports = [];

        lostSnapshot.forEach(function(item) {
            reports.push({
                id: item.id,
                ...item.data(),
                type: "Lost"
            });
        });

        foundSnapshot.forEach(function(item) {
            reports.push({
                id: item.id,
                ...item.data(),
                type: "Found"
            });
        });

        document.getElementById("totalReports").textContent =
            reports.length;

        document.getElementById("lostReports").textContent =
            lostSnapshot.size;

        document.getElementById("foundReports").textContent =
            foundSnapshot.size;

        document.getElementById("claimedReports").textContent =
            reports.filter(item =>
                ["Claimed", "Returned", "Recovered"].includes(item.status)
            ).length;

        table.replaceChildren();

        if (reports.length === 0) {

            const row = document.createElement("tr");
            const cell = document.createElement("td");

            cell.colSpan = 8;
            cell.textContent = "No reports available yet.";

            row.appendChild(cell);
            table.appendChild(row);

            return;
        }

        reports.forEach(function(item) {

            const row = document.createElement("tr");

            const date =
                item.dateLost || item.dateFound || "Not provided";

            const values = [
                item.itemName,
                item.category,
                item.type,
                date,
                contacts[item.id] || "Not provided",
                item.status
            ];

            values.forEach(function(value) {

                const cell = document.createElement("td");
                cell.textContent = value || "Not provided";
                row.appendChild(cell);
            });

            // Photograph column

            const photoCell = document.createElement("td");

            if (item.photoURL) {

                const image = document.createElement("img");

                image.src = item.photoURL;
                image.alt = "Item photograph";
                image.style.width = "80px";
                image.style.height = "80px";
                image.style.objectFit = "cover";

                photoCell.appendChild(image);

            } else {
                photoCell.textContent = "No photograph";
            }

            row.appendChild(photoCell);

            // STATUS DROPDOWN

            const actionCell = document.createElement("td");
            const statusSelect = document.createElement("select");

            [
                "Lost",
                "Found",
                "Recovered",
                "Claimed",
                "Returned"
            ].forEach(function(status) {

                const option = document.createElement("option");

                option.value = status;
                option.textContent = status;

                if (item.status === status) {
                    option.selected = true;
                }

                statusSelect.appendChild(option);
            });

            // UPDATE BUTTON

            const updateButton = document.createElement("button");

            updateButton.textContent = "Update";
            updateButton.type = "button";

            updateButton.addEventListener("click", async function() {

                updateButton.disabled = true;

                try {

                    const collectionName =
                        item.type === "Lost" ? "lost_items" : "found_items";

                    await updateDoc(
                        doc(db, collectionName, item.id),
                        { status: statusSelect.value }
                    );

                    alert("Report status updated successfully!");

                    await loadAdminReports();

                } catch (error) {

                    console.error("Update error:", error);
                    alert("Update failed: " + error.message);
                    updateButton.disabled = false;
                }
            });

            // DELETE BUTTON

            const deleteButton = document.createElement("button");

            deleteButton.textContent = "Delete";
            deleteButton.type = "button";

            deleteButton.addEventListener("click", async function() {

                if (!confirm("Are you sure you want to delete this report?")) {
                    return;
                }

                deleteButton.disabled = true;

                try {

                    const collectionName =
                        item.type === "Lost" ? "lost_items" : "found_items";

                    const batch = writeBatch(db);

                    batch.delete(doc(db, collectionName, item.id));
                    batch.delete(doc(db, "private_contacts", item.id));

                    await batch.commit();

                    alert("Report deleted successfully!");

                    await loadAdminReports();

                } catch (error) {

                    console.error("Delete error:", error);
                    alert("Delete failed: " + error.message);
                    deleteButton.disabled = false;
                }
            });

            actionCell.append(
                statusSelect,
                updateButton,
                deleteButton
            );

            row.appendChild(actionCell);
            table.appendChild(row);
        });

    } catch (error) {

        console.error("Loading reports error:", error);

        table.textContent =
            "Failed to load reports: " + error.message;
    }
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
// GENERAL ITEM REPORTING
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

        const photoInput = document.getElementById(config.photoId);

        const photoFile = photoInput?.files[0] || null;

        result.textContent = "Submitting report...";

        button.disabled = true;

        try {

            let photoURL = "";

            if (photoFile) {

                result.textContent = "Uploading photograph...";

                photoURL = await uploadPhoto(photoFile);
            }

            result.textContent = "Saving report...";

            const batch = writeBatch(db);

            const reportRef =
                doc(collection(db, config.collectionName));

            batch.set(reportRef, {

                itemName: itemName,
                category: category,
                description: description,
                [config.dateField]: date,
                location: location,
                photoURL: photoURL,
                status: config.status,
                createdAt: serverTimestamp()

            });

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

            result.textContent = config.successMessage;

            form.reset();

            const preview = document.getElementById(config.previewId);

            if (preview) {
                preview.replaceChildren();
            }

        } catch (error) {

            console.error("Reporting error:", error);

            result.textContent =
                "Reporting failed: " + error.message;

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

    photoId: "itemPhoto",
    previewId: "photoPreview",

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

    photoId: "foundItemPhoto",
    previewId: "foundPhotoPreview",

    dateField: "dateFound",
    collectionName: "found_items",

    status: "Found",

    successMessage: "Found item reported successfully!"

});


// =================================
// SEARCH LOST AND FOUND ITEMS
// =================================

const searchForm = document.getElementById("searchForm");

if (searchForm) {

    searchForm.addEventListener("submit", async function(event) {

        event.preventDefault();

        const searchTerm =
            document.getElementById("searchTerm")
            .value.trim().toLowerCase();

        const searchCategory =
            document.getElementById("searchCategory").value;

        const searchType =
            document.getElementById("searchType").value;

        const searchResults =
            document.getElementById("searchResults");

        searchResults.textContent = "Searching...";

        try {

            const [lostSnapshot, foundSnapshot] =
                await Promise.all([
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

                const nameMatch =
                    !searchTerm ||
                    String(item.itemName || "")
                    .toLowerCase()
                    .includes(searchTerm);

                const categoryMatch =
                    !searchCategory ||
                    item.category === searchCategory;

                const typeMatch =
                    !searchType ||
                    item.reportType === searchType;

                return nameMatch && categoryMatch && typeMatch;
            });

            searchResults.replaceChildren();

            const heading = document.createElement("h3");
            heading.textContent = "Search Results";

            searchResults.appendChild(heading);

            if (matches.length === 0) {
                searchResults.append("No matching items found.");
                return;
            }

            matches.forEach(function(item) {

                const card = document.createElement("div");

                card.className = "search-result";

                if (item.photoURL) {

                    const image = document.createElement("img");

                    image.src = item.photoURL;
                    image.alt = "Photograph of " + item.itemName;
                    image.style.maxWidth = "200px";
                    image.style.maxHeight = "200px";

                    card.appendChild(image);
                }

                const details = [
                    ["Item Name", item.itemName],
                    ["Report Type", item.reportType],
                    ["Category", item.category],
                    ["Description", item.description],
                    ["Location", item.location],
                    ["Status", item.status]
                ];

                details.forEach(function(detail) {

                    const paragraph = document.createElement("p");

                    paragraph.textContent =
                        detail[0] + ": " +
                        (detail[1] || "Not provided");

                    card.appendChild(paragraph);
                });

                searchResults.appendChild(card);
            });

        } catch (error) {

            console.error("Search error:", error);

            searchResults.textContent =
                "Search failed: " + error.message;
        }
    });
}
