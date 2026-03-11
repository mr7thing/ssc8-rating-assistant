/**
 * SSC8 Rating Assistant - Sidepanel Logic
 */

const DEFAULT_DIMENSIONS_ZH = [
    { id: 'sound', name: '听感', desc: '歌曲整体的和谐度与悦耳程度', max: 6 },
    { id: 'unique', name: '独特性', desc: '编曲、创意或风格的识别度', max: 3 },
    { id: 'lyrics', name: '歌词表达', desc: '歌词意境、押韵或情感深度', max: 5 },
    { id: 'vocal', name: '演唱', desc: '唱功、音色或情感投入', max: 5 },
    { id: 'tech', name: '技术实现', desc: '录音、混音或编排的专业度', max: 3 },
    { id: 'theme', name: '主题表现', desc: '是否切合比赛或特定主题', max: 5 },
    { id: 'emotion', name: '情感共鸣', desc: '是否能触动听者的内心情感', max: 5 }
];

const DEFAULT_DIMENSIONS_EN = [
    { id: 'sound', name: 'Sound', desc: 'General harmony and pleasantness', max: 6 },
    { id: 'unique', name: 'Uniqueness', desc: 'Originality in arrangement or style', max: 3 },
    { id: 'lyrics', name: 'Lyrics', desc: 'Depth, rhyme, or imagery in lyrics', max: 5 },
    { id: 'vocal', name: 'Vocal', desc: 'Technique, tone, or emotional delivery', max: 5 },
    { id: 'tech', name: 'Production', desc: 'Recording, mixing, or structure quality', max: 3 },
    { id: 'theme', name: 'Theme', desc: 'Adherence to the contest or specific topic', max: 5 },
    { id: 'emotion', name: 'Emotion', desc: 'Ability to move or resonate with listeners', max: 5 }
];

let currentDimensions = [];

function i18n(key) {
    return chrome.i18n.getMessage(key) || key;
}

function getDefaultDimensions() {
    const lang = chrome.i18n.getUILanguage();
    return lang.startsWith('zh') ? DEFAULT_DIMENSIONS_ZH : DEFAULT_DIMENSIONS_EN;
}

document.addEventListener('DOMContentLoaded', async () => {
    await init();
    applyi18n();
    setupTabs();
    setupActions();

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            loadRankings();
            if (changes.config) {
                currentDimensions = changes.config.newValue.dimensions;
                renderConfig();
                applyi18n();
            }
        }
    });
});

function applyi18n() {
    const exportBtn = document.getElementById('export-csv');
    const clearBtn = document.getElementById('clear-data');
    if (exportBtn) exportBtn.innerText = i18n('exportCSV');
    if (clearBtn) clearBtn.innerText = i18n('clearData');

    const rankingTab = document.querySelector('[data-tab="ranking"]');
    const configTab = document.querySelector('[data-tab="config"]');
    if (rankingTab) rankingTab.innerText = i18n('tabRanking');
    if (configTab) configTab.innerText = i18n('tabConfig');

    const configHeader = document.querySelector('#config h2');
    if (configHeader) configHeader.innerText = i18n('dimManagement');

    const addBtn = document.getElementById('add-dim');
    const saveBtn = document.getElementById('save-config');
    if (addBtn) addBtn.innerText = i18n('addDim');
    if (saveBtn) saveBtn.innerText = i18n('saveConfig');
}

async function init() {
    const data = await chrome.storage.local.get(['config']);
    currentDimensions = data.config?.dimensions || getDefaultDimensions();
    renderConfig();
    await loadRankings();
}

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'ranking') loadRankings();
        };
    });
}

function setupActions() {
    const exportBtn = document.getElementById('export-csv');
    const clearBtn = document.getElementById('clear-data');
    if (exportBtn) exportBtn.onclick = exportToCSV;
    if (clearBtn) clearBtn.onclick = clearAllData;
}

function renderConfig() {
    const list = document.getElementById('dimensions-list');
    if (!list) return;
    list.innerHTML = '';
    currentDimensions.forEach((dim, index) => {
        const div = document.createElement('div');
        div.className = 'config-card';
        div.style.marginBottom = '15px';
        div.innerHTML = `
            <div class="config-row">
                <input type="text" class="config-input dim-name" value="${dim.name}" style="flex:1" placeholder="${i18n('dimName')}">
                <input type="number" class="config-input dim-max" value="${dim.max}" style="width:45px" title="${i18n('maxScore')}">
                <button class="remove-dim" data-index="${index}" style="background:none; border:none; color:var(--ssc8-danger); cursor:pointer; font-size:16px;">✕</button>
            </div>
            <div class="config-row" style="margin-top: 8px;">
                <input type="text" class="config-input dim-desc" value="${dim.desc || ''}" style="flex:1; font-size:11px; opacity:0.7;" placeholder="${i18n('dimDesc')}">
            </div>
        `;
        list.appendChild(div);
    });

    document.querySelectorAll('.remove-dim').forEach(btn => {
        btn.onclick = () => {
            currentDimensions.splice(btn.dataset.index, 1);
            renderConfig();
        };
    });
}

