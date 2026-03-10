/**
 * SSC8 Sidepanel Logic
 */

const DEFAULT_DIMENSIONS = [
    { id: 'sound', name: '听感', max: 6 },
    { id: 'unique', name: '独特性', max: 3 },
    { id: 'lyrics', name: '歌词表达', max: 5 },
    { id: 'vocal', name: '演唱', max: 5 },
    { id: 'tech', name: '技术实现', max: 3 },
    { id: 'theme', name: '主题表现', max: 5 },
    { id: 'emotion', name: '情感共鸣', max: 5 }
];

document.addEventListener('DOMContentLoaded', () => {
    loadConfig();
    loadRankings();
});

function loadConfig() {
    chrome.storage.local.get(['config'], (result) => {
        const config = result.config || { dimensions: DEFAULT_DIMENSIONS };
        renderConfig(config.dimensions);
    });
}

function renderConfig(dimensions) {
    const container = document.getElementById('dimensions-config');
    container.innerHTML = '';
    dimensions.forEach(dim => {
        const item = document.createElement('div');
        item.className = 'config-item';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between">
                <span>${dim.name}</span>
                <span>最高: ${dim.max}</span>
            </div>
        `;
        container.appendChild(item);
    });
}

// 监听存储变化，实时更新排名
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
        loadRankings();
    }
});

async function loadRankings() {
    const allData = await chrome.storage.local.get(null);
    const config = allData.config || { dimensions: DEFAULT_DIMENSIONS };
    const songs = [];

    for (const key in allData) {
        if (key.startsWith('SONGCONT_') || key.startsWith('SONG_')) { // 兼容不同前缀
            const ratings = allData[key];
            let totalScore = 0;
            let dimensionCount = 0;

            config.dimensions.forEach(dim => {
                if (ratings[dim.id]) {
                    totalScore += ratings[dim.id];
                    dimensionCount++;
                }
            });

            if (dimensionCount > 0) {
                songs.push({ id: key, score: totalScore, title: ratings.title || key });
            }
        }
    }

    // 按总分降序
    songs.sort((a, b) => b.score - a.score);
    renderRankings(songs);
}

function renderRankings(songs) {
    const container = document.getElementById('ranked-songs');
    container.innerHTML = songs.length ? '' : '<div style="opacity:0.5; padding: 20px; text-align: center; background: var(--ssc8-card-bg); border-radius: 8px;">寻找灵魂共鸣的律动中... (暂无评分)</div>';

    songs.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = 'rank-item';
        div.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 10px;
            transition: all 0.2s;
        `;
        div.innerHTML = `
            <div style="font-size: 20px; font-weight: 800; margin-right: 15px; width: 30px; color: ${index < 3 ? 'var(--ssc8-star-active)' : 'rgba(255,255,255,0.3)'}">
                ${index + 1}
            </div>
            <div style="flex:1">
                <div style="font-weight: 600; font-size: 14px; margin-bottom: 2px;">${song.id}</div>
                <div style="font-size: 11px; opacity: 0.5;">ID: ${song.id}</div>
            </div>
            <div style="text-align: right">
                <div style="font-size: 18px; font-weight: 700; color: var(--ssc8-accent)">${song.score}</div>
                <div style="font-size: 10px; opacity: 0.4">Points</div>
            </div>
        `;
        container.appendChild(div);
    });
}
