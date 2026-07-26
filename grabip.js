const form = document.getElementById("verification-form");
const input = document.getElementById("discord-name");
const consentCheckbox = document.getElementById("consent-checkbox");
const button = document.getElementById("verify-button");
const statusElement = document.getElementById("status");
const title = document.getElementById("title");
const description = document.getElementById("description");

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const discordName = input.value.trim();

    if (discordName.length < 2 || discordName.length > 64) {
        showError("Enter a valid Discord username.");
        return;
    }

    if (!consentCheckbox.checked) {
        showError("You must agree before continuing.");
        return;
    }

    button.disabled = true;
    button.textContent = "Verifying...";
    statusElement.textContent = "Submitting verification...";
    statusElement.className = "";

    try {
        const response = await fetch("/api/verify", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                discordName: discordName,
                consent: true
            })
        });

        let result = {};

        try {
            result = await response.json();
        } catch {
            throw new Error(
                `The server returned an invalid response (${response.status}).`
            );
        }

        if (!response.ok) {
            throw new Error(
                result.error || `Verification failed (${response.status}).`
            );
        }

        form.remove();

        title.textContent = "Verification Complete";

        description.textContent =
            "You may now return to Discord.";

        statusElement.textContent =
            `Verified as ${discordName}`;

        statusElement.className = "success";
    } catch (error) {
        console.error("Verification error:", error);

        showError(
            error.message ||
            "Verification failed. Please try again."
        );

        button.disabled = false;
        button.textContent = "Verify";
    }
});

function showError(message) {
    statusElement.textContent = message;
    statusElement.className = "error";
}
