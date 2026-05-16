// ==========================================
// GLOBAL VARIABLES
// ==========================================
let map = null;
let markersLayer = null;
let currentLat = null;
let currentLng = null;
let ngoLat = null; // Stores the NGO's latitude
let ngoLng = null; // Stores the NGO's longitude
let unsubscribeFoodPosts = null; // Prevents duplicate database listeners

// ==========================================
// UI HELPER FUNCTIONS
// ==========================================
function showToast(message) {
    const toast = document.getElementById("toast");
    if(toast) {
        toast.innerText = message;
        toast.className = "toast show";
        setTimeout(() => { toast.className = toast.className.replace("show", ""); }, 3000);
    } else {
        alert(message);
    }
}

// ==========================================
// AUTHENTICATION FUNCTIONS
// ==========================================
function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = "login.html";
    }).catch((error) => {
        console.error("Logout Error:", error);
        showToast("Error logging out.");
    });
}

// ==========================================
// DONOR DASHBOARD FUNCTIONS
// ==========================================
function getLocation() {
    const locStatus = document.getElementById("locStatus");
    if (!navigator.geolocation) {
        locStatus.innerText = "Geolocation is not supported by your browser.";
        return;
    }
    locStatus.innerText = "Requesting permission... Please click 'Allow'.";
    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLat = position.coords.latitude;
            currentLng = position.coords.longitude;
            locStatus.innerText = "Location captured successfully! 📍";
        },
        (error) => {
            console.error("Geolocation error:", error);
            locStatus.innerText = "Error: Please enable location services.";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function addFood() {
    const donorName = document.getElementById("donorName")?.value;
    const phone = document.getElementById("phone")?.value;
    const foodType = document.getElementById("foodType")?.value;
    const quantity = document.getElementById("quantity")?.value;
    const expiryHours = document.getElementById("expiryHours")?.value;
    const user = firebase.auth().currentUser;

    if (!donorName || !phone || !foodType || !quantity || !currentLat) {
        showToast("Please fill all fields and capture location!");
        return;
    }

    db.collection("foodPosts").add({
        donorId: user.uid,
        donorName: donorName,
        phone: phone,
        foodType: foodType,
        quantity: quantity,
        lat: currentLat,
        lng: currentLng,
        status: "Pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        expiryTime: new Date().getTime() + (expiryHours * 60 * 60 * 1000)
    }).then(() => {
        showToast("Donation posted successfully! 🍱");
        document.getElementById("donorName").value = "";
        document.getElementById("phone").value = "";
        document.getElementById("foodType").value = "";
        document.getElementById("quantity").value = "";
        document.getElementById("locStatus").innerText = "";
        currentLat = null;
        currentLng = null;
    }).catch(err => {
        showToast("Error posting donation.");
    });
}

function listenForNotifications() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    if ("Notification" in window && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
    db.collection("foodPosts")
      .where("donorId", "==", user.uid)
      .onSnapshot(snapshot => {
          snapshot.docChanges().forEach(change => {
              if (change.type === "modified") {
                  const data = change.doc.data();
                  let message = "";
                  if (data.status === "Accepted") message = `An NGO has accepted your ${data.foodType}!`;
                  if (data.status === "Delivered") message = `Your ${data.foodType} was delivered!`;
                  
                  if (message) {
                      showToast(message);
                      if (Notification.permission === "granted") {
                          new Notification("FEED-BRIDGE Update", { body: message });
                      }
                  }
              }
          });
      });
}

function loadDonorHistory() {
    const historyDiv = document.getElementById("donorHistory");
    const user = firebase.auth().currentUser;
    if (!historyDiv || !user) return;

    db.collection("foodPosts")
      .where("donorId", "==", user.uid)
      .onSnapshot(snap => {
          historyDiv.innerHTML = "";
          if (snap.empty) {
              historyDiv.innerHTML = "<p style='text-align:center; opacity:0.7;'>No donations yet.</p>";
              return;
          }
          
          let posts = [];
          let totalDeliveries = 0;
          let totalServings = 0;

          snap.forEach(doc => {
              let data = doc.data();
              
              // === CHANGED SECTION: Only process if status is 'Delivered' ===
              if (data.status === 'Delivered') {
                  posts.push({ id: doc.id, ...data }); // Only add delivered items to the list
                  totalDeliveries++;
                  totalServings += parseInt(data.quantity) || 0;
              }
              // ==============================================================
          });

          // Sort the delivered posts by date (newest first)
          posts.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));

          let badge = "🌱 Seedling Donor";
          let badgeColor = "#10b981";
          if (totalServings >= 50 && totalServings < 200) { badge = "🥉 Bronze Donor"; badgeColor = "#cd7f32"; }
          else if (totalServings >= 200 && totalServings < 500) { badge = "🥈 Silver Donor"; badgeColor = "#c0c0c0"; }
          else if (totalServings >= 500) { badge = "🥇 Gold Donor"; badgeColor = "#ffd700"; }

          let impactHTML = `
              <div class="card" style="margin-bottom: 25px; padding: 20px; border-radius: 12px; background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.15)); border: 1px solid rgba(255,255,255,0.2); text-align: center;">
                  <h3 style="margin-bottom: 15px; font-size: 1.2em;">🌟 Your Impact</h3>
                  <div style="display: flex; justify-content: space-around; margin-bottom: 15px;">
                      <div>
                          <p style="font-size: 0.8em; opacity: 0.8; margin-bottom: 5px;">Deliveries</p>
                          <b style="font-size: 1.8em; color: #adff2f;">${totalDeliveries}</b>
                      </div>
                      <div>
                          <p style="font-size: 0.8em; opacity: 0.8; margin-bottom: 5px;">Total Servings</p>
                          <b style="font-size: 1.8em; color: #adff2f;">${totalServings}</b>
                      </div>
                  </div>
                  <div style="display: inline-block; padding: 6px 15px; background: ${badgeColor}; color: ${badgeColor === '#ffd700' || badgeColor === '#c0c0c0' ? 'black' : 'white'}; border-radius: 20px; font-weight: bold; font-size: 0.9em;">
                      ${badge}
                  </div>
              </div>
              <h3 style="margin-bottom: 15px; font-size: 1em; opacity: 0.9; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">Successful Donations</h3>
          `;
          
          historyDiv.innerHTML = impactHTML;

          // If there are no delivered items yet, show a friendly message
          if (posts.length === 0) {
              historyDiv.innerHTML += "<p style='text-align:center; opacity:0.7; margin-top: 20px;'>No delivered donations yet. Your impact will show up here soon!</p>";
              return;
          }

          posts.forEach(data => {
              // Since we already filtered for 'Delivered', we know the color will always be green
              let statusColor = '#10b981'; 
              
              historyDiv.innerHTML += `
                  <div class="card" style="margin-bottom: 15px; padding: 15px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                          <b style="color: #adff2f;">${data.foodType}</b>
                          <span style="font-size: 0.7em; padding: 3px 8px; border-radius: 10px; background: ${statusColor}; color: white;">${data.status}</span>
                      </div>
                      <p style="font-size: 0.85em; margin-top: 5px;">Quantity: ${data.quantity} servings</p>
                  </div>`;
          });
      });
}

