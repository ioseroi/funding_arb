import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { fetch as undiciFetch, Dispatcher } from "undici";
import { priceDecimalToIntStr } from "./funding.utils";
import { normalizeProxyUrl } from "./funding.utils";
import { buildProxyDispatcher } from "../infra/proxy.dispatcher";

type MexcTickerItem = {
    symbol: string;
    lastPrice?: number;
    fairPrice?: number;
    indexPrice?: number;
};

type MexcTickerResp = {
    success: boolean;
    data: MexcTickerItem[];
};

type MexcFundingResp = {
    success: boolean;
    data: {
        symbol: string;
        fundingRate: number;
        collectCycle: number;
        nextSettleTime: number;
        timestamp: number;
    };
};

@Injectable()
export class MexcClient {
    private readonly TICKERS_URL: string;
    private readonly FUNDING_BASE: string;

    private readonly dispatcher?: Dispatcher;
    private cursor = 0;

    constructor(private readonly config: ConfigService) {
        this.TICKERS_URL = this.config.get<string>("MEXC_TICKERS_URL", "");
        this.FUNDING_BASE = this.config.get<string>("MEXC_FUNDING_BASE", "");

        if (!this.TICKERS_URL || !this.FUNDING_BASE) {
            throw new Error("Missing MEXC env config");
        }

        const proxyRaw = this.config.get<string>("HTTP_PROXY", "");
        const proxy = normalizeProxyUrl(proxyRaw);

        this.dispatcher = buildProxyDispatcher(proxy);

        if (proxy) {
            // log safe info only (no creds)
            const u = new URL(proxy);
            const uri = `${u.protocol}//${u.host}`;
            const hasAuth = Boolean(u.username || u.password);
            console.log(`[MexcClient] Proxy enabled: ${uri} (auth=${hasAuth})`);
        }
    }

    async getTickers(): Promise<MexcTickerItem[]> {
        const res = await undiciFetch(this.TICKERS_URL, {
            method: "GET",
            dispatcher: this.dispatcher,
        });

        if (!res.ok) throw new Error(`MEXC tickers HTTP ${res.status}`);

        const json = (await res.json()) as MexcTickerResp;

        return json?.success && Array.isArray(json.data)
            ? json.data.filter((x) => x && x.symbol)
            : [];
    }

    async getSymbols(): Promise<string[]> {
        const tickers = await this.getTickers();
        return tickers.map((x) => x.symbol);
    }

    async getMarkPriceCentsBySymbol(): Promise<Map<string, string>> {
        const tickers = await this.getTickers();
        const m = new Map<string, string>();

        for (const t of tickers) {
            const px = t.fairPrice ?? t.lastPrice ?? null;
            const cents = priceDecimalToIntStr(px);
            if (cents) m.set(t.symbol, cents);
        }

        return m;
    }

    getNextBatch(symbols: string[], batchSize: number): string[] {
        if (!symbols.length) return [];

        const size = Math.max(1, Math.min(batchSize, symbols.length));
        const out: string[] = [];

        for (let i = 0; i < size; i++) {
            out.push(symbols[this.cursor]);
            this.cursor = (this.cursor + 1) % symbols.length;
        }

        return out;
    }

    async fetchFunding(symbol: string): Promise<MexcFundingResp["data"] | null> {
        const url = this.FUNDING_BASE + encodeURIComponent(symbol);

        const res = await undiciFetch(url, {
            method: "GET",
            dispatcher: this.dispatcher,
        });

        if (!res.ok) throw new Error(`MEXC funding HTTP ${res.status} sym=${symbol}`);

        const json = (await res.json()) as MexcFundingResp;
        return json?.success ? json.data : null;
    }
}
