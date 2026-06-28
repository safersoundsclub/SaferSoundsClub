/**
 * build-blog.mjs
 * Reads content/blog/*.md → generates blog/*.html
 * Also rebuilds the blog index card grid in blog.html
 *
 * Run: node scripts/build-blog.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content", "blog");
const BLOG_DIR = path.join(ROOT, "blog");
const BLOG_INDEX = path.join(ROOT, "blog.html");

// ── Hero image src resolution ─────────────────────────────────────────────────
// Legacy format:  "Umbrella"          → ../images/Umbrella.png
// Tina upload:    "/images/photo.jpg" → ../images/photo.jpg
function heroSrcForPost(heroImage) {
  if (!heroImage) return "../images/Umbrella.png";
  if (heroImage.startsWith("/")) return `..${heroImage}`;
  return `../images/${heroImage}.png`;
}

function heroSrcForIndex(heroImage) {
  if (!heroImage) return "images/Umbrella.png";
  if (heroImage.startsWith("/")) return heroImage.slice(1);
  return `images/${heroImage}.png`;
}

// ── Minimal markdown → HTML (headings, bold, italic, paragraphs) ─────────────
function mdToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let inPara = false;

  const flush = () => {
    if (inPara) { out.push("</p>"); inPara = false; }
  };

  const inline = (s) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith("## ")) {
      flush();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      flush();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
    } else {
      if (!inPara) { out.push("<p>"); inPara = true; }
      else out.push(" ");
      out.push(inline(line));
    }
  }
  flush();
  return out.join("\n");
}

// ── Parse the legacy ---faq--- block (existing migrated posts) ────────────────
function parseFaqBlock(raw) {
  if (!raw.trim()) return [];
  const items = [];
  const blocks = raw.trim().split(/\n(?=\*\*)/);
  for (const block of blocks) {
    const qMatch = block.match(/^\*\*(.+?)\*\*/);
    if (!qMatch) continue;
    const q = qMatch[1];
    const a = block.slice(qMatch[0].length).replace(/^\n+/, "").trim();
    items.push({ q, a });
  }
  return items;
}

// ── Parse a post file ─────────────────────────────────────────────────────────
function parsePost(raw) {
  const { data, content } = matter(raw);

  // Support legacy ---faq--- block in body (for migrated posts)
  const faqSplit = content.split("\n---faq---\n");
  const bodyRaw = faqSplit[0].trim();
  const faqRaw = faqSplit[1] || "";

  // FAQ: prefer structured frontmatter (Tina-saved), fall back to legacy block
  let faqItems = [];
  if (data.faq && Array.isArray(data.faq) && data.faq.length > 0) {
    faqItems = data.faq.map((item) => ({ q: item.question, a: item.answer }));
  } else if (faqRaw) {
    faqItems = parseFaqBlock(faqRaw);
  }

  return { data, bodyRaw, faqItems };
}

// ── HTML template for a blog post ─────────────────────────────────────────────
function renderPost(slug, data, bodyHtml, faqItems, prevPost, nextPost) {
  const {
    title = "",
    dateDisplay = "",
    description = "",
    heroImage = "",
  } = data;

  const heroImgSrc = heroSrcForPost(heroImage);

  const faqHtml =
    faqItems.length > 0
      ? `
  <div class="faq">
    <p class="faq-label">Frequently Asked Questions</p>
    ${faqItems
      .map(({ q, a }) => `
    <div class="faq-item">
      <h3>${q}</h3>
      <p>${a}</p>
    </div>`)
      .join("")}
  </div>`
      : "";

  const navLinks = [];
  if (prevPost) navLinks.push(`<a href="${prevPost.slug}.html">← ${prevPost.title}</a>`);
  if (nextPost) navLinks.push(`<a href="${nextPost.slug}.html">Next: ${nextPost.title} →</a>`);

  const postNavHtml =
    navLinks.length > 0
      ? `
  <div class="post-nav">
    ${navLinks.join("\n    ")}
  </div>`
      : "";

  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": description,
    "datePublished": data.date || "",
    "author": {"@type": "Person", "name": "Megan Carlson"},
    "publisher": {
      "@type": "Organization",
      "name": "The Safer Sounds Club",
      "url": "https://safersoundsclub.com",
      "logo": {"@type": "ImageObject", "url": "https://safersoundsclub.com/images/favicon.png"}
    },
    "image": heroImgSrc.startsWith("../") ? `https://safersoundsclub.com/${heroImgSrc.slice(3)}` : `https://safersoundsclub.com/${heroImgSrc}`,
    "mainEntityOfPage": {"@type": "WebPage", "@id": `https://safersoundsclub.com/blog/${slug}.html`}
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="icon" type="image/png" href="../images/favicon.png"><link rel="preload" href="../fonts/CoreBandiFace.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="../fonts/MeowScript.ttf" as="font" type="font/truetype" crossorigin>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — The Safer Sounds Club</title>
  <meta name="description" content="${description}">
  <script type="application/ld+json">${articleSchema}</script>
  <style>@font-face{font-family:'CoreBandiFace';src:url('../fonts/CoreBandiFace.woff2') format('woff2'),url('../fonts/CoreBandiFace.woff') format('woff'),url('../fonts/CoreBandiFace.ttf') format('truetype');font-weight:normal;font-style:normal;font-display:optional}@font-face{font-family:'MeowScript';src:url('../fonts/MeowScript.ttf') format('truetype');font-weight:normal;font-style:normal;font-display:optional}html{font-size:20px}*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--cream:#f5f0e8;--ink:#1a1a1a;--sage:#7a9e8a}body{background:var(--cream);color:var(--ink);font-family:'CoreBandiFace',cursive;font-size:21px;line-height:1.7}nav{position:sticky;top:0;z-index:100;background:var(--cream);border-bottom:1px solid rgba(26,26,26,0.12);padding:14px 40px;display:flex;align-items:center;justify-content:space-between}.nav-brand{font-family:'MeowScript',cursive;font-weight:400;font-size:1.6rem;color:var(--ink);text-decoration:none;white-space:nowrap}.nav-links{display:flex;gap:24px;list-style:none;flex-wrap:wrap}.nav-links a{font-family:'CoreBandiFace',cursive;font-size:1.1rem;letter-spacing:0.04em;text-transform:uppercase;text-decoration:none;color:var(--ink);opacity:.75}.nav-links a:hover{opacity:1}.nav-links a.active{color:var(--sage);opacity:1}.post-hero{height:180px;width:auto;max-width:90%;display:inline-block;mix-blend-mode:multiply;opacity:0.88;}.post-wrap{max-width:720px;margin:0 auto;padding:56px 32px 96px}.post-meta{font-family:'CoreBandiFace',cursive;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;opacity:.5;margin-bottom:16px}h1.post-title{font-size:clamp(1.5rem,4vw,2.1rem);font-weight:700;line-height:1.3;margin-bottom:32px}.post-body h2{font-size:1.1rem;font-weight:700;margin:40px 0 12px}.post-body h3{font-size:1rem;font-weight:700;margin:32px 0 10px}.post-body p{margin-bottom:1.1rem;font-size:1rem;line-height:1.85}.post-body em{font-style:italic}.post-body strong{font-weight:700}.faq{margin-top:48px;border-top:1.5px dashed rgba(26,26,26,0.2);padding-top:32px}.faq-label{font-family:'CoreBandiFace',cursive;font-size:.72rem;letter-spacing:.2em;text-transform:uppercase;opacity:.5;margin-bottom:24px}.faq-item{margin-bottom:28px}.faq-item h3{font-size:.97rem;font-weight:700;margin-bottom:8px}.faq-item p{font-size:.9rem;line-height:1.75;opacity:.88}.post-cta{margin-top:48px;padding:32px;border:1.5px dashed rgba(26,26,26,0.25);text-align:center}.post-cta p{font-size:.97rem;line-height:1.8;margin-bottom:20px}.btn-quiz{display:inline-flex;position:relative;align-items:center;justify-content:center;text-decoration:none;color:var(--ink);font-family:'CoreBandiFace',cursive;font-size:.78rem;letter-spacing:.18em;text-transform:uppercase;padding:16px 48px}.btn-quiz .bg{position:absolute;inset:0;border-radius:4px 6px 5px 3px/8px 4px 6px 5px;background:var(--sage);transform:rotate(-.3deg) scaleX(1.04)}.btn-quiz .label{position:relative;z-index:2}.post-nav{display:flex;justify-content:space-between;margin-top:48px;padding-top:24px;border-top:1.5px solid rgba(26,26,26,0.12);gap:24px;flex-wrap:wrap}.post-nav a{font-family:'CoreBandiFace',cursive;font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:var(--ink);opacity:.5}.post-nav a:hover{opacity:1}footer{text-align:center;padding:32px 32px 48px;border-top:1.5px solid rgba(26,26,26,0.12)}.footer-links{display:flex;gap:24px;justify-content:center;font-family:'CoreBandiFace',cursive;font-size:.72rem;letter-spacing:.12em;margin-top:12px}.footer-links a{text-decoration:none;color:var(--ink);opacity:.5}@media(max-width:600px){nav{padding:14px 20px}.nav-links{gap:16px}.post-wrap{padding:40px 20px 72px}}.nav-toggle{display:none;background:none;border:none;cursor:pointer;padding:4px;flex-direction:column;gap:5px;flex-shrink:0}.nav-toggle span{display:block;width:22px;height:1.5px;background:var(--ink);transition:transform .25s,opacity .2s}nav.open .nav-toggle span:nth-child(1){transform:translateY(6.5px) rotate(45deg)}nav.open .nav-toggle span:nth-child(2){opacity:0}nav.open .nav-toggle span:nth-child(3){transform:translateY(-6.5px) rotate(-45deg)}@media(max-width:1024px){.nav-toggle{display:flex}nav{position:relative;flex-wrap:wrap}.nav-links{display:none;position:absolute;top:100%;left:0;right:0;background:var(--cream);border-bottom:1.5px solid rgba(26,26,26,.15);padding:20px 24px 24px;flex-direction:column;gap:18px;z-index:200;box-shadow:0 8px 24px rgba(26,26,26,.06)}nav.open .nav-links{display:flex}}@media(max-width:600px){footer{padding:24px 16px 40px}.footer-links{gap:12px;font-size:.9rem;margin-top:8px}}.nav-links a.active{color:var(--sage);opacity:1}</style>
</head>
<body>
<nav>
  <a href="../index.html" class="nav-brand">the Safer Sounds Club</a>
  <ul class="nav-links"><li><a href="../index.html">Home</a></li><li><a href="../about.html">About</a></li><li><a href="../products.html">Workshop</a></li><li><a href="../quiz.html">Free Quiz</a></li><li><a href="../faq.html">FAQ</a></li><li><a href="../blog.html" class="active">Blog</a></li><li><a href="../contact.html">Contact</a></li></ul>
<button class="nav-toggle" aria-label="Toggle navigation"><span></span><span></span><span></span></button></nav>
<div style="display:flex;align-items:center;justify-content:center;height:240px;padding:0;border-bottom:1.5px dashed rgba(26,26,26,0.25);overflow:hidden;"><img class="post-hero" src="${heroImgSrc}" style="mix-blend-mode:multiply;" alt="" loading="eager" decoding="async"></div>
<div class="post-wrap">
  <p class="post-meta">${dateDisplay} &nbsp;·&nbsp; By Megan Carlson</p>
  <h1 class="post-title">${title}</h1>
  <div class="post-body">
${bodyHtml}
  </div>
${faqHtml}
  <div class="post-cta">
    <p>Wondering what's underneath your own misophonia? Take the free 2-minute quiz to find out which emotion is driving your reactions — and get an affirmation written specifically for you.</p>
    <a href="../quiz.html" class="btn-quiz"><span class="bg"></span><span class="label">Take the Free Quiz</span></a>
  </div>
${postNavHtml}
</div>
<footer>
  <div class="footer-links"><a href="../index.html">Home</a><a href="../about.html">About</a><a href="../products.html">Workshop</a><a href="../quiz.html">Free Quiz</a><a href="../faq.html">FAQ</a><a href="../blog.html" class="active">Blog</a><a href="../contact.html">Contact</a></div>
  <div class="footer-links" style="margin-top:20px;margin-bottom:0;"><a href="https://the-safer-sounds-club.kit.com/0bb51426e7" target="_blank" style="font-family:'CoreBandiFace',cursive;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--sage);text-decoration:none;opacity:.85;">Join the email list →</a></div>
  <p class="post-meta" style="text-align:center;margin-top:16px;margin-bottom:0;">The Safer Sounds Club, LLC &nbsp;|&nbsp; The Safer Sounds Club is educational and is not a substitute for therapy.</p>
</footer>
<script>(function(){var t=document.querySelector(".nav-toggle"),n=document.querySelector("nav");if(!t||!n)return;t.addEventListener("click",function(){n.classList.toggle("open")});document.querySelectorAll(".nav-links a").forEach(function(a){a.addEventListener("click",function(){n.classList.remove("open")})})})();</script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

// First pass: parse all posts
const mdFiles = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).sort();
const allPosts = [];

