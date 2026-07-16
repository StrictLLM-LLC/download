(function () {
  var config = window.STRICTLLM_DOWNLOAD_CONFIG || {};
  var defaultOrigin = typeof window !== "undefined" && window.location && window.location.origin
    ? window.location.origin
    : "";
  var friendlyDownloadOrigin = config.friendlyDownloadOrigin || defaultOrigin;
  var downloadPageUrl = config.downloadPageUrl || "/download.html";
  var latestReleaseUrl = config.latestReleaseUrl || "https://api.github.com/repos/strictllm/download/releases/latest";
  var releaseCacheTtlMs = 5 * 60 * 1000;
  var selectedPlatform = null;
  var platformDownloads = {};
  var latestReleaseCache = null;
  var latestReleasePromise = null;

  var platformNames = { windows: "Windows", mac: "macOS", linux: "Linux" };
  var platformDescriptions = {
    windows: "installer for Windows 10+",
    mac: "installer for macOS 11+",
    linux: "AppImage for common distros",
  };
  var alternativeArchLabels = {
    windows: { arm64: "Windows ARM64" },
    mac: { x64: "Mac Intel" },
    linux: {},
  };
  var platformArchOptions = {
    windows: ["x64", "arm64"],
    mac: ["arm64", "x64"],
    linux: ["x64"],
  };
  var platformRouteDescriptions = {
    windows: "Preparing your Windows installer.",
    mac: "Preparing your macOS installer.",
    linux: "Preparing your Linux download.",
  };

  function getPlatformIconSvg(platform) {
    if (platform === "windows") {
      return '<svg class="text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1664 1664" width="28" height="28" fill="currentColor" aria-hidden="true"><path d="M682 878v651L0 1435V878zm0-743v659H0V229zm982 743v786l-907-125V878zm0-878v794H757V125z" /></svg>';
    }

    if (platform === "mac") {
      return '<svg class="h-7 w-7 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>';
    }

    if (platform === "linux") {
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width="24" height="24" fill="#ffffff" aria-hidden="true"><path d="M220.8 123.3c1 .5 1.8 1.7 3 1.7c1.1 0 2.8-.4 2.9-1.5c.2-1.4-1.9-2.3-3.2-2.9c-1.7-.7-3.9-1-5.5-.1c-.4.2-.8.7-.6 1.1c.3 1.3 2.3 1.1 3.4 1.7m-21.9 1.7c1.2 0 2-1.2 3-1.7c1.1-.6 3.1-.4 3.5-1.6c.2-.4-.2-.9-.6-1.1c-1.6-.9-3.8-.6-5.5.1c-1.3.6-3.4 1.5-3.2 2.9c.1 1 1.8 1.5 2.8 1.4M420 403.8c-3.6-4-5.3-11.6-7.2-19.7c-1.8-8.1-3.9-16.8-10.5-22.4c-1.3-1.1-2.6-2.1-4-2.9c-1.3-.8-2.7-1.5-4.1-2c9.2-27.3 5.6-54.5-3.7-79.1c-11.4-30.1-31.3-56.4-46.5-74.4c-17.1-21.5-33.7-41.9-33.4-72C311.1 85.4 315.7.1 234.8 0C132.4-.2 158 103.4 156.9 135.2c-1.7 23.4-6.4 41.8-22.5 64.7c-18.9 22.5-45.5 58.8-58.1 96.7c-6 17.9-8.8 36.1-6.2 53.3c-6.5 5.8-11.4 14.7-16.6 20.2c-4.2 4.3-10.3 5.9-17 8.3s-14 6-18.5 14.5c-2.1 3.9-2.8 8.1-2.8 12.4c0 3.9.6 7.9 1.2 11.8c1.2 8.1 2.5 15.7.8 20.8c-5.2 14.4-5.9 24.4-2.2 31.7c3.8 7.3 11.4 10.5 20.1 12.3c17.3 3.6 40.8 2.7 59.3 12.5c19.8 10.4 39.9 14.1 55.9 10.4c11.6-2.6 21.1-9.6 25.9-20.2c12.5-.1 26.3-5.4 48.3-6.6c14.9-1.2 33.6 5.3 55.1 4.1c.6 2.3 1.4 4.6 2.5 6.7v.1c8.3 16.7 23.8 24.3 40.3 23c16.6-1.3 34.1-11 48.3-27.9c13.6-16.4 36-23.2 50.9-32.2c7.4-4.5 13.4-10.1 13.9-18.3c.4-8.2-4.4-17.3-15.5-29.7M223.7 87.3c9.8-22.2 34.2-21.8 44-.4c6.5 14.2 3.6 30.9-4.3 40.4c-1.6-.8-5.9-2.6-12.6-4.9c1.1-1.2 3.1-2.7 3.9-4.6c4.8-11.8-.2-27-9.1-27.3c-7.3-.5-13.9 10.8-11.8 23c-4.1-2-9.4-3.5-13-4.4c-1-6.9-.3-14.6 2.9-21.8M183 75.8c10.1 0 20.8 14.2 19.1 33.5c-3.5 1-7.1 2.5-10.2 4.6c1.2-8.9-3.3-20.1-9.6-19.6c-8.4.7-9.8 21.2-1.8 28.1c1 .8 1.9-.2-5.9 5.5c-15.6-14.6-10.5-52.1 8.4-52.1m-13.6 60.7c6.2-4.6 13.6-10 14.1-10.5c4.7-4.4 13.5-14.2 27.9-14.2c7.1 0 15.6 2.3 25.9 8.9c6.3 4.1 11.3 4.4 22.6 9.3c8.4 3.5 13.7 9.7 10.5 18.2c-2.6 7.1-11 14.4-22.7 18.1c-11.1 3.6-19.8 16-38.2 14.9c-3.9-.2-7-1-9.6-2.1c-8-3.5-12.2-10.4-20-15c-8.6-4.8-13.2-10.4-14.7-15.3q-2.1-7.35 4.2-12.3m3.3 334c-2.7 35.1-43.9 34.4-75.3 18c-29.9-15.8-68.6-6.5-76.5-21.9c-2.4-4.7-2.4-12.7 2.6-26.4v-.2c2.4-7.6.6-16-.6-23.9c-1.2-7.8-1.8-15 .9-20c3.5-6.7 8.5-9.1 14.8-11.3c10.3-3.7 11.8-3.4 19.6-9.9c5.5-5.7 9.5-12.9 14.3-18c5.1-5.5 10-8.1 17.7-6.9c8.1 1.2 15.1 6.8 21.9 16l19.6 35.6c9.5 19.9 43.1 48.4 41 68.9m-1.4-25.9c-4.1-6.6-9.6-13.6-14.4-19.6c7.1 0 14.2-2.2 16.7-8.9c2.3-6.2 0-14.9-7.4-24.9c-13.5-18.2-38.3-32.5-38.3-32.5c-13.5-8.4-21.1-18.7-24.6-29.9s-3-23.3-.3-35.2c5.2-22.9 18.6-45.2 27.2-59.2c2.3-1.7.8 3.2-8.7 20.8c-8.5 16.1-24.4 53.3-2.6 82.4c.6-20.7 5.5-41.8 13.8-61.5c12-27.4 37.3-74.9 39.3-112.7c1.1.8 4.6 3.2 6.2 4.1c4.6 2.7 8.1 6.7 12.6 10.3c12.4 10 28.5 9.2 42.4 1.2c6.2-3.5 11.2-7.5 15.9-9c9.9-3.1 17.8-8.6 22.3-15c7.7 30.4 25.7 74.3 37.2 95.7c6.1 11.4 18.3 35.5 23.6 64.6c3.3-.1 7 .4 10.9 1.4c13.8-35.7-11.7-74.2-23.3-84.9c-4.7-4.6-4.9-6.6-2.6-6.5c12.6 11.2 29.2 33.7 35.2 59c2.8 11.6 3.3 23.7.4 35.7c16.4 6.8 35.9 17.9 30.7 34.8c-2.2-.1-3.2 0-4.2 0c3.2-10.1-3.9-17.6-22.8-26.1c-19.6-8.6-36-8.6-38.3 12.5c-12.1 4.2-18.3 14.7-21.4 27.3c-2.8 11.2-3.6 24.7-4.4 39.9c-.5 7.7-3.6 18-6.8 29c-32.1 22.9-76.7 32.9-114.3 7.2m257.4-11.5c-.9 16.8-41.2 19.9-63.2 46.5c-13.2 15.7-29.4 24.4-43.6 25.5s-26.5-4.8-33.7-19.3c-4.7-11.1-2.4-23.1 1.1-36.3c3.7-14.2 9.2-28.8 9.9-40.6c.8-15.2 1.7-28.5 4.2-38.7c2.6-10.3 6.6-17.2 13.7-21.1c.3-.2.7-.3 1-.5c.8 13.2 7.3 26.6 18.8 29.5c12.6 3.3 30.7-7.5 38.4-16.3c9-.3 15.7-.9 22.6 5.1c9.9 8.5 7.1 30.3 17.1 41.6c10.6 11.6 14 19.5 13.7 24.6M173.3 148.7c2 1.9 4.7 4.5 8 7.1c6.6 5.2 15.8 10.6 27.3 10.6c11.6 0 22.5-5.9 31.8-10.8c4.9-2.6 10.9-7 14.8-10.4s5.9-6.3 3.1-6.6s-2.6 2.6-6 5.1c-4.4 3.2-9.7 7.4-13.9 9.8c-7.4 4.2-19.5 10.2-29.9 10.2s-18.7-4.8-24.9-9.7c-3.1-2.5-5.7-5-7.7-6.9c-1.5-1.4-1.9-4.6-4.3-4.9c-1.4-.1-1.8 3.7 1.7 6.5" /></svg>';
    }

    return null;
  }

  function buildFriendlyAssetPath(platform, arch, format) {
    return "/" + getFriendlyPlatformName(platform) + "-" + arch + "." + format;
  }

  function buildFriendlyAssetUrl(platform, arch, format) {
    return friendlyDownloadOrigin.replace(/\/$/, "") + buildFriendlyAssetPath(platform, arch, format);
  }

  function getFriendlyPlatformName(platform) {
    if (platform === "mac") return "macos";
    return platform;
  }

  function parseFriendlyAssetPath(pathname) {
    var match = /^\/(macos|windows|linux)-(arm64|x64)\.(dmg|exe|appimage|zip)$/i.exec(pathname || "");
    if (!match) return null;
    return {
      platform: match[1].toLowerCase() === "macos" ? "mac" : match[1].toLowerCase(),
      arch: match[2].toLowerCase(),
      format: match[3].toLowerCase(),
    };
  }

  function parsePlatformPath(pathname) {
    var match = /^\/(windows|macos|mac|linux)\/?$/i.exec(pathname || "");
    if (!match) return null;
    return match[1].toLowerCase() === "macos" ? "mac" : match[1].toLowerCase();
  }

  function isAutoDownloadRequest() {
    var params = new URLSearchParams(window.location.search);
    var value = params.get("download");
    return value === "1" || value === "true";
  }

  function setRouteStatus(message, variant) {
    var node = document.querySelector("[data-download-route-status]");
    if (!node) return;
    node.textContent = message;
    node.dataset.state = variant || "info";
  }

  function setRoutePlatform(platform) {
    var titleNode = document.querySelector("[data-download-route-title]");
    var iconNode = document.querySelector("[data-download-route-icon]");
    var platformName = platformNames[platform];

    if (titleNode) {
      titleNode.textContent = platformName
        ? "Downloading StrictLLM for " + platformName + "..."
        : "Resolving download";
    }

    if (!iconNode) return;

    var iconSvg = getPlatformIconSvg(platform);
    if (iconSvg) {
      iconNode.innerHTML = iconSvg;
      return;
    }

    iconNode.innerHTML = '<span class="material-symbols-outlined text-4xl text-primary">download</span>';
  }

  function setRouteBackLink(href, label) {
    var node = document.querySelector("[data-download-route-link]");
    if (!node) return;
    node.href = href;
    node.textContent = label;
    node.classList.remove("hidden");
  }

  function normalizeArch(value) {
    if (!value) return null;
    var normalized = String(value).toLowerCase();
    if (normalized.indexOf("arm") !== -1 || normalized.indexOf("aarch64") !== -1) return "arm64";
    if (normalized.indexOf("64") !== -1 || normalized.indexOf("x86_64") !== -1 || normalized.indexOf("amd64") !== -1) return "x64";
    return null;
  }

  function detectArch() {
    if (typeof navigator === "undefined") return null;

    if (navigator.userAgentData && Array.isArray(navigator.userAgentData.brands)) {
      if (typeof navigator.userAgentData.architecture === "string") {
        var uaDataArch = normalizeArch(navigator.userAgentData.architecture);
        if (uaDataArch) return uaDataArch;
      }
      if (typeof navigator.userAgentData.getHighEntropyValues === "function") {
        navigator.userAgentData.getHighEntropyValues(["architecture"]).then(function (result) {
          var highEntropyArch = normalizeArch(result && result.architecture);
          if (highEntropyArch) refreshArchSensitiveDownloads(highEntropyArch);
        }).catch(function () {});
      }
    }

    var platform = navigator.platform || "";
    var ua = navigator.userAgent || "";
    return normalizeArch(platform) || normalizeArch(ua);
  }

  function detectPlatform() {
    var platform = "windows";
    if (typeof navigator !== "undefined") {
      var ua = navigator.userAgent || "";
      if (ua.indexOf("Win") !== -1) platform = "windows";
      else if (ua.indexOf("Mac") !== -1) platform = "mac";
      else if (ua.indexOf("Linux") !== -1 || ua.indexOf("X11") !== -1) platform = "linux";
    }
    return platform;
  }

  function getPreferredArchs(platform) {
    var defaults = (platformArchOptions[platform] || []).slice();
    var detectedArch = detectArch();
    var preferred = [];

    if (detectedArch && defaults.indexOf(detectedArch) !== -1) {
      preferred.push(detectedArch);
    }

    defaults.forEach(function (arch) {
      if (preferred.indexOf(arch) === -1) preferred.push(arch);
    });

    return preferred;
  }

  function refreshArchSensitiveDownloads(detectedArch) {
    Object.keys(platformArchOptions).forEach(function (platform) {
      var current = platformDownloads[platform];
      if (!current || current.status !== "ready") return;
      if (platformArchOptions[platform].indexOf(detectedArch) === -1) return;
      if (current.arch === detectedArch) return;
      loadPlatformDownload(platform, [detectedArch].concat(getPreferredArchs(platform)));
    });
  }

  async function fetchLatestRelease() {
    var now = Date.now();
    if (latestReleaseCache && (now - latestReleaseCache.ts) < releaseCacheTtlMs) {
      return latestReleaseCache.data;
    }

    if (!latestReleasePromise) {
      latestReleasePromise = fetch(latestReleaseUrl, {
        headers: { Accept: "application/vnd.github+json" },
        cache: "no-store",
      }).then(function (response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
      }).then(function (data) {
        latestReleaseCache = { ts: Date.now(), data: data };
        latestReleasePromise = null;
        return data;
      }).catch(function (error) {
        latestReleasePromise = null;
        throw error;
      });
    }

    return latestReleasePromise;
  }

  function getReleaseVersion(release) {
    var rawVersion = release && (release.tag_name || release.name || "");
    return String(rawVersion).replace(/^v/i, "");
  }

  function inferAssetPlatform(assetName) {
    var lower = String(assetName || "").toLowerCase();
    if (lower.indexOf("windows") !== -1) return "windows";
    if (lower.indexOf("macos") !== -1 || lower.indexOf("-mac") !== -1) return "mac";
    if (lower.indexOf("linux") !== -1 || lower.indexOf(".appimage") !== -1) return "linux";
    return null;
  }

  function inferAssetArch(assetName) {
    var lower = String(assetName || "").toLowerCase();
    if (/(^|[^a-z0-9])arm64([^a-z0-9]|$)|aarch64/.test(lower)) return "arm64";
    if (/(^|[^a-z0-9])x64([^a-z0-9]|$)|x86_64|amd64/.test(lower)) return "x64";
    return null;
  }

  function inferAssetFormat(assetName) {
    var lower = String(assetName || "").toLowerCase();
    if (/\.dmg$/.test(lower)) return "dmg";
    if (/\.exe$/.test(lower)) return "exe";
    if (/\.appimage$/.test(lower)) return "appimage";
    if (/\.zip$/.test(lower)) return "zip";
    return null;
  }

  function getAssetPriority(asset, platform) {
    var name = String(asset && asset.name || "").toLowerCase();
    if (
      name.indexOf(".blockmap") !== -1 ||
      name.indexOf(".yml") !== -1 ||
      name.indexOf("builder-debug") !== -1
    ) {
      return -1;
    }

    if (platform === "windows") {
      if (/\.exe$/.test(name)) return 100;
      return 10;
    }

    if (platform === "mac") {
      if (/\.dmg$/.test(name)) return 100;
      if (/\.zip$/.test(name)) return 50;
      return 10;
    }

    if (platform === "linux") {
      if (/\.appimage$/.test(name)) return 100;
      return 10;
    }

    return 0;
  }

  function normalizeReleaseAssets(release) {
    var version = getReleaseVersion(release);
    var assets = Array.isArray(release && release.assets) ? release.assets : [];

    return assets.map(function (asset) {
      var platform = inferAssetPlatform(asset && asset.name);
      var arch = inferAssetArch(asset && asset.name);
      var format = inferAssetFormat(asset && asset.name);
      if (!platform || !arch || !format) return null;

      var priority = getAssetPriority(asset, platform);
      if (priority < 0) return null;

      return {
        platform: platform,
        arch: arch,
        format: format,
        version: version,
        name: asset.name,
        priority: priority,
        url: asset.browser_download_url,
        friendlyPath: buildFriendlyAssetPath(platform, arch, format),
        friendlyUrl: buildFriendlyAssetUrl(platform, arch, format),
      };
    }).filter(Boolean);
  }

  function extractReleaseDownloads(release) {
    var downloads = {};

    normalizeReleaseAssets(release).forEach(function (asset) {
      if (!downloads[asset.platform]) downloads[asset.platform] = {};
      var current = downloads[asset.platform][asset.arch];

      if (!current || asset.priority > current.priority) {
        downloads[asset.platform][asset.arch] = asset;
      }
    });

    return downloads;
  }

  function findFriendlyAsset(downloads, requestDetails) {
    var byPlatform = downloads[requestDetails.platform] || {};
    return Object.keys(byPlatform).map(function (arch) {
      return byPlatform[arch];
    }).find(function (asset) {
      return asset.arch === requestDetails.arch && asset.format === requestDetails.format;
    }) || null;
  }

  function selectPlatform(platform) {
    selectedPlatform = platform;
    updateSelectedPlatformUI();

    document.querySelectorAll(".platform-card").forEach(function (card) {
      card.classList.remove("recommended", "border-primary");
      card.classList.add("border-border-dark");
      var badge = card.querySelector(".recommended-badge");
      if (badge) badge.classList.add("hidden");
    });

    var selected = document.querySelector('[data-platform="' + platform + '"]');
    if (selected) {
      selected.classList.remove("border-border-dark");
      selected.classList.add("recommended", "border-primary");
      var selectedBadge = selected.querySelector(".recommended-badge");
      if (selectedBadge) selectedBadge.classList.remove("hidden");
    }
  }

  function formatArchLabel(arch) {
    if (arch === "arm64") return "ARM64";
    if (arch === "x64") return "x64";
    return arch;
  }

  function formatPlatformDescription(platform, arch) {
    return formatArchLabel(arch) + " " + (platformDescriptions[platform] || "installer");
  }

  function getAlternativeArchLabel(platform, arch) {
    var platformLabels = alternativeArchLabels[platform] || {};
    return platformLabels[arch] || formatArchLabel(arch);
  }

  function getAlternativeDownload(platform, details) {
    if (!details || !details.byArch) return null;

    var allowedLabels = alternativeArchLabels[platform] || {};
    var candidates = Object.keys(allowedLabels).filter(function (arch) {
      return arch !== details.arch && details.byArch[arch];
    });

    if (!candidates.length) return null;
    return details.byArch[candidates[0]];
  }

  function hideAlternativeLink(link) {
    link.classList.add("hidden");
    link.removeAttribute("href");
    link.textContent = "";
  }

  function updateAlternativeLink(platform, details) {
    var alternativeLink = document.getElementById("secondary-download-link");
    if (!alternativeLink) return;

    var alternative = getAlternativeDownload(platform, details);
    if (!alternative) {
      hideAlternativeLink(alternativeLink);
      return;
    }

    alternativeLink.href = alternative.friendlyUrl;
    alternativeLink.textContent = "Need " + getAlternativeArchLabel(platform, alternative.arch) + "?";
    alternativeLink.classList.remove("hidden");
  }

  function updateSelectedPlatformUI() {
    var platform = selectedPlatform || "windows";
    var platformName = platformNames[platform] || "Windows";
    var details = platformDownloads[platform];
    var detected = document.getElementById("detected");
    var downloadBtn = document.getElementById("download-btn");
    var downloadCopy = document.getElementById("download-copy");
    var alternativeLink = document.getElementById("secondary-download-link");

    if (!detected || !downloadBtn || !downloadCopy) return;

    document.getElementById("platform-name").textContent = platformName;

    if (!details || details.status === "loading") {
      detected.textContent = "Looking up the latest " + platformName + " release...";
      downloadCopy.textContent = "Checking latest release for";
      if (alternativeLink) hideAlternativeLink(alternativeLink);
      downloadBtn.setAttribute("aria-disabled", "true");
      downloadBtn.removeAttribute("href");
      downloadBtn.classList.add("opacity-60", "pointer-events-none");
      return;
    }

    if (details.status === "ready") {
      detected.textContent = "Selected: " + platformName + " " + details.version + " (" + formatArchLabel(details.arch) + ")";
      downloadBtn.href = details.friendlyUrl;
      downloadBtn.removeAttribute("aria-disabled");
      downloadBtn.classList.remove("opacity-60", "pointer-events-none");
      downloadCopy.textContent = "Download v" + details.version + " for";
      updateAlternativeLink(platform, details);
      return;
    }

    detected.textContent = "Latest " + platformName + " release is temporarily unavailable.";
    downloadCopy.textContent = "Download unavailable for";
    if (alternativeLink) hideAlternativeLink(alternativeLink);
    downloadBtn.setAttribute("aria-disabled", "true");
    downloadBtn.removeAttribute("href");
    downloadBtn.classList.add("opacity-60", "pointer-events-none");
  }

  function updatePlatformCard(platform) {
    var card = document.querySelector('[data-platform="' + platform + '"]');
    if (!card) return;

    var details = platformDownloads[platform];
    var meta = card.querySelector(".platform-meta");
    var archLabel = card.querySelector(".platform-arch");
    var description = card.querySelector("p");
    if (!meta || !archLabel || !description) return;

    if (!details || details.status === "loading") {
      meta.textContent = "Checking latest release...";
      archLabel.textContent = "...";
      description.textContent = "Looking for the newest available build";
      return;
    }

    if (details.status === "ready") {
      meta.textContent = "version " + details.version;
      archLabel.textContent = formatArchLabel(details.arch);
      description.textContent = formatPlatformDescription(platform, details.arch);
      return;
    }

    meta.textContent = "Release feed unavailable";
    archLabel.textContent = "--";
    description.textContent = "Could not load the latest installer right now. If the issue persists, please contact support.";
  }

  async function loadPlatformDownload(platform, preferredArchs) {
    var archs = [];
    (preferredArchs || getPreferredArchs(platform)).forEach(function (arch) {
      if (archs.indexOf(arch) === -1) archs.push(arch);
    });

    platformDownloads[platform] = { status: "loading" };
    updatePlatformCard(platform);
    if (selectedPlatform === platform) updateSelectedPlatformUI();

    var releaseDownloads;
    try {
      releaseDownloads = extractReleaseDownloads(await fetchLatestRelease());
    } catch (error) {
      platformDownloads[platform] = { status: "error" };
      updatePlatformCard(platform);
      if (selectedPlatform === platform) updateSelectedPlatformUI();
      return;
    }

    var byArch = {};
    var availableByArch = releaseDownloads[platform] || {};

    archs.forEach(function (arch) {
      if (availableByArch[arch]) byArch[arch] = availableByArch[arch];
    });

    Object.keys(availableByArch).forEach(function (arch) {
      if (!byArch[arch]) byArch[arch] = availableByArch[arch];
    });

    var availableArchs = Object.keys(byArch);
    if (!availableArchs.length) {
      platformDownloads[platform] = { status: "error" };
      updatePlatformCard(platform);
      if (selectedPlatform === platform) updateSelectedPlatformUI();
      return;
    }

    var primaryArch = availableArchs[0];
    var primaryDownload = byArch[primaryArch];

    platformDownloads[platform] = {
      status: "ready",
      arch: primaryArch,
      version: primaryDownload.version,
      url: primaryDownload.url,
      friendlyUrl: primaryDownload.friendlyUrl,
      byArch: byArch,
    };

    updatePlatformCard(platform);
    if (selectedPlatform === platform) updateSelectedPlatformUI();
  }

  async function handleFriendlyAssetRoute(requestDetails) {
    setRoutePlatform(requestDetails.platform);
    setRouteStatus(platformRouteDescriptions[requestDetails.platform] || "Preparing your download.", "info");

    try {
      var downloads = extractReleaseDownloads(await fetchLatestRelease());
      var asset = findFriendlyAsset(downloads, requestDetails);
      if (asset) {
        setRouteBackLink(asset.url, "If your download does not begin, click here");
        window.setTimeout(function () {
          window.location.replace(asset.url);
        }, 150);
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve friendly download URL", error);
    }

    setRouteStatus("That download is not available in the current published release.", "error");
    setRouteBackLink(downloadPageUrl, "Back to downloads");
    return false;
  }

  async function handleAutoDownloadRoute(requestedPlatform) {
    var platform = requestedPlatform || detectPlatform();
    var preferredArchs = getPreferredArchs(platform);

    setRoutePlatform(platform);
    setRouteStatus(platformRouteDescriptions[platform] || "Preparing your download.", "info");

    try {
      var releaseDownloads = extractReleaseDownloads(await fetchLatestRelease());
      var availableByArch = releaseDownloads[platform] || {};
      var asset = null;

      preferredArchs.some(function (arch) {
        if (availableByArch[arch]) {
          asset = availableByArch[arch];
          return true;
        }
        return false;
      });

      if (!asset) {
        var fallbackArch = Object.keys(availableByArch)[0];
        asset = fallbackArch ? availableByArch[fallbackArch] : null;
      }

      if (asset) {
        setRouteBackLink(asset.url, "If your download does not begin, click here");
        window.setTimeout(function () {
          window.location.replace(asset.url);
        }, 150);
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve auto-download request", error);
    }

    setRouteStatus("Automatic download is unavailable right now. Choose an installer manually instead.", "error");
    setRouteBackLink(downloadPageUrl, "Back to downloads");
    return false;
  }

  function initDownloadUi() {
    document.querySelectorAll("[data-current-year]").forEach(function (node) {
      node.textContent = new Date().getFullYear();
    });

    var platform = detectPlatform();
    selectPlatform(platform);

    document.querySelectorAll(".platform-card").forEach(function (card) {
      card.addEventListener("click", function (event) {
        if (event.target.closest("a")) return;
        event.preventDefault();
        selectPlatform(card.dataset.platform);

        var selectedDownload = platformDownloads[card.dataset.platform];
        if (selectedDownload && selectedDownload.status === "ready") {
          document.getElementById("download-btn").focus();
        }
      });
    });

    var secondaryLink = document.getElementById("secondary-download-link");
    if (secondaryLink) {
      secondaryLink.addEventListener("click", function (event) {
        event.stopPropagation();
      });
    }

    Object.keys(platformNames).forEach(function (name) {
      loadPlatformDownload(name);
    });
  }

  async function init() {
    var friendlyAssetRequest = parseFriendlyAssetPath(window.location.pathname);
    var platformRequest = parsePlatformPath(window.location.pathname);
    if (friendlyAssetRequest) {
      await handleFriendlyAssetRoute(friendlyAssetRequest);
    } else if (platformRequest) {
      await handleAutoDownloadRoute(platformRequest);
    } else if (isAutoDownloadRequest()) {
      await handleAutoDownloadRoute();
    }

    if (document.body && document.body.dataset.page === "download") {
      initDownloadUi();
    }
  }

  init();
})();
