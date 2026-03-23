const axios = require('axios');

// 🛑 KEYS TRANSCRIBED DIRECTLY FROM YOUR SCREENSHOT
const APP_ID = "357ababa";
const APP_KEY = "77b42672661e0b65cd05e3b3040028c9";

async function testKairos() {
    console.log("-----------------------------------------");
    console.log("📡 Testing Kairos Keys...");
    console.log(`🆔 App ID: ${APP_ID}`);
    console.log(`🔑 App Key: ${APP_KEY.substring(0, 5)}...`);
    console.log("-----------------------------------------");

    try {
        // We try to list galleries. This is a lightweight check.
        const response = await axios.post('https://api.kairos.com/gallery/list_all', {}, {
            headers: {
                'app_id': APP_ID,
                'app_key': APP_KEY,
                'Content-Type': 'application/json'
            }
        });

        console.log("\n✅ SUCCESS! The keys are VALID.");
        console.log("Galleries found:", response.data);
        console.log("-----------------------------------------");
        console.log("👉 ACTION: The issue is your .env file formatting.");
        
    } catch (error) {
        console.error("\n❌ FAILED. Status Code:", error.response ? error.response.status : error.message);
        if (error.response) {
            console.error("Reason:", JSON.stringify(error.response.data, null, 2));
        }
        console.log("-----------------------------------------");
        console.log("👉 ACTION: These keys are effectively dead. Check your dashboard trial status.");
    }
}

testKairos();