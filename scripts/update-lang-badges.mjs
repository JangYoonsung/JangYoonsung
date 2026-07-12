import { readFileSync, writeFileSync } from "node:fs";

const USERNAME = "JangYoonsung";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = "README.md";
const START_MARKER = "<!-- LANG-STATS:START -->";
const END_MARKER = "<!-- LANG-STATS:END -->";

const LANG_COLORS = {
  Go: ["00ADD8", "go", "white"],
  TypeScript: ["3178C6", "typescript", "white"],
  Python: ["3572A5", "python", "white"],
  PHP: ["777BB4", "php", "white"],
  JavaScript: ["F7DF1E", "javascript", "black"],
  CSS: ["563D7C", "css3", "white"],
  Vue: ["41B883", "vuedotjs", "white"],
  Shell: ["89E051", "gnubash", "black"],
  HTML: ["E34F26", "html5", "white"],
  Dockerfile: ["2496ED", "docker", "white"],
  Makefile: ["427819", "gnu", "white"],
  Ruby: ["701516", "ruby", "white"],
  Java: ["B07219", "openjdk", "white"],
  Kotlin: ["A97BFF", "kotlin", "white"],
  Swift: ["F05138", "swift", "white"],
  Rust: ["DEA584", "rust", "black"],
};

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function listOwnedPublicRepos() {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await gh(`/users/${USERNAME}/repos?per_page=100&page=${page}&type=owner`);
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos.filter((r) => !r.fork && !r.archived);
}

async function main() {
  const repos = await listOwnedPublicRepos();
  const totals = {};
  for (const repo of repos) {
    const langs = await gh(`/repos/${USERNAME}/${repo.name}/languages`);
    for (const [lang, bytes] of Object.entries(langs)) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  const totalBytes = Object.values(totals).reduce((a, b) => a + b, 0);
  const ranked = Object.entries(totals)
    .map(([lang, bytes]) => ({ lang, pct: (bytes / totalBytes) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .filter((r) => r.pct >= 1)
    .slice(0, 6);

  const badges = ranked
    .map(({ lang, pct }) => {
      const [color, logo, logoColor] = LANG_COLORS[lang] || ["555555", "", "white"];
      const label = encodeURIComponent(lang);
      const pctStr = pct.toFixed(1);
      const logoParam = logo ? `&logo=${logo}&logoColor=${logoColor}` : "";
      return `  <img src="https://img.shields.io/badge/${label}-${pctStr}%25-${color}?style=flat-square${logoParam}"/>`;
    })
    .join("\n");

  const block = [
    START_MARKER,
    '<p align="center"><sub>Top Languages (by bytes across public repos, auto-updated)</sub></p>',
    '<p align="center">',
    badges,
    "</p>",
    END_MARKER,
  ].join("\n");

  const readme = readFileSync(README_PATH, "utf8");
  const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
  if (!pattern.test(readme)) {
    throw new Error("LANG-STATS markers not found in README.md");
  }
  const updated = readme.replace(pattern, block);
  writeFileSync(README_PATH, updated);

  console.log("Computed language shares:");
  for (const { lang, pct } of ranked) console.log(`  ${lang}: ${pct.toFixed(1)}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
