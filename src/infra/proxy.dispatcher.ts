import { ProxyAgent, Dispatcher } from "undici";

export function buildProxyDispatcher(proxy?: string): Dispatcher | undefined {
    if (!proxy) return undefined;

    const u = new URL(proxy);
    const uri = `${u.protocol}//${u.host}`;

    const user = decodeURIComponent(u.username || "");
    const pass = decodeURIComponent(u.password || "");

    if (user || pass) {
        const token = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
        return new ProxyAgent({ uri, token });
    }

    return new ProxyAgent({ uri });
}
