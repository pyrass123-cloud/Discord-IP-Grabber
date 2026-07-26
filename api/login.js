import crypto from "node:crypto";

function isValidDiscordId(value) {
    return typeof value === "string" && /^\d{17,20}$/.test(value);
}

export default function handler(request, response) {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    const guildId = request.query.guild;

    if (!clientId || !redirectUri) {
        return response.status(500).json({
            error: "Discord OAuth environment variables are missing."
        });
    }

    if (!isValidDiscordId(guildId)) {
        return response.status(400).json({
            error: "A valid Discord server ID is required."
        });
    }

    const state = crypto.randomBytes(24).toString("hex");

    response.setHeader("Set-Cookie", [
        [
            `oauth_state=${state}`,
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=600"
        ].join("; "),
        [
            `verification_guild=${guildId}`,
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=600"
        ].join("; ")
    ]);

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify",
        state
    });

    return response.redirect(
        302,
        `https://discord.com/oauth2/authorize?${params.toString()}`
    );
}
