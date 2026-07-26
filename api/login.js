import crypto from "node:crypto";

export default function handler(request, response) {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;

    if (!clientId || !redirectUri) {
        return response.status(500).json({
            error: "Discord OAuth environment variables are missing."
        });
    }

    const state = crypto.randomBytes(24).toString("hex");

    response.setHeader(
        "Set-Cookie",
        [
            `oauth_state=${state}`,
            "HttpOnly",
            "Secure",
            "SameSite=Lax",
            "Path=/",
            "Max-Age=600"
        ].join("; ")
    );

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "identify",
        state
    });

    const discordURL =
        `https://discord.com/oauth2/authorize?${params.toString()}`;

    return response.redirect(302, discordURL);
}
