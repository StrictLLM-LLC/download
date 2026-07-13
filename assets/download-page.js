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
    setRouteStatus("Resolving the latest matching StrictLLM download...", "info");
    setRouteBackLink(downloadPageUrl, "Back to downloads");

    try {
      var downloads = extractReleaseDownloads(await fetchLatestRelease());
      var asset = findFriendlyAsset(downloads, requestDetails);
      if (asset) {
        window.location.replace(asset.url);
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve friendly download URL", error);
    }

    setRouteStatus("That download is not available in the current published release.", "error");
    return false;
  }

  async function handleAutoDownloadRoute() {
    var platform = detectPlatform();
    var preferredArchs = getPreferredArchs(platform);

    setRouteStatus("Detecting your platform and resolving the latest installer...", "info");
    setRouteBackLink(downloadPageUrl, "Back to downloads");

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
        window.location.replace(asset.url);
        return true;
      }
    } catch (error) {
      console.error("Failed to resolve auto-download request", error);
    }

    setRouteStatus("Automatic download is unavailable right now. Choose an installer manually instead.", "error");
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
    if (friendlyAssetRequest) {
      await handleFriendlyAssetRoute(friendlyAssetRequest);
    } else if (isAutoDownloadRequest()) {
      await handleAutoDownloadRoute();
    }

    if (document.body && document.body.dataset.page === "download") {
      initDownloadUi();
    }
  }

  init();
})();
