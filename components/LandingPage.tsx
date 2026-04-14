"use client";

import { useEffect } from "react";

const css = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --green: #059669;
  --green-light: #d1fae5;
  --green-dark: #065f46;
  --gold: #b45309;
  --cream: #fafaf7;
  --ink: #111310;
  --muted: #6b7280;
  --border: #e5e7eb;
  --serif: 'Playfair Display', Georgia, serif;
  --sans: 'DM Sans', system-ui, sans-serif;
}

html { scroll-behavior: smooth; }

body {
  font-family: var(--sans);
  background: var(--cream);
  color: var(--ink);
  overflow-x: hidden;
}

nav {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  padding: 16px 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(250,250,247,0.92);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--ink);
}

.logo-icon {
  width: 36px; height: 36px;
  background: var(--green);
  border-radius: 10px;
  display: grid;
  place-items: center;
}

.logo-icon svg {
  width: 18px; height: 18px;
  stroke: white;
  fill: none;
  stroke-width: 2;
}

.logo-text {
  font-family: var(--serif);
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.nav-cta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-link {
  font-size: 14px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-link:hover { color: var(--ink); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 100px;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--green);
  color: white;
}

.btn-primary:hover {
  background: var(--green-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(5,150,105,0.3);
}

.btn-outline {
  background: transparent;
  color: var(--ink);
  border: 1.5px solid var(--border);
}

.btn-outline:hover {
  border-color: var(--green);
  color: var(--green);
}

.btn-large {
  padding: 16px 32px;
  font-size: 16px;
  border-radius: 100px;
}

.hero {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 120px 24px 80px;
  position: relative;
  overflow: hidden;
}

.hero::before {
  content: '';
  position: absolute;
  top: -200px; left: 50%;
  transform: translateX(-50%);
  width: 800px; height: 800px;
  background: radial-gradient(circle, rgba(5,150,105,0.08) 0%, transparent 70%);
  pointer-events: none;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--green-light);
  color: var(--green-dark);
  padding: 6px 16px;
  border-radius: 100px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 32px;
  animation: fadeUp 0.6s ease both;
}

.hero-badge span {
  width: 6px; height: 6px;
  background: var(--green);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(0.8); }
}

.hero h1 {
  font-family: var(--serif);
  font-size: clamp(40px, 7vw, 80px);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.02em;
  max-width: 800px;
  margin-bottom: 24px;
  animation: fadeUp 0.6s ease 0.1s both;
}

.hero h1 em {
  font-style: italic;
  color: var(--green);
}

.hero p {
  font-size: clamp(16px, 2.5vw, 20px);
  color: var(--muted);
  max-width: 520px;
  line-height: 1.7;
  margin-bottom: 48px;
  animation: fadeUp 0.6s ease 0.2s both;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  animation: fadeUp 0.6s ease 0.3s both;
  margin-bottom: 64px;
}

.waitlist-form {
  display: flex;
  gap: 8px;
  max-width: 440px;
  width: 100%;
  animation: fadeUp 0.6s ease 0.35s both;
}

.waitlist-input {
  flex: 1;
  padding: 14px 20px;
  border: 1.5px solid var(--border);
  border-radius: 100px;
  font-family: var(--sans);
  font-size: 15px;
  background: white;
  color: var(--ink);
  outline: none;
  transition: border-color 0.2s;
}

.waitlist-input:focus {
  border-color: var(--green);
}

.waitlist-input::placeholder {
  color: #9ca3af;
}

.waitlist-success {
  display: none;
  align-items: center;
  gap: 8px;
  color: var(--green);
  font-weight: 600;
  font-size: 15px;
  animation: fadeUp 0.4s ease both;
}

.hero-proof {
  display: flex;
  align-items: center;
  gap: 24px;
  color: var(--muted);
  font-size: 13px;
  animation: fadeUp 0.6s ease 0.4s both;
  flex-wrap: wrap;
  justify-content: center;
}

.proof-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.proof-item svg {
  width: 14px; height: 14px;
  stroke: var(--green);
  fill: none;
  stroke-width: 2.5;
}

.phone-mockup {
  margin-top: 80px;
  animation: fadeUp 0.8s ease 0.5s both;
  position: relative;
}

.phone-frame {
  width: 300px;
  background: #1a1a1a;
  border-radius: 50px;
  padding: 10px;
  box-shadow:
    0 50px 100px rgba(0,0,0,0.25),
    0 0 0 1px rgba(255,255,255,0.08) inset,
    inset 0 0 0 2px #2a2a2a;
  margin: 0 auto;
  position: relative;
}

.phone-notch {
  position: absolute;
  top: 18px;
  left: 50%;
  transform: translateX(-50%);
  width: 110px;
  height: 28px;
  background: #1a1a1a;
  border-radius: 0 0 20px 20px;
  z-index: 10;
}

.phone-screen {
  background: #ffffff;
  border-radius: 42px;
  overflow: hidden;
  padding: 0;
  position: relative;
}

.phone-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 0;
  height: 44px;
}

.phone-status-time {
  font-size: 13px;
  font-weight: 600;
  color: #111;
  font-family: var(--sans);
}

.phone-status-icons {
  display: flex;
  align-items: center;
  gap: 5px;
}

.phone-status-icons svg {
  width: 14px; height: 14px;
  fill: #111;
}

.phone-content {
  padding: 16px 16px 24px;
}

.phone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.phone-logo {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #111;
  font-family: var(--sans);
  font-size: 15px;
  font-weight: 700;
}

.phone-logo-icon {
  width: 26px; height: 26px;
  background: var(--green);
  border-radius: 7px;
  display: grid;
  place-items: center;
}

.phone-logo-icon svg {
  width: 13px; height: 13px;
  stroke: white;
  fill: none;
  stroke-width: 2;
}

.phone-balance {
  text-align: left;
  margin-bottom: 16px;
  padding: 14px;
  background: #f0fdf4;
  border-radius: 14px;
  border: 1px solid #bbf7d0;
}

.phone-balance-label {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 2px;
  font-family: var(--sans);
}

.phone-balance-amount {
  font-family: var(--serif);
  font-size: 28px;
  color: #111;
  font-weight: 800;
  line-height: 1;
}

.phone-box {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  margin-bottom: 8px;
}

.phone-box-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.phone-box-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.phone-box-icon {
  width: 28px; height: 28px;
  background: var(--green);
  border-radius: 8px;
  display: grid;
  place-items: center;
}

.phone-box-icon svg {
  width: 13px; height: 13px;
  stroke: white;
  fill: none;
  stroke-width: 2;
}

.phone-box-name {
  font-size: 12px;
  color: #111;
  font-weight: 600;
  font-family: var(--sans);
}

.phone-box-sub {
  font-size: 10px;
  color: #9ca3af;
  font-family: var(--sans);
}

.phone-pill {
  background: #fef3c7;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 100px;
  font-family: var(--sans);
  font-weight: 600;
}

.phone-pill-green {
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  color: #166534;
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 100px;
  font-family: var(--sans);
  font-weight: 600;
}

.phone-track {
  height: 4px;
  background: #f3f4f6;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.phone-track-fill {
  height: 100%;
  width: 80%;
  background: var(--green);
  border-radius: 2px;
}

.phone-track-fill-2 {
  height: 100%;
  width: 42%;
  background: #6ee7b7;
  border-radius: 2px;
}

.phone-box-amounts {
  display: flex;
  justify-content: space-between;
}

.phone-amt {
  font-size: 9px;
  color: #9ca3af;
  font-family: var(--sans);
}

.phone-amt span {
  display: block;
  font-size: 11px;
  color: #111;
  font-weight: 600;
  margin-top: 1px;
}

.phone-banker {
  margin-top: 12px;
  text-align: center;
  font-size: 10px;
  color: #9ca3af;
  font-style: italic;
  font-family: var(--sans);
}

.phone-home-bar {
  width: 100px;
  height: 4px;
  background: #111;
  border-radius: 2px;
  margin: 12px auto 0;
  opacity: 0.15;
}

section {
  padding: 100px 24px;
  max-width: 1100px;
  margin: 0 auto;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--green);
  margin-bottom: 16px;
}

.section-title {
  font-family: var(--serif);
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin-bottom: 20px;
}

.section-sub {
  font-size: 18px;
  color: var(--muted);
  line-height: 1.7;
  max-width: 560px;
}

.story {
  background: var(--ink);
  color: white;
  padding: 100px 24px;
  position: relative;
  overflow: hidden;
}

.story::before {
  content: '"';
  position: absolute;
  top: -60px; left: 32px;
  font-family: var(--serif);
  font-size: 300px;
  color: rgba(5,150,105,0.08);
  line-height: 1;
  pointer-events: none;
}

.story-inner {
  max-width: 720px;
  margin: 0 auto;
  position: relative;
}

.story-quote {
  font-family: var(--serif);
  font-size: clamp(24px, 4vw, 40px);
  font-weight: 700;
  line-height: 1.3;
  margin-bottom: 32px;
  color: white;
}

.story-quote em {
  color: #4ade80;
  font-style: italic;
}

.story-body {
  font-size: 17px;
  line-height: 1.8;
  color: rgba(255,255,255,0.65);
  margin-bottom: 40px;
}

.story-attribution {
  display: flex;
  align-items: center;
  gap: 12px;
}

.story-avatar {
  width: 44px; height: 44px;
  background: var(--green);
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 700;
  color: white;
}

.story-name {
  font-weight: 600;
  font-size: 15px;
  color: white;
}

.story-title {
  font-size: 13px;
  color: rgba(255,255,255,0.4);
}

.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 32px;
  margin-top: 60px;
}

.step {
  background: white;
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 32px;
  position: relative;
  transition: transform 0.2s, box-shadow 0.2s;
}

.step:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 48px rgba(0,0,0,0.08);
}

.step-number {
  width: 40px; height: 40px;
  background: var(--green-light);
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 900;
  color: var(--green-dark);
  margin-bottom: 20px;
}

.step h3 {
  font-family: var(--serif);
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 10px;
}

.step p {
  font-size: 15px;
  color: var(--muted);
  line-height: 1.7;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
  margin-top: 60px;
}

.feature {
  padding: 28px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: white;
}

.feature-icon {
  font-size: 28px;
  margin-bottom: 16px;
  display: block;
}

.feature h4 {
  font-family: var(--serif);
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
}

.feature p {
  font-size: 14px;
  color: var(--muted);
  line-height: 1.7;
}

.cta-section {
  background: var(--green);
  padding: 100px 24px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.cta-section::before {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 40px,
    rgba(255,255,255,0.03) 40px,
    rgba(255,255,255,0.03) 80px
  );
}

.cta-inner {
  position: relative;
  max-width: 600px;
  margin: 0 auto;
}

.cta-inner h2 {
  font-family: var(--serif);
  font-size: clamp(32px, 5vw, 52px);
  font-weight: 900;
  color: white;
  line-height: 1.1;
  margin-bottom: 20px;
}

.cta-inner p {
  font-size: 18px;
  color: rgba(255,255,255,0.8);
  margin-bottom: 40px;
  line-height: 1.7;
}

.cta-form {
  display: flex;
  gap: 8px;
  max-width: 420px;
  margin: 0 auto;
}

.cta-input {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: 100px;
  font-family: var(--sans);
  font-size: 15px;
  background: white;
  color: var(--ink);
  outline: none;
}

.cta-input::placeholder { color: #9ca3af; }

.btn-white {
  background: white;
  color: var(--green-dark);
  padding: 14px 24px;
  border-radius: 100px;
  font-family: var(--sans);
  font-size: 14px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.btn-white:hover {
  background: var(--green-light);
  transform: translateY(-1px);
}

.cta-banker {
  margin-top: 24px;
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  font-style: italic;
}

footer {
  background: var(--ink);
  color: rgba(255,255,255,0.5);
  padding: 48px 24px;
  text-align: center;
}

.footer-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  text-decoration: none;
  color: white;
}

.footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.footer-links a {
  color: rgba(255,255,255,0.4);
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s;
}

.footer-links a:hover { color: white; }

.footer-copy {
  font-size: 12px;
  color: rgba(255,255,255,0.2);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}

.reveal {
  opacity: 0;
  transform: translateY(32px);
  transition: opacity 0.7s ease, transform 0.7s ease;
}

.reveal.visible {
  opacity: 1;
  transform: none;
}

@media (max-width: 768px) {
  nav { padding: 14px 20px; }
  .nav-link { display: none; }

  .hero { padding: 100px 20px 60px; }
  .hero h1 { font-size: 40px; }
  .hero p { font-size: 16px; }

  .waitlist-form { flex-direction: column; border-radius: 16px; }
  .waitlist-form .btn { border-radius: 100px; width: 100%; }
  .waitlist-input { border-radius: 100px; text-align: center; }

  .phone-frame { width: 260px; }

  section { padding: 64px 20px; }
  .section-title { font-size: 30px; }
  .section-sub { font-size: 16px; }

  .steps { grid-template-columns: 1fr; gap: 16px; }
  .features-grid { grid-template-columns: 1fr; gap: 16px; }

  .story { padding: 64px 20px; }
  .story::before { font-size: 180px; }
  .story-quote { font-size: 24px; }
  .story-body { font-size: 15px; }

  .cta-section { padding: 64px 20px; }
  .cta-form { flex-direction: column; }
  .cta-input { border-radius: 100px; text-align: center; }
  .btn-white { border-radius: 100px; width: 100%; }

  footer { padding: 40px 20px; }
  .footer-links { gap: 16px; }

  .reveal {
    opacity: 1;
    transform: none;
  }
}
`;

const bodyHtml = `
<nav>
  <a href="/" class="logo">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    </div>
    <span class="logo-text">LockBox</span>
  </a>
  <div class="nav-cta">
    <a href="/signin" class="nav-link">Sign in</a>
    <a href="/welcome" class="btn btn-primary">Get started</a>
  </div>
</nav>

<div class="hero">
  <div class="hero-badge">
    <span></span>
    Now in private beta
  </div>

  <h1>Your money is safe<br>from <em>you.</em></h1>

  <p>Lock away what matters before you have a chance to spend it. Bills paid. Rent covered. Every time.</p>

  <div class="waitlist-form" id="hero-form">
    <input type="email" class="waitlist-input" placeholder="your@email.com" id="hero-email" />
    <button class="btn btn-primary" onclick="joinWaitlist('hero')">Join waitlist</button>
  </div>
  <div class="waitlist-success" id="hero-success">
    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    You're on the list.
  </div>

  <div class="hero-proof" style="margin-top:24px;">
    <div class="proof-item">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      No credit card required
    </div>
    <div class="proof-item">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      Free to start
    </div>
    <div class="proof-item">
      <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      Your money, your rules
    </div>
  </div>

  <div class="phone-mockup">
    <div class="phone-frame">
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <div class="phone-status">
          <span class="phone-status-time">9:41</span>
          <div class="phone-status-icons">
            <svg viewBox="0 0 24 24" width="13" height="13"><rect x="1" y="13" width="4" height="8" rx="1" fill="#111"/><rect x="7" y="9" width="4" height="12" rx="1" fill="#111"/><rect x="13" y="5" width="4" height="16" rx="1" fill="#111"/><rect x="19" y="1" width="4" height="20" rx="1" fill="#111" opacity="0.3"/></svg>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="#111" stroke="none"/></svg>
            <svg viewBox="0 0 28 14" width="22" height="12"><rect x="0.5" y="0.5" width="23" height="13" rx="3.5" stroke="#111" stroke-opacity="0.35" fill="none"/><rect x="2" y="2" width="19" height="10" rx="2" fill="#111"/><path d="M25 4.5v5a2.5 2.5 0 000-5z" fill="#111" fill-opacity="0.4"/></svg>
          </div>
        </div>

        <div class="phone-content">
          <div class="phone-header">
            <div class="phone-logo">
              <div class="phone-logo-icon">
                <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </div>
              LockBox
            </div>
          </div>

          <div class="phone-balance">
            <div class="phone-balance-label">Total protected</div>
            <div class="phone-balance-amount">$2,050</div>
          </div>

          <div class="phone-box">
            <div class="phone-box-top">
              <div class="phone-box-left">
                <div class="phone-box-icon">
                  <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </div>
                <div>
                  <div class="phone-box-name">Rent Box</div>
                  <div class="phone-box-sub">Due in 8 days &middot; $1,500</div>
                </div>
              </div>
              <span class="phone-pill">&#x1F512; Locked</span>
            </div>
            <div class="phone-track"><div class="phone-track-fill"></div></div>
            <div class="phone-box-amounts">
              <div class="phone-amt">Saved<span>$1,200</span></div>
              <div class="phone-amt">Locked<span>$900</span></div>
              <div class="phone-amt">Goal<span>80%</span></div>
            </div>
          </div>

          <div class="phone-box">
            <div class="phone-box-top">
              <div class="phone-box-left">
                <div class="phone-box-icon" style="background:#6ee7b7;">
                  <svg viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                </div>
                <div>
                  <div class="phone-box-name">Emergency fund</div>
                  <div class="phone-box-sub">$2,000 target</div>
                </div>
              </div>
              <span class="phone-pill-green">&#x1F513; Open</span>
            </div>
            <div class="phone-track"><div class="phone-track-fill-2"></div></div>
            <div class="phone-box-amounts">
              <div class="phone-amt">Saved<span>$850</span></div>
              <div class="phone-amt">Goal<span>42%</span></div>
            </div>
          </div>

          <div class="phone-banker">"Stay consistent." &mdash; The Banker</div>
        </div>

        <div class="phone-home-bar"></div>
      </div>
    </div>
  </div>
</div>

<div class="story">
  <div class="story-inner">
    <div class="story-quote reveal">
      "I built this because I <em>needed</em> it."
    </div>
    <div class="story-body reveal">
      I kept spending money that was supposed to go to bills. Not because I didn't care &mdash; because I couldn't stop myself in the moment. I needed something that would get in the way. Something that would make me pause, explain myself, and think twice before touching money I'd already committed.<br><br>
      LockBox is that something. Lock your money, set a due date, and the only way out is through a process that forces you to reckon with what you're doing. For extra accountability, add a keyholder &mdash; someone who has to approve before a single dollar moves.
    </div>
    <div class="story-attribution reveal">
      <div class="story-avatar">D</div>
      <div>
        <div class="story-name">Darian Garrett</div>
        <div class="story-title">Founder, LockBox</div>
      </div>
    </div>
  </div>
</div>

<section>
  <div class="section-label reveal">How it works</div>
  <h2 class="section-title reveal">Three steps to protect<br>what matters.</h2>
  <p class="section-sub reveal">No complex setup. No learning curve. You're protecting money in under two minutes.</p>

  <div class="steps">
    <div class="step reveal">
      <div class="step-number">1</div>
      <h3>Create a box</h3>
      <p>Name it after what you're protecting. Rent. Bills. Savings. Your call. One box per commitment.</p>
    </div>
    <div class="step reveal">
      <div class="step-number">2</div>
      <h3>Lock it</h3>
      <p>Set a due date. Choose how strict you want the lock. The money is now off-limits until you say otherwise &mdash; or until your keyholder does.</p>
    </div>
    <div class="step reveal">
      <div class="step-number">3</div>
      <h3>Stay accountable</h3>
      <p>Add a keyholder &mdash; a partner, family member, or friend &mdash; who must approve early access. The friction is the feature.</p>
    </div>
  </div>
</section>

<section style="background: white; max-width: 100%; padding: 100px 24px;">
  <div style="max-width: 1100px; margin: 0 auto;">
    <div class="section-label reveal">Built for discipline</div>
    <h2 class="section-title reveal">Everything you need to<br>keep your own promises.</h2>

    <div class="features-grid">
      <div class="feature reveal">
        <span class="feature-icon">&#x1F512;</span>
        <h4>Hard locks</h4>
        <p>Fully lock a box so no withdrawal is possible without going through an unlock request. The barrier is real.</p>
      </div>
      <div class="feature reveal">
        <span class="feature-icon">&#x1F91D;</span>
        <h4>Keyholder system</h4>
        <p>Designate someone you trust. They get notified, verify their identity, and approve or deny your request.</p>
      </div>
      <div class="feature reveal">
        <span class="feature-icon">&#x1F914;</span>
        <h4>Reflection required</h4>
        <p>Before any early unlock, you explain why. That pause is often enough to change your mind.</p>
      </div>
      <div class="feature reveal">
        <span class="feature-icon">&#x1F4A6;</span>
        <h4>The Banker</h4>
        <p>A quiet AI presence in the app. Not a chatbot. Just a calm, honest voice that knows your patterns.</p>
      </div>
      <div class="feature reveal">
        <span class="feature-icon">&#x1F4F1;</span>
        <h4>Mobile first</h4>
        <p>Built as a progressive web app. Works on any phone, no app store required. Just open and go.</p>
      </div>
      <div class="feature reveal">
        <span class="feature-icon">&#x23F1;&#xFE0F;</span>
        <h4>Due date locking</h4>
        <p>Set a date. Money stays locked until then. No exceptions unless you go through the process.</p>
      </div>
    </div>
  </div>
</section>

<div class="cta-section">
  <div class="cta-inner">
    <h2>Stop spending what<br>you can't afford to lose.</h2>
    <p>Join the waitlist and be among the first to protect your money with LockBox.</p>

    <div class="cta-form" id="cta-form">
      <input type="email" class="cta-input" placeholder="your@email.com" id="cta-email" />
      <button class="btn-white" onclick="joinWaitlist('cta')">Join waitlist</button>
    </div>
    <div class="waitlist-success" id="cta-success" style="justify-content:center;color:white;">
      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" fill="none" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      You're on the list. We'll be in touch.
    </div>

    <p class="cta-banker">"You're doing the right thing." &mdash; The Banker</p>
  </div>
</div>

<footer>
  <a href="/" class="footer-logo">
    <div class="logo-icon" style="width:28px;height:28px;">
      <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:white;fill:none;stroke-width:2;"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
    </div>
    <span style="font-family:var(--serif);font-size:17px;font-weight:700;">LockBox</span>
  </a>
  <div class="footer-links">
    <a href="/welcome">Get started</a>
    <a href="/signin">Sign in</a>
    <a href="mailto:support@lockboxfinance.com">Support</a>
    <a href="https://x.com/lockboxfinance" target="_blank">Twitter</a>
    <a href="https://instagram.com/lockboxfinance" target="_blank">Instagram</a>
  </div>
  <div class="footer-copy">&copy; 2026 LockBox Finance. All rights reserved.</div>
</footer>
`;

export default function LandingPage() {
  useEffect(() => {
    // Scroll reveal
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

    // Waitlist — wired to real API
    (window as Window & typeof globalThis & { joinWaitlist: (source: string) => Promise<void> }).joinWaitlist =
      async function (source: string) {
        const inputId = source === "hero" ? "hero-email" : "cta-email";
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        const email = input?.value ?? "";

        if (!email || !email.includes("@")) {
          alert("Please enter a valid email address.");
          return;
        }

        try {
          await fetch("/api/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
        } catch (_) {
          // swallow — success shown regardless
        }

        // Always show success — never expose errors to the user
        if (source === "hero") {
          const form = document.getElementById("hero-form");
          const success = document.getElementById("hero-success");
          if (form) form.style.display = "none";
          if (success) success.style.display = "flex";
        } else {
          const form = document.getElementById("cta-form");
          const success = document.getElementById("cta-success");
          if (form) form.style.display = "none";
          if (success) success.style.display = "flex";
        }
      };

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </>
  );
}