for (const file of mdFiles) {
  const slug = file.replace(".md", "");
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
  const { data, bodyRaw, faqItems } = parsePost(raw);
  allPosts.push({ slug, data, bodyRaw, faqItems });
}

// Sort newest first
allPosts.sort((a, b) => (a.data.date < b.data.date ? 1 : -1));

// Second pass: render each post with auto-computed prev/next
for (let i = 0; i < allPosts.length; i++) {
  const { slug, data, bodyRaw, faqItems } = allPosts[i];

  // Older post = prev (← left); newer post = next (→ right)
  const prevPost = i < allPosts.length - 1
    ? { slug: allPosts[i + 1].slug, title: allPosts[i + 1].data.title }
    : null;
  const nextPost = i > 0
    ? { slug: allPosts[i - 1].slug, title: allPosts[i - 1].data.title }
    : null;

  const bodyHtml = mdToHtml(bodyRaw);
  const html = renderPost(slug, data, bodyHtml, faqItems, prevPost, nextPost);
  fs.writeFileSync(path.join(BLOG_DIR, `${slug}.html`), html, "utf8");
  console.log(`✓ blog/${slug}.html`);
}

// ── Rebuild blog index card grid ──────────────────────────────────────────────
const cardHtml = allPosts
  .map(({ slug, data }) => {
    const { title = "", dateDisplay = "", heroImage = "", description = "", excerpt = "" } = data;
    return `
  <article class="post-card">
    <a href="blog/${slug}.html">
      <img class="post-thumb" src="${heroSrcForIndex(heroImage)}" alt="${title}" loading="lazy" decoding="async">
      <p class="post-date">${dateDisplay}</p>
      <h2 class="post-title">${title}</h2>
      <p class="post-excerpt">${excerpt || description}</p>
      <span class="read-more">Read more →</span>
    </a>
  </article>`;
  })
  .join("\n");

let blogIndex = fs.readFileSync(BLOG_INDEX, "utf8");
const START = "<!-- POSTS:START -->";
const END = "<!-- POSTS:END -->";
if (blogIndex.includes(START) && blogIndex.includes(END)) {
  blogIndex =
    blogIndex.slice(0, blogIndex.indexOf(START) + START.length) +
    "\n" +
    cardHtml +
    "\n    " +
    blogIndex.slice(blogIndex.indexOf(END));
  fs.writeFileSync(BLOG_INDEX, blogIndex, "utf8");
  console.log(`✓ blog.html index updated (${allPosts.length} posts)`);
} else {
  console.log("ℹ blog.html: POSTS markers not found — no index update");
}

console.log(`\nDone — ${allPosts.length} posts built.`);