// ==========================================
// NGO DASHBOARD FUNCTIONS
// ==========================================

// We keep this function ONLY so we can sort the list (closest donations at the top)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    map = L.map('map').setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                ngoLat = position.coords.latitude;
                ngoLng = position.coords.longitude;
                map.setView([ngoLat, ngoLng], 12); 
                loadFoodPosts(); 
            },
            (error) => {
                console.log("NGO location access denied. Showing all donations.");
            }
        );
    }
}

function loadFoodPosts() {
    const list = document.getElementById("foodList");
    if (!list) return; 
    if (!map) initMap();
    
    if (unsubscribeFoodPosts) unsubscribeFoodPosts();
    
    unsubscribeFoodPosts = db.collection("foodPosts").onSnapshot(snap => {
        list.innerHTML = ""; 
        if (markersLayer) markersLayer.clearLayers();
        
        let posts = [];
        const currentTime = Date.now();

        snap.forEach(doc => {
            let data = doc.data();
            
            if (data.expiryTime && currentTime > data.expiryTime) {
                if (data.status === "Pending") {
                    db.collection("foodPosts").doc(doc.id).update({ status: "Expired" }).catch(err => console.log(err));
                }
                return; 
            }

            if (data.status === "Pending" || data.status === "Accepted") {
                let postObj = { id: doc.id, ...data };
                if (ngoLat && ngoLng && data.lat && data.lng) {
                    postObj.distance = calculateDistance(ngoLat, ngoLng, data.lat, data.lng);
                }
                posts.push(postObj);
            }
        });

        if (posts.length === 0) {
            list.innerHTML = "<p style='text-align:center; opacity:0.7;'>No active donations available.</p>";
            return;
        }

        // Sort silently by distance so closest is at the top
        posts.sort((a, b) => {
            if (a.distance !== undefined && b.distance !== undefined) {
                return a.distance - b.distance;
            }
            return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
        });

        posts.forEach(data => {
            if (data.lat && data.lng) {
                let markerColor = data.status === 'Pending' ? 'blue' : 'green';
                L.circleMarker([data.lat, data.lng], { color: markerColor, radius: 8 }).addTo(markersLayer);
            }

            const cleanPhone = data.phone ? data.phone.replace(/\D/g,'') : '';
            
            // Standard Official Google Maps URL (Will open the app directly with routing)
            let mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}`;
            if (ngoLat && ngoLng) {
                mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${ngoLat},${ngoLng}&destination=${data.lat},${data.lng}`;
            }
            
            const contactHTML = data.phone ? `
                <div style="display: flex; gap: 8px; margin: 10px 0;">
                    <a href="tel:${data.phone}" style="flex: 1; text-align: center; background: #4b5563; color: white; padding: 8px; border-radius: 5px; text-decoration: none; font-size: 0.8em;">📞 Call</a>
                    <a href="https://wa.me/${cleanPhone}" target="_blank" style="flex: 1; text-align: center; background: #25D366; color: white; padding: 8px; border-radius: 5px; text-decoration: none; font-size: 0.8em;"> WhatsApp</a>
                    <a href="${mapsUrl}" target="_blank" style="flex: 1; text-align: center; background: #ea4335; color: white; padding: 8px; border-radius: 5px; text-decoration: none; font-size: 0.8em;">📍 Navigation</a>
                </div>` : '';

            let actionBtn = '';
            if (data.status === "Pending") {
                actionBtn = `<button onclick="updateStatus('${data.id}', 'Accepted')" style="background:#3b82f6; width:100%;">Accept Donation</button>`;
            } else if (data.status === "Accepted") {
                actionBtn = `<button onclick="updateStatus('${data.id}', 'Delivered')" style="background:#10b981; width:100%;">Mark Delivered</button>`;
            }

            let acceptedBadge = data.status === "Accepted" ? `<span style="font-size: 0.7em; padding: 3px 8px; border-radius: 10px; background: #3b82f6; color: white; float: right;">Accepted</span>` : '';

            // Removed the distance text label completely
            list.innerHTML += `
                <div class="card" style="text-align: left; border-left: 4px solid #adff2f;">
                    <b style="font-size: 1.1em;">${data.foodType}</b> ${acceptedBadge}<br>
                    <small>👤 ${data.donorName} | 📦 ${data.quantity} servings</small>
                    ${contactHTML}
                    ${actionBtn}
                </div>`;
        });
    });
}

function updateStatus(docId, newStatus) {
    db.collection("foodPosts").doc(docId).update({ status: newStatus })
      .then(() => showToast(`Status updated to ${newStatus}!`))
      .catch(() => showToast("Update failed."));
}