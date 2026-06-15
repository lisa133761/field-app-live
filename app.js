// ==========================================
// CONFIGURATION: ADD YOUR GITHUB DETAILS HERE
// ==========================================
const GITHUB_PAT = "https://script.google.com/macros/s/AKfycbx33CB9xSt5Y0j8dNBsP5GYxY9wuBwzLma8SUU69ioMl20EdRQlP-QQg3-VjeQeUuvnbQ/exec"; 
const REPO_OWNER = "lisa133761";
const REPO_NAME = "billing-data"; // Your private repo name
const FILE_PATH = "collections_data.json"; // File to store data
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;

// Global variable to hold the file's current SHA hash (required by GitHub to update)
let currentFileSha = "";
let cloudData = [];

// ==========================================
// UI LOGIC
// ==========================================

function calculateTotal() {
    const current = parseFloat(document.getElementById('currentBill').value) || 0;
    const past = parseFloat(document.getElementById('lastMonthDue').value) || 0;
    document.getElementById('totalAmountDisplay').innerText = `₹${current + past}`;
}

// Show/Hide Complaint Status based on selection
document.getElementById('complaintReason').addEventListener('change', function() {
    const statusDiv = document.getElementById('complaintStatusDiv');
    if (this.value !== "None") {
        statusDiv.style.display = "block";
    } else {
        statusDiv.style.display = "none";
    }
});

// Update Dashboard Numbers
function updateDashboard() {
    let totalCollected = 0;
    let totalPending = 0;

    cloudData.forEach(record => {
        if (record.paymentStatus === "Paid") {
            totalCollected += record.totalAmount;
        } else {
            totalPending += record.totalAmount;
        }
    });

    document.getElementById('dash-collected').innerText = `₹${totalCollected}`;
    document.getElementById('dash-pending').innerText = `₹${totalPending}`;
}

// ==========================================
// GITHUB API LOGIC (BACKEND)
// ==========================================

// 1. Fetch Data from GitHub
async function fetchData() {
    try {
        const response = await fetch(`${API_URL}?t=${Date.now()}`, {
            headers: {
                "Authorization": `token ${GITHUB_PAT}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (response.status === 404) {
            // File doesn't exist yet, we will create it on first submission
            cloudData = [];
            return;
        }

        if (!response.ok) throw new Error("Failed to fetch data");

        const data = await response.json();
        currentFileSha = data.sha; // Save SHA for updating
        
        // Decode Base64 content from GitHub
        const decodedContent = decodeURIComponent(escape(atob(data.content)));
        cloudData = JSON.parse(decodedContent);
        
        updateDashboard();

    } catch (error) {
        console.error("Fetch Error:", error);
        alert("Could not load latest data. Check internet or token.");
    }
}

// 2. Update Data to GitHub
async function updateData(newRecord) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "Saving...";
    submitBtn.disabled = true;

    // Append new record to existing data
    cloudData.push(newRecord);

    // Encode back to Base64
    const updatedContent = btoa(unescape(encodeURIComponent(JSON.stringify(cloudData, null, 2))));

    const bodyData = {
        message: `New billing entry for ${newRecord.customerName}`,
        content: updatedContent
    };

    // If file exists, attach the SHA to update it
    if (currentFileSha) {
        bodyData.sha = currentFileSha;
    }

    try {
        const response = await fetch(API_URL, {
            method: "PUT",
            headers: {
                "Authorization": `token ${GITHUB_PAT}`,
                "Accept": "application/vnd.github.v3+json",
                "Content-Type": "application/json"
            },
            body: JSON.stringify(bodyData)
        });

        if (!response.ok) throw new Error("Failed to push data to GitHub");

        const result = await response.json();
        currentFileSha = result.content.sha; // Update SHA for next time
        
        alert("✅ Entry Saved Successfully!");
        document.getElementById('billingForm').reset();
        calculateTotal();
        updateDashboard();

    } catch (error) {
        console.error("Save Error:", error);
        alert("Failed to save. Please try again.");
    } finally {
        submitBtn.innerText = "Save Entry to Cloud";
        submitBtn.disabled = false;
    }
}

// ==========================================
// FORM SUBMISSION HANDLER
// ==========================================

document.getElementById('billingForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const currentBill = parseFloat(document.getElementById('currentBill').value) || 0;
    const lastMonthDue = parseFloat(document.getElementById('lastMonthDue').value) || 0;
    
    const newRecord = {
        id: "REC-" + Date.now(),
        date: new Date().toISOString(),
        agentId: document.getElementById('agentId').value,
        customerName: document.getElementById('customerName').value,
        customerId: document.getElementById('customerId').value,
        phone: document.getElementById('phone').value,
        currentBill: currentBill,
        lastMonthDue: lastMonthDue,
        totalAmount: currentBill + lastMonthDue,
        paymentStatus: document.querySelector('input[name="payStatus"]:checked').value,
        paymentMethod: document.querySelector('input[name="payMethod"]:checked').value,
        complaintReason: document.getElementById('complaintReason').value,
        complaintStatus: document.getElementById('complaintReason').value !== "None" ? document.getElementById('complaintStatus').value : "N/A"
    };

    updateData(newRecord);
});

// ==========================================
// DATA EXPORT (DOWNLOAD AS JSON)
// ==========================================
function downloadData() {
    if (cloudData.length === 0) {
        alert("No data available to download.");
        return;
    }
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cloudData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "field_collection_data_" + new Date().toLocaleDateString() + ".json");
    document.body.appendChild(downloadAnchorNode); 
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// ==========================================
// INITIALIZATION & SERVICE WORKER
// ==========================================

// Load data on start
window.onload = fetchData;

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(registration => {
            console.log('ServiceWorker registration successful');
        }, err => {
            console.log('ServiceWorker registration failed: ', err);
        });
    });
}
