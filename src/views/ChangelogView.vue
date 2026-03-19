<script setup>
import { changelog, APP_VERSION } from '../lib/changelog'
</script>

<template>
  <div class="cl-page">

    <!-- Header info -->
    <div class="cl-intro">
      <div class="cl-app-info">
        <div class="cl-dot"></div>
        <div>
          <div class="cl-app-name">Storicar</div>
          <div class="cl-version-current">Versione attuale: <strong>{{ APP_VERSION }}</strong></div>
        </div>
      </div>
    </div>

    <!-- Version timeline -->
    <div class="cl-timeline">
      <div v-for="(release, ri) in changelog" :key="release.version" class="cl-release">

        <!-- Version badge + line -->
        <div class="cl-release-header">
          <div class="cl-release-left">
            <div class="cl-emoji">{{ release.emoji }}</div>
            <div class="cl-release-line" v-if="ri < changelog.length - 1"></div>
          </div>
          <div class="cl-release-meta">
            <div class="cl-release-top">
              <span class="cl-ver-badge" :class="{ latest: ri === 0 }">v{{ release.version }}</span>
              <span v-if="ri === 0" class="cl-latest-pill">Corrente</span>
            </div>
            <div class="cl-release-title">{{ release.title }}</div>
            <div class="cl-release-date">{{ formatDate(release.date) }}</div>
          </div>
        </div>

        <!-- Highlight -->
        <div v-if="release.highlights?.length" class="cl-highlight-block">
          <p v-for="h in release.highlights" :key="h" class="cl-highlight">{{ h }}</p>
        </div>

        <!-- Changes list -->
        <div class="cl-changes-card">
          <div v-for="change in release.changes" :key="change.text" class="cl-change-row">
            <span class="cl-change-badge" :class="change.type">{{ typeLabel(change.type) }}</span>
            <span class="cl-change-text">{{ change.text }}</span>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script>
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

function typeLabel(type) {
  return { new: 'Nuovo', improved: 'Migliorato', fixed: 'Fix', removed: 'Rimosso' }[type] || type
}
</script>

<style scoped>
.cl-page {
  padding-bottom: 40px;
}

/* Intro */
.cl-intro {
  margin-bottom: 24px;
}

.cl-app-info {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-sm);
}

.cl-dot {
  width: 40px; height: 40px;
  border-radius: var(--r);
  background: var(--primary);
  flex-shrink: 0;
}

.cl-app-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.cl-version-current {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* Timeline */
.cl-timeline {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.cl-release {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-bottom: 24px;
}

.cl-release-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 10px;
}

.cl-release-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  width: 40px;
}

.cl-emoji {
  font-size: 22px;
  line-height: 1;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  flex-shrink: 0;
}

.cl-release-line {
  width: 1.5px;
  flex: 1;
  background: var(--border);
  margin-top: 6px;
  min-height: 20px;
}

.cl-release-meta {
  flex: 1;
  padding-top: 4px;
}

.cl-release-top {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 4px;
}

.cl-ver-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 20px;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  font-family: ui-monospace, monospace;
}

.cl-ver-badge.latest {
  background: var(--primary-soft);
  color: var(--primary);
  border-color: rgba(37,99,235,0.2);
}
[data-theme="dark"] .cl-ver-badge.latest {
  background: var(--primary-glow);
  color: #93c5fd;
  border-color: rgba(68,147,248,0.2);
}

.cl-latest-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  background: var(--primary);
  color: white;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.cl-release-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.cl-release-date {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* Highlight */
.cl-highlight-block {
  margin-left: 54px;
  margin-bottom: 8px;
  padding: 10px 14px;
  background: var(--primary-soft);
  border-radius: var(--r);
  border-left: 3px solid var(--primary);
}
[data-theme="dark"] .cl-highlight-block {
  background: var(--primary-glow);
}
.cl-highlight {
  font-size: 13px;
  color: var(--primary);
  font-weight: 500;
  line-height: 1.5;
}
[data-theme="dark"] .cl-highlight { color: #93c5fd; }

/* Changes card */
.cl-changes-card {
  margin-left: 54px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.cl-change-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
}
.cl-change-row:last-child { border-bottom: none; }

.cl-change-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
  white-space: nowrap;
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-top: 1px;
}

.cl-change-badge.new      { background: rgba(16,185,129,0.10); color: #047857; }
.cl-change-badge.improved { background: rgba(37,99,235,0.09);  color: #2563eb; }
.cl-change-badge.fixed    { background: rgba(245,158,11,0.10); color: #b45309; }
.cl-change-badge.removed  { background: rgba(239,68,68,0.09);  color: #b91c1c; }

[data-theme="dark"] .cl-change-badge.new      { background: rgba(16,185,129,0.12); color: #6ee7b7; }
[data-theme="dark"] .cl-change-badge.improved { background: rgba(68,147,248,0.14); color: #93c5fd; }
[data-theme="dark"] .cl-change-badge.fixed    { background: rgba(245,158,11,0.12); color: #fcd34d; }
[data-theme="dark"] .cl-change-badge.removed  { background: rgba(239,68,68,0.12);  color: #fca5a5; }

.cl-change-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}
</style>
