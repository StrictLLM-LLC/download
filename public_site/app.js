const API_URL = "https://api.github.com/repos/StrictLLM-LLC/download/releases";
const DOWNLOAD_ORIGIN = "https://download.strictllm.com";
const params = new URLSearchParams(window.location.search);

const ui = {
  primary: document.getElementById("primary-download"),
  detectedPlatform: document.getElementById("detected-platform"),
  detectedCopy: document.getElementById("detected-copy"),
  releaseSummary: document.getElementById("release-summary"),
  latestGrid: document.getElementById("latest-grid"),
  releaseList: document.getElementById("release-list"),
};

function setText(node, value) {
  if (node) {
    node.textContent = value;
  }
}

function setHtml(node, value) {
  if (node) {
    node.innerHTML = value;
  }
}

function setLink(node, text, href) {
  if (!node) {
    return;
  }

  node.textContent = text;
  node.href = href;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 100 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown publish date"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date);
}

function detectClientTarget() {
  const ua = navigator.userAgent;
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const isMac = /Mac|iPhone|iPad|iPod/.test(platform) || /Mac OS X/.test(ua);
  const isWindows = /Win/.test(platform) || /Windows/.test(ua);
  const isLinux = /Linux/.test(platform) || /Linux/.test(ua);
  const isArm =
    /arm|aarch64/i.test(ua) ||
    /arm/i.test(platform) ||
    (isMac && maxTouchPoints > 1);

  if (isMac) {
    return {
      os: "macos",
      arch: isArm ? "arm64" : "x64",
      format: "dmg",
      label: isArm ? "macOS Apple Silicon" : "macOS Intel",
    };
  }

  if (isWindows) {
    return {
      os: "windows",
      arch: "x64",
      format: "exe",
      label: "Windows 64-bit",
    };
  }

  if (isLinux) {
    return {
      os: "linux",
      arch: "x64",
      format: "appimage",
      label: "Linux 64-bit",
    };
  }

  return {
    os: "unknown",
    arch: "unknown",
    format: "",
    label: "Unknown platform",
  };
}

function buildFriendlyAssetUrl(asset) {
  return `${DOWNLOAD_ORIGIN}/${asset.os}-${asset.arch}.${asset.format}`;
}

function parseFriendlyAssetPath(pathname) {
  const match = pathname.match(/^\/([a-z0-9]+)-([a-z0-9]+)\.([a-z0-9]+)$/i);
  if (!match) {
    return null;
  }

  return {
    os: match[1].toLowerCase(),
    arch: match[2].toLowerCase(),
    format: match[3].toLowerCase(),
  };
}

function normalizeAsset(asset) {
  const name = asset.name || "";
  const lower = name.toLowerCase();

  if (
    lower.endsWith(".blockmap") ||
    lower.endsWith(".yml") ||
    lower.includes("builder-debug")
  ) {
    return null;
  }

  let os = "other";
  if (lower.includes("windows")) os = "windows";
  if (lower.includes("macos")) os = "macos";
  if (lower.includes("linux")) os = "linux";

  let arch = "unknown";
  if (lower.includes("arm64")) arch = "arm64";
  if (lower.includes("x64")) arch = "x64";

  let format = "other";
  if (lower.endsWith(".dmg")) format = "dmg";
  if (lower.endsWith(".exe")) format = "exe";
  if (lower.endsWith(".appimage")) format = "appimage";
  if (lower.endsWith(".zip")) format = "zip";

  let label = "Download";
  if (os === "macos" && arch === "arm64" && format === "dmg") label = "macOS Apple Silicon";
  if (os === "macos" && arch === "x64" && format === "dmg") label = "macOS Intel";
  if (os === "windows" && format === "exe") label = "Windows Installer";
  if (os === "linux" && format === "appimage") label = "Linux AppImage";
  if (os === "macos" && format === "zip") {
    label = arch === "arm64" ? "macOS Apple Silicon ZIP" : "macOS Intel ZIP";
  }

  return {
    name,
    url: asset.browser_download_url,
    size: asset.size,
    os,
    arch,
    format,
    label,
    friendlyUrl: buildFriendlyAssetUrl({ os, arch, format }),
  };
}

function assetPriority(asset) {
  const key = `${asset.os}:${asset.arch}:${asset.format}`;
  const priorities = {
    "macos:arm64:dmg": 1,
    "macos:x64:dmg": 2,
    "windows:x64:exe": 3,
    "linux:x64:appimage": 4,
    "macos:arm64:zip": 5,
    "macos:x64:zip": 6,
  };

  return priorities[key] || 99;
}

function pickAsset(assets, desired, options = {}) {
  if (!assets.length) {
    return null;
  }

  const useParams = options.useParams !== false;
  const target = {
    os: useParams ? params.get("os") || desired.os : desired.os,
    arch: useParams ? params.get("arch") || desired.arch : desired.arch,
    format: useParams ? params.get("format") || desired.format : desired.format,
  };

  const exact = assets.find(
    (asset) =>
      asset.os === target.os &&
      asset.arch === target.arch &&
      (!target.format || asset.format === target.format)
  );
  if (exact) {
    return exact;
  }

  const osFallback = assets.find(
    (asset) =>
      asset.os === target.os &&
      (asset.arch === target.arch || target.arch === "unknown")
  );
  if (osFallback) {
    return osFallback;
  }

  return [...assets].sort((a, b) => assetPriority(a) - assetPriority(b))[0];
}

