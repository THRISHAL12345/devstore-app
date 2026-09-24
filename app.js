// Shows the latest release's version, date, and size next to the download button.
// The download links work without this script: they always point at the latest installer.
(async () => {
  const meta = document.getElementById("release-meta");
  const notes = document.getElementById("release-notes");
  try {
    const res = await fetch(
      "https://api.github.com/repos/THRISHAL12345/devstore-app/releases/latest",
      {
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (!res.ok) return;
    const release = await res.json();
    const asset = (release.assets || []).find((a) => a.name === "DevStore-Setup-x64.exe");
    const version = String(release.tag_name || "").replace(/^v/, "");
    const date = release.published_at
      ? new Date(release.published_at).toLocaleDateString(undefined, {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";
    const size = asset ? `${(asset.size / 1024 / 1024).toFixed(1)} MB` : "";
    meta.textContent = [
      version && `Version ${version}`,
      date,
      size,
      "x64",
      "no admin rights needed",
    ]
      .filter(Boolean)
      .join(" · ");
    if (release.html_url && release.html_url.startsWith("https://github.com/"))
      notes.href = release.html_url;
  } catch {
    // Offline or rate limited: keep the default text.
  }
})();
