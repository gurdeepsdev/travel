const reelsElement = document.querySelector("#reels");
const formElement = document.querySelector("#config-form");
const summaryElement = document.querySelector("#summary");
const instances = new Map();
let posts = [];
let feedStartedAt = 0;

const now = () => performance.now();
const elapsed = (start) => `${Math.round(now() - start)} ms`;
const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function getPosts(response) {
  const data = response?.data ?? {};
  const items = data.items ?? [];
  const candidates = items.length
    ? items.map((item) => item.post ?? item)
    : data.posts ?? data.videos ?? [];

  return candidates.filter((post) =>
    post?.assets?.some((asset) =>
      asset?.mediaType === "video" || asset?.mimeType?.startsWith("video/"),
    ),
  );
}

function getVideoAsset(post) {
  return post.assets.find((asset) =>
    asset?.mediaType === "video" || asset?.mimeType?.startsWith("video/"),
  );
}

function chooseUrl(asset) {
  return asset.startupStreamUrl || asset.streamUrl || asset.url || null;
}

function diagnosticMarkup(post, asset, index) {
  const source = asset.startupStreamUrl
    ? "startupStreamUrl (direct 360p)"
    : asset.streamUrl
      ? "streamUrl (adaptive master)"
      : "MP4 fallback";

  return `
    <aside class="diagnostics">
      <dl>
        <dt>Reel</dt><dd>${index + 1}/${posts.length}</dd>
        <dt>Asset</dt><dd>${escapeHtml(asset.id ?? "unknown")}</dd>
        <dt>Provider</dt><dd>${escapeHtml(asset.storageProvider ?? "unknown")}</dd>
        <dt>Source</dt><dd>${escapeHtml(source)}</dd>
        <dt>Player</dt><dd data-field="player">pending</dd>
        <dt>Manifest</dt><dd data-field="manifest">pending</dd>
        <dt>First frame after activation</dt><dd data-field="first-frame">pending</dd>
        <dt>Buffer</dt><dd data-field="buffer">0.0 s</dd>
        <dt>Status</dt><dd class="pending" data-field="status">waiting</dd>
      </dl>
    </aside>
    <div class="meta">
      <h2>@${escapeHtml(post.author?.username ?? "unknown")}</h2>
      <p>${escapeHtml(post.caption || "No caption")}</p>
    </div>`;
}

function render() {
  reelsElement.innerHTML = "";
  posts.forEach((post, index) => {
    const asset = getVideoAsset(post);
    const section = document.createElement("section");
    section.className = "reel";
    section.dataset.index = String(index);
    section.innerHTML = `
      <video playsinline muted loop preload="none" poster="${escapeHtml(asset.thumbnailUrl ?? "")}"></video>
      ${diagnosticMarkup(post, asset, index)}`;
    reelsElement.append(section);
  });
  observeReels();
}

function update(section, field, value, state) {
  const element = section.querySelector(`[data-field="${field}"]`);
  if (!element) return;
  element.textContent = value;
  if (state) element.className = state;
}

function initialize(index, autoplay = false) {
  if (index < 0 || index >= posts.length || instances.has(index)) return;

  const section = reelsElement.querySelector(`[data-index="${index}"]`);
  const video = section.querySelector("video");
  const asset = getVideoAsset(posts[index]);
  const url = chooseUrl(asset);
  const startedAt = now();
  const authorization = document.querySelector("#access-token").value.trim();
  const headers = authorization ? { Authorization: `Bearer ${authorization}` } : {};
  const record = {
    video,
    hls: null,
    firstFrame: false,
    activatedAt: autoplay ? now() : null,
  };
  instances.set(index, record);

  const play = () => {
    if (autoplay) video.play().catch(() => update(section, "status", "click video to play", "pending"));
  };

  video.addEventListener("loadedmetadata", () => {
    update(section, "player", elapsed(startedAt), "ok");
    play();
  }, { once: true });

  video.addEventListener("playing", () => {
    update(section, "status", "playing", "ok");
  });
  video.addEventListener("waiting", () => update(section, "status", "buffering", "pending"));
  video.addEventListener("error", () => update(section, "status", `video error ${video.error?.code ?? ""}`, "error"));
  video.addEventListener("click", () => video.paused ? video.play() : video.pause());
  video.addEventListener("timeupdate", () => {
    if (!video.buffered.length) return;
    const end = video.buffered.end(video.buffered.length - 1);
    update(section, "buffer", `${Math.max(0, end - video.currentTime).toFixed(1)} s`);
  });

  if (!url) {
    update(section, "status", "no playable URL", "error");
    return;
  }

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    update(section, "manifest", "native HLS", "ok");
    video.load();
    return;
  }

  if (!window.Hls?.isSupported()) {
    update(section, "status", "HLS unsupported", "error");
    return;
  }

  const hls = new Hls({
    startLevel: 0,
    capLevelToPlayerSize: true,
    maxBufferLength: 8,
    maxMaxBufferLength: 20,
    xhrSetup(xhr, requestUrl) {
      if (!requestUrl.startsWith("https://apitest.artictern.com/")) return;
      Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    },
  });
  record.hls = hls;
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
    update(section, "manifest", elapsed(startedAt), "ok");
    play();
  });
  hls.on(Hls.Events.ERROR, (_event, data) => {
    if (data.fatal) update(section, "status", `${data.type}: ${data.details}`, "error");
  });
  hls.loadSource(url);
  hls.attachMedia(video);
}

function activate(index) {
  for (const [itemIndex, instance] of instances) {
    if (itemIndex !== index) {
      instance.video.pause();
    }
    if (Math.abs(itemIndex - index) > 2) {
      instance.hls?.destroy();
      instance.video.removeAttribute("src");
      instance.video.load();
      instances.delete(itemIndex);
    }
  }
  initialize(index, true);
  initialize(index + 1, false);
  initialize(index + 2, false);
  const active = instances.get(index);
  if (!active) return;
  const activationStartedAt = now();
  active.activatedAt = activationStartedAt;
  const activeSection =
    reelsElement.querySelector(`[data-index="${index}"]`);
  active.video.play()
    .then(() => {
      if (active.firstFrame) return;
      active.firstFrame = true;
      update(
        activeSection,
        "first-frame",
        elapsed(activationStartedAt),
        "ok",
      );
    })
    .catch(() => {});
}

function observeReels() {
  const observer = new IntersectionObserver((entries) => {
    const active = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (active?.intersectionRatio >= 0.6) activate(Number(active.target.dataset.index));
  }, { root: reelsElement, threshold: [0.6, 0.85] });

  document.querySelectorAll(".reel").forEach((reel) => observer.observe(reel));
}

function destroyPlayers() {
  for (const instance of instances.values()) {
    instance.video.pause();
    instance.hls?.destroy();
  }
  instances.clear();
}

async function loadFeed() {
  destroyPlayers();
  const feedUrl = document.querySelector("#feed-url").value.trim();
  const token = document.querySelector("#access-token").value.trim();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  feedStartedAt = now();
  summaryElement.textContent = "Loading feed…";

  const response = await fetch(feedUrl, { headers });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || `Feed returned ${response.status}`);

  posts = getPosts(payload);
  summaryElement.textContent = `${posts.length} videos · feed ${elapsed(feedStartedAt)}`;
  if (!posts.length) throw new Error("Feed returned no video posts");
  render();
}

formElement.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadFeed();
    document.querySelector("details").open = false;
  } catch (error) {
    summaryElement.textContent = error.message;
    reelsElement.innerHTML = `<section class="empty-state"><h1>Load failed</h1><p>${escapeHtml(error.message)}</p></section>`;
  }
});
