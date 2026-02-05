import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetch as undiciFetch, Dispatcher } from "undici";
import { normalizeProxyUrl } from "./funding.utils";
import { buildProxyDispatcher } from "../infra/proxy.dispatcher";

type AsterResp = {
    code: string;
    data: Array<{
        symbol: string;
        markPrice: string;
        lastFundingRate: string;
        nextFundingTime: number;
        time: number;
        fundingIntervalHours: number;
    }>;
};

@Injectable()
export class AsterClient {
    private readonly FUNDING_URL: string;
    private readonly dispatcher?: Dispatcher;

    constructor(private readonly config: ConfigService) {
        this.FUNDING_URL = this.config.get<string>("ASTER_FUNDING_URL", "");
        if (!this.FUNDING_URL) throw new Error("Missing ASTER_FUNDING_URL");

        const proxyRaw = this.config.get<string>("HTTP_PROXY", "");
        const proxy = normalizeProxyUrl(proxyRaw);

        this.dispatcher = buildProxyDispatcher(proxy);

        if (proxy) {
            const u = new URL(proxy);
            const uri = `${u.protocol}//${u.host}`;
            const hasAuth = Boolean(u.username || u.password);
            console.log(`[AsterClient] Proxy enabled: ${uri} (auth=${hasAuth})`);
        }
    }

    async fetchFunding() {
        const res = await undiciFetch(this.FUNDING_URL, {
            method: "GET",
            dispatcher: this.dispatcher,
        });

        if (!res.ok) throw new Error(`Aster HTTP ${res.status}`);

        const json = (await res.json()) as AsterResp;
        return Array.isArray(json?.data) ? json.data : [];
    }
}
