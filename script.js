let userLat = "";
let userLng = "";
let map;

// 📍 Get GPS location
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            userLat = position.coords.latitude;
            userLng = position.coords.longitude;
            document.getElementById("locStatus").innerText = "Location captured ✔";
        });
    } else {
        alert("Geolocation not supported");
    }
}

// 🍱 Add food post
function addFood() {
    const foodType = document.getElementById("foodType").value;
    const quantity = document.getElementById("quantity").value;
    const location = document.getElementById("location").value;
    const expiry = document.getElementById("expiry").value;

    if (!userLat || !userLng) {
        alert("Capture location first!");
        return;
    }

    db.collection("foodPosts").add({
        foodType: foodType,
        quantity: quantity,
        location: location,
        expiry: expiry,
        lat: userLat,
        lng: userLng,
        status: "Pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        alert("Food request posted!");
    });
}

// 🏢 NGO — Load food posts
function loadFoodPosts() {
    const list = document.getElementById("foodList");

    db.collection("foodPosts").onSnapshot(snapshot => {
        list.innerHTML = "";

        snapshot.forEach(doc => {
            const data = doc.data();

            if (data.status === "Pending") {
                list.innerHTML += `
                    <div style="border:1px solid #ccc;margin:10px;padding:10px;">
                        <p><b>Food:</b> ${data.foodType}</p>
                        <p><b>Serves:</b> ${data.quantity}</p>
                        <p><b>Location:</b> ${data.location}</p>
                        <p><b>Expiry:</b> ${data.expiry}</p>

                        <button onclick="acceptFood('${doc.id}')">Accept</button>
                        <button onclick="initMap(${data.lat}, ${data.lng})">View Map</button>
                        <button onclick="getDirections(${data.lat}, ${data.lng})">Directions</button>
                    </div>
                `;
            }
        });

        if (list.innerHTML === "") {
            list.innerHTML = "<p>No pending food requests.</p>";
        }
    });
}

// ✅ Accept pickup
function acceptFood(id) {
    db.collection("foodPosts").doc(id).update({ status: "Picked" });
}

// 🗺 Show map
function initMap(lat, lng) {
    const location = { lat: parseFloat(lat), lng: parseFloat(lng) };

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 14,
        center: location,
    });

    new google.maps.Marker({ position: location, map: map });
}

// 🚗 Directions
function getDirections(lat, lng) {
    const url = "https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng;
    window.open(url, "_blank");
}

// Auto load NGO dashboard
window.onload = function () {
    if (document.getElementById("foodList")) {
        loadFoodPosts();
    }
};
