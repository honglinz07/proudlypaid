import { createHash, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isIP } from "node:net";
import { dirname, resolve } from "node:path";

export const USER_AGENT = "ProudlyPaidResearch/0.1 (+https://github.com/honglinz07/proudlypaid)";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export const nameKey = (value) =>
  value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
export const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
export async function writeText(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, { flag: "wx" });
  await rename(temporary, path);
}
export const writeJson = (path, value) => writeText(path, `${JSON.stringify(value, null, 2)}\n`);

export class ResearchError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.code = code;
    Object.assign(this, extra);
  }
}

export function publicUrl(value) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    !url.hostname.includes(".") ||
    /(?:^|\.)(?:localhost|local|internal|invalid|test)$/i.test(url.hostname) ||
    [...url.searchParams.keys()].some((key) =>
      /^(?:token|api[_-]?key|password|auth|session)$/i.test(key),
    )
  )
    throw new ResearchError("unsafe-url", "Only public HTTPS research URLs are accepted.");
  url.hash = "";
  return url;
}

export function repositoryIdentity(value) {
  if (typeof value !== "string") return null;
  let identity = value.trim();
  if (identity.startsWith("https://")) {
    try {
      const url = new URL(identity);
      if (
        url.hostname !== "github.com" ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash
      )
        return null;
      identity = url.pathname.slice(1);
    } catch {
      return null;
    }
  }
  identity = identity.replace(/\/$/, "").replace(/\.git$/i, "");
  return /^[\w.-]+\/[\w.-]+$/.test(identity) ? identity.toLowerCase() : null;
}

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c <= 2))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  // Permit global unicast only; reject mapped IPv4 and transition/documentation ranges.
  return (
    isIP(address) === 6 &&
    /^[23]/i.test(address) &&
    !address.includes(".") &&
    !/^(?:2001:(?:0*:|0?db8:)|2002:)/i.test(address)
  );
}

export function retryAfter(value, now = Date.now()) {
  if (!value) return null;
  const time = /^\d+$/.test(value) ? now + Number(value) * 1000 : Date.parse(value);
  return Number.isFinite(time) && time > now && time <= 8.64e15 ? time : null;
}

export async function fetchText(
  value,
  {
    fetchImpl = fetch,
    lookupImpl = lookup,
    beforeRequest = async () => {},
    maxBytes = 3 * 1024 * 1024,
    timeoutMs = 15_000,
    maxRedirects = 5,
  } = {},
) {
  let url = publicUrl(value);
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    let timer;
    let addresses;
    try {
      addresses = await Promise.race([
        lookupImpl(url.hostname, { all: true }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("DNS timeout")), 5000);
        }),
      ]);
    } catch {
      throw new ResearchError("dns-error", "Public hostname lookup failed.");
    } finally {
      clearTimeout(timer);
    }
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new ResearchError("unsafe-address", "Hostname resolves to a non-public address.");
    }
    await beforeRequest(url);
    let response;
    try {
      response = await fetchImpl(url.href, {
        method: "GET",
        redirect: "manual",
        credentials: "omit",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/json,text/plain;q=0.9,*/*;q=0.1",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (error instanceof ResearchError) throw error;
      throw new ResearchError("network-error", "HTTPS request failed or timed out.");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || redirects === maxRedirects)
        throw new ResearchError(
          "redirect-error",
          "Missing redirect location or redirect limit exceeded.",
        );
      url = publicUrl(new URL(location, url).href);
      continue;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (response.ok && !/^(?:text\/|application\/(?:json|xhtml\+xml))/i.test(contentType)) {
      await response.body?.cancel();
      throw new ResearchError("unsupported-content", "Response is not a supported text document.");
    }
    const chunks = [];
    let size = 0;
    try {
      if (response.body)
        for await (const chunk of response.body) {
          size += chunk.byteLength;
          if (size > maxBytes)
            throw new ResearchError("oversized-content", "Text response exceeds the byte limit.");
          chunks.push(Buffer.from(chunk));
        }
    } catch (error) {
      if (error instanceof ResearchError) throw error;
      throw new ResearchError("network-error", "Response body could not be read completely.");
    }
    return {
      finalUrl: url.href,
      statusCode: response.status,
      contentType,
      retryAt: retryAfter(response.headers.get("retry-after")),
      body: Buffer.concat(chunks).toString("utf8"),
    };
  }
}

export function cliOptions(args, allowed, flags = []) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!allowed.includes(key) || Object.hasOwn(options, key))
      throw new Error(`Unknown or duplicate option: ${key}`);
    if (flags.includes(key)) options[key] = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
      options[key] = value;
    }
  }
  return options;
}

export function positiveInteger(value, fallback) {
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1)
    throw new Error("Limits must be positive integers.");
  return number;
}

export function separateOutput(input, output) {
  const source = resolve(input);
  const target = resolve(output);
  if (target === source || target.startsWith(`${source}/`) || target.startsWith(`${source}\\`))
    throw new Error("Output must be outside the source input directory.");
}
