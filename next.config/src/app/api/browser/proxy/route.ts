import { NextRequest, NextResponse } from "next/server";

const FETCH_TIMEOUT_MS = 20_000;

function isAllowedTarget(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function rewriteHtml(html: string, pageUrl: URL, proxyOrigin: string): string {
  const proxyPrefix = `${proxyOrigin}/api/browser/proxy?url=`;

  const cleaned = html
    .replace(/<meta[^>]+http-equiv=["']?X-Frame-Options["']?[^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "");

  const baseTag = `<base href="${pageUrl.origin}/">`;
  const navigationScript = `
<script>
(function () {
  function toProxy(href) {
    return ${JSON.stringify(proxyPrefix)} + encodeURIComponent(href);
  }

  document.addEventListener("click", function (event) {
    var anchor = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;

    try {
      var next = new URL(anchor.href, ${JSON.stringify(pageUrl.toString())});
      if (next.protocol !== "http:" && next.protocol !== "https:") return;
      event.preventDefault();
      window.location.href = toProxy(next.toString());
    } catch (_) {}
  }, true);

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.action) return;

    try {
      var action = new URL(form.action, ${JSON.stringify(pageUrl.toString())});
      if (action.protocol !== "http:" && action.protocol !== "https:") return;
      form.action = toProxy(action.toString());
    } catch (_) {}
  }, true);
})();
</script>`;

  if (/<head[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`).replace(
      /<\/body>/i,
      `${navigationScript}</body>`,
    );
  }

  return `<!doctype html><html><head>${baseTag}</head><body>${cleaned}${navigationScript}</body></html>`;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  if (!isAllowedTarget(target)) {
    return NextResponse.json({ error: "Only http and https URLs are supported" }, { status: 403 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const isHtml =
      contentType.includes("text/html") || contentType.includes("application/xhtml+xml");

    if (!isHtml) {
      const body = await upstream.arrayBuffer();
      return new NextResponse(body, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    const html = await upstream.text();
    const finalUrl = new URL(upstream.url || target.toString());
    const rewritten = rewriteHtml(html, finalUrl, request.nextUrl.origin);

    return new NextResponse(rewritten, {
      status: upstream.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch the requested page" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
