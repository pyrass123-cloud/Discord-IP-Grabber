const form = document.getElementById("verification-form");
const input = document.getElementById("discord-name");
const button = document.getElementById("verify-button");
const statusElement = document.getElementById("status");
const title = document.getElementById("title");
const description = document.getElementById("description");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const discordName = input.value.trim();

    if (discordName.length < 2 || discordName.length > 64) {
        statusElement.textContent = "Enter a valid Discord username.";
        statusElement.className = "error";
        return;
    }

    button.disabled = true;
    statusElement.textContent = "Verifying…";
    statusElement.className = "";

    try {
        const response = await fetch("/api/verify", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                discordName
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Verification failed.");
        }

        form.remove();
        title.textContent = "Verification Complete";
        description.textContent = "You may now return to Discord.";
        statusElement.textContent = `Verified as ${discordName}`;
        statusElement.className = "success";
    } catch (error) {
        console.error("Verification error:", error);

        statusElement.textContent =
            error.message || "Verification failed. Please try again.";

        statusElement.className = "error";
        button.disabled = false;
    }
});