function renderLatestRelease(release) {
  const assets = (release.assets || [])
    .map(normalizeAsset)
    .filter(Boolean)
    .sort((a, b) => assetPriority(a) - assetPriority(b));

  if (!assets.length) {
    setHtml(
      ui.latestGrid,
      '<div class="error">No downloadable assets were found in the latest published release.</div>'
    );
    return { assets, recommended: null };
  }

  setHtml(
    ui.latestGrid,
    assets
      .map(
        (asset) => `
          <article class="asset-card">
            <h3>${asset.label}</h3>
            <p>${asset.name}</p>
            <div class="meta">
              <span class="pill">${formatBytes(asset.size)}</span>
              <span class="pill">${asset.format.toUpperCase()}</span>
            </div>
            <a class="button button-secondary" href="${asset.friendlyUrl}">Direct download</a>
          </article>
        `
      )
      .join("")
  );

  return {
    assets,
    recommended: pickAsset(assets, detectClientTarget()),
  };
}

function renderReleaseHistory(releases) {
  if (!ui.releaseList) {
    return;
  }

  setHtml(
    ui.releaseList,
    releases
      .map((release) => {
        const assets = (release.assets || [])
          .map(normalizeAsset)
          .filter(Boolean)
          .sort((a, b) => assetPriority(a) - assetPriority(b));

        const assetMarkup = assets.length
          ? assets
              .map(
                (asset) => `
                  <a href="${asset.friendlyUrl}">
                    <strong>${asset.label}</strong>
                    <span>${formatBytes(asset.size)}</span>
                  </a>
                `
              )
              .join("")
          : '<p class="helper">No installer assets found.</p>';

        return `
          <article class="release-card">
            <div class="release-head">
              <h3>${release.name || release.tag_name}</h3>
              <p>Published ${formatDate(release.published_at)}</p>
            </div>
            <div class="release-assets">${assetMarkup}</div>
          </article>
        `;
      })
      .join("")
  );
}

function renderDetectedTarget(recommended) {
  const detected = detectClientTarget();
  setText(ui.detectedPlatform, detected.label);

  if (!recommended) {
    setText(
      ui.detectedCopy,
      "No matching installer asset was found for this platform in the latest public release."
    );
    setLink(ui.primary, "Browse all downloads", "#latest-grid");
    return;
  }

  setText(ui.detectedCopy, `Recommended asset: ${recommended.name}`);
  setLink(ui.primary, `Download ${recommended.label}`, recommended.friendlyUrl);
}

function renderUnavailableAsset() {
  setText(ui.releaseSummary, "Requested download is unavailable");
  setHtml(
    ui.latestGrid,
    '<div class="error">The requested installer could not be matched to a published release asset.</div>'
  );
  setHtml(
    ui.releaseList,
    '<div class="error">Use the latest published downloads below instead.</div>'
  );
  setLink(ui.primary, "Browse all downloads", `${DOWNLOAD_ORIGIN}/`);
  setText(ui.detectedPlatform, "Unavailable asset");
  setText(
    ui.detectedCopy,
    "The requested OS, architecture, or file format is not present in the current public releases."
  );
}

function redirectToFriendlyAsset(assets) {
  const requestedAsset = parseFriendlyAssetPath(window.location.pathname);
  if (!requestedAsset) {
    return false;
  }

  const matchedAsset = pickAsset(assets, requestedAsset, { useParams: false });
  if (
    matchedAsset &&
    matchedAsset.os === requestedAsset.os &&
    matchedAsset.arch === requestedAsset.arch &&
    matchedAsset.format === requestedAsset.format
  ) {
    window.location.replace(matchedAsset.url);
    return true;
  }

  renderUnavailableAsset();
  return true;
}

async function loadReleases() {
  const response = await fetch(API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with ${response.status}`);
  }

  const releases = await response.json();
  return releases.filter((release) => !release.draft && !release.prerelease);
}

function renderFailure(message) {
  setText(ui.releaseSummary, "Unable to load public release data");
  setHtml(ui.latestGrid, `<div class="error">${message}</div>`);
  setHtml(
    ui.releaseList,
    '<div class="error">Release history could not be loaded from GitHub.</div>'
  );
  setLink(ui.primary, "Open repository", "https://github.com/StrictLLM-LLC/download/releases");
  setText(ui.detectedPlatform, "Fallback mode");
  setText(
    ui.detectedCopy,
    "GitHub release metadata could not be loaded. Use the repository releases page directly."
  );
}

async function main() {
  try {
    const releases = await loadReleases();
    if (!releases.length) {
      throw new Error("No published releases were returned.");
    }

    const latest = releases[0];
    const { assets, recommended } = renderLatestRelease(latest);
    if (redirectToFriendlyAsset(assets)) {
      return;
    }

    renderReleaseHistory(releases);
    renderDetectedTarget(recommended);
    setText(ui.releaseSummary, `${latest.tag_name} published ${formatDate(latest.published_at)}`);

    if (params.get("download") === "1" || params.get("download") === "true") {
      const redirectAsset = pickAsset(assets, detectClientTarget());
      if (redirectAsset) {
        window.location.replace(redirectAsset.url);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderFailure(message);
  }
}

main();
