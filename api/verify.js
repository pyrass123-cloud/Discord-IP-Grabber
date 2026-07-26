export default async function handler(request, response) {
    if (request.method !== "POST") {
        response.setHeader("Allow", "POST");

        return response.status(405).json({
            error: "Method not allowed."
        });
    }

    const discordName =
        typeof request.body?.discordName === "string"
            ? request.body.discordName.trim()
            : "";

    const consent = request.body?.consent === true;

    if (!consent) {
        return response.status(400).json({
            error: "Consent is required."
        });
    }

    if (discordName.length < 2 || discordName.length > 64) {
        return response.status(400).json({
            error: "Enter a valid Discord username."
        });
    }

    const webhookURL = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookURL) {
        console.error("DISCORD_WEBHOOK_URL is not configured.");

        return response.status(500).json({
            error: "The Discord webhook has not been configured."
        });
    }

    const forwardedFor = request.headers["x-forwarded-for"];

    let ipAddress = "Unavailable";

    if (typeof forwardedFor === "string") {
        ipAddress = forwardedFor.split(",")[0].trim();
    } else if (request.socket?.remoteAddress) {
        ipAddress = request.socket.remoteAddress;
    }

    const cleanUsername = discordName
        .replace(/@everyone/gi, "@ everyone")
        .replace(/@here/gi, "@ here")
        .replace(/```/g, "");

    const payload = {
        embeds: [
            {
                title: "New Discord Verification",
                color: 5793266,

                fields: [
                    {
                        name: "Discord Username",
                        value: cleanUsername,
                        inline: false
                    },
                    {
                        name: "IP Address",
                        value: ipAddress,
                        inline: false
                    }
                ],

                timestamp: new Date().toISOString(),

                footer: {
                    text: "EEVerify"
                }
            }
        ],

        allowed_mentions: {
            parse: []
        }
    };

    try {
        const discordResponse = await fetch(webhookURL, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
        });

        if (!discordResponse.ok) {
            const discordError = await discordResponse.text();

            console.error(
                "Discord webhook failed:",
                discordResponse.status,
                discordError
            );

            return response.status(502).json({
                error:
                    `Discord rejected the verification request ` +
                    `(${discordResponse.status}).`
            });
        }

        return response.status(200).json({
            success: true
        });
    } catch (error) {
        console.error("Verification request failed:", error);

        return response.status(500).json({
            error: "Verification failed. Please try again."
        });
    }
}