document.getElementById('add-dim').onclick = () => {
    currentDimensions.push({ id: 'dim_' + Date.now(), name: i18n('dimName'), desc: '', max: 5 });
    renderConfig();
};

document.getElementById('save-config').onclick = async () => {
    const cards = document.querySelectorAll('.config-card');
    const newDimensions = Array.from(cards).map((card, i) => ({
        id: currentDimensions[i].id,
        name: card.querySelector('.dim-name').value,
        desc: card.querySelector('.dim-desc').value,
        max: parseInt(card.querySelector('.dim-max').value) || 5
    }));

    await chrome.storage.local.set({ config: { dimensions: newDimensions } });
    alert(i18n('configSaved'));
};

async function loadRankings() {
    const allData = await chrome.storage.local.get(null);
    const config = allData.config || { dimensions: getDefaultDimensions() };
    const songs = [];

    for (const key in allData) {
        if (key.startsWith('SONGCONT_') || key.startsWith('hash_')) {
            const ratings = allData[key];
            let totalScore = 0;
            let breakdown = [];
            config.dimensions.forEach(dim => {
                const score = ratings[dim.id] || 0;
                totalScore += score;
                breakdown.push(`${dim.name}:${score}`);
            });
            const metadata = ratings._metadata || {};
            songs.push({
                id: key,
                score: totalScore,
                breakdown: breakdown.join(' | '),
                title: metadata.title || 'Unknown',
                artist: metadata.artist || 'Unknown',
                comment: ratings.comment || ''
            });
        }
    }

    const rated = songs.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    const container = document.getElementById('ranked-songs');
    if (!container) return;

    container.innerHTML = rated.length ? '' : `<div style="opacity:0.4; padding:40px; text-align:center; font-size:12px; color:var(--ssc8-text-dim);">${i18n('noRatings')}</div>`;

    rated.forEach((song, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:14px; background:white; border:1px solid var(--ssc8-border); border-radius:10px; margin-bottom:10px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="flex:1">
                    <div style="font-weight:700; color:var(--ssc8-text); font-size:13px; line-height:1.2;">#${index + 1} ${song.title}</div>
                    <div style="font-size:11px; color:var(--ssc8-text-dim); margin-top:2px;">by ${song.artist}</div>
                </div>
                <div style="background:var(--ssc8-accent); color:white; padding:4px 10px; border-radius:6px; font-weight:800; font-size:15px;">${song.score}</div>
            </div>
            <div style="font-size:10px; color:var(--ssc8-text-dim); line-height:1.3; border-top:1px solid var(--ssc8-border); padding-top:6px;">${song.breakdown}</div>
            ${song.comment ? `
            <div style="font-size:11px; color:#64748b; margin-top:8px; font-style:italic; padding-left:8px; border-left:2px solid var(--ssc8-accent); line-height:1.4;">
                "${song.comment.length > 50 ? song.comment.substring(0, 50) + '...' : song.comment}"
            </div>` : ''}
        `;
        container.appendChild(div);
    });
}

function exportToCSV() {
    chrome.storage.local.get(null, (data) => {
        const config = data.config || { dimensions: getDefaultDimensions() };
        const headers = ['Song ID', 'Title', 'Country', 'Artist', ...config.dimensions.map(d => d.name), 'Total', 'Comment'];
        const sep = ';';
        const rows = [headers.join(sep)];

        for (const key in data) {
            if (key.startsWith('SONGCONT_') || key.startsWith('hash_')) {
                const ratings = data[key];
                const meta = ratings._metadata || {};
                let total = 0;

                const fullTitle = meta.title || 'Unknown';
                let songTitle = fullTitle;
                let country = 'Unknown';

                const countryMatch = fullTitle.match(/\[(.*?)\]/g);
                if (countryMatch) {
                    const lastMatch = countryMatch[countryMatch.length - 1];
                    let rawCountry = lastMatch.replace(/[\[\]]/g, '').trim();

                    country = rawCountry.replace(/SSC8/gi, '')
                        .replace(/[-_#,]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    if (!country) country = 'Unknown';
                    songTitle = fullTitle.replace(lastMatch, '').trim();
                }

                const row = [key, songTitle, country, meta.artist || '?'];

                config.dimensions.forEach(dim => {
                    const s = ratings[dim.id] || 0;
                    total += s;
                    row.push(s);
                });
                row.push(total);
                row.push(`"${(ratings.comment || '').replace(/"/g, '""')}"`);
                if (total > 0 || (ratings.comment && ratings.comment.trim())) rows.push(row.join(sep));
            }
        }

        const csvContent = rows.join('\n');
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ssc8_ratings_${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
    });
}

function clearAllData() {
    if (confirm(i18n('confirmClear'))) {
        chrome.storage.local.get(null, (data) => {
            const keysToRemove = Object.keys(data).filter(k => k.startsWith('SONGCONT_') || k.startsWith('hash_'));
            chrome.storage.local.remove(keysToRemove, () => {
                loadRankings();
            });
        });
    }
}
