const DEFAULT_DIMENSIONS = [
    { id: 'sound', name: '听感', max: 6 },
    { id: 'unique', name: '独特性', max: 3 },
    { id: 'lyrics', name: '歌词表达', max: 5 },
    { id: 'vocal', name: '演唱', max: 5 },
    { id: 'tech', name: '技术实现', max: 3 },
    { id: 'theme', name: '主题表现', max: 5 },
    { id: 'emotion', name: '情感共鸣', max: 5 }
];

let currentDimensions = [];

document.addEventListener('DOMContentLoaded', async () => {
    await init();
    setupTabs();
    setupActions();

    // 实时监听存储变化并刷新排行榜
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            // 如果变化涉及歌曲数据（以 SONGCONT_ 开头或我们的 hash_ ID）
            const hasSongChange = Object.keys(changes).some(k => k.startsWith('SONGCONT_') || k.startsWith('hash_'));
            if (hasSongChange) {
                loadRankings();
            }
            // 如果变化涉及配置
            if (changes.config) {
                currentDimensions = changes.config.newValue.dimensions;
                renderConfig();
                loadRankings();
            }
        }
    });
});

async function init() {
    const data = await chrome.storage.local.get(['config']);
    currentDimensions = data.config?.dimensions || DEFAULT_DIMENSIONS;
    renderConfig();
    loadRankings();
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
    document.getElementById('export-csv').onclick = exportToCSV;
    document.getElementById('clear-data').onclick = clearAllData;
}

// --- 维度配置逻辑 ---
function renderConfig() {
    const list = document.getElementById('dimensions-list');
    list.innerHTML = '';
    currentDimensions.forEach((dim, index) => {
        const div = document.createElement('div');
        div.className = 'config-card';
        div.innerHTML = `
            <div class="config-row">
                <input type="text" class="config-input dim-name" value="${dim.name}" style="flex:1" placeholder="维度名称">
                <input type="number" class="config-input dim-max" value="${dim.max}" style="width:45px" title="满分">
                <button class="remove-dim" data-index="${index}" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:16px;">✕</button>
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
    currentDimensions.push({ id: 'dim_' + Date.now(), name: '新维度', max: 5 });
    renderConfig();
};

document.getElementById('save-config').onclick = async () => {
    const names = document.querySelectorAll('.dim-name');
    const maxes = document.querySelectorAll('.dim-max');
    const newConfig = {
        dimensions: Array.from(names).map((el, i) => ({
            id: currentDimensions[i].id,
            name: el.value,
            max: parseInt(maxes[i].value) || 5
        }))
    };
    await chrome.storage.local.set({ config: newConfig });
    // alert('配置已应用！'); // 减少干扰，靠 onChanged 自动刷新
};

// --- 排行榜逻辑 ---
async function loadRankings() {
    const allData = await chrome.storage.local.get(null);
    const config = allData.config || { dimensions: DEFAULT_DIMENSIONS };
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
                artist: metadata.artist || 'Unknown'
            });
        }
    }

    const rated = songs.filter(s => s.score > 0).sort((a, b) => b.score - a.score);
    const container = document.getElementById('ranked-songs');
    if (!container) return;

    container.innerHTML = rated.length ? '' : '<div style="opacity:0.4; padding:40px; text-align:center; font-size:12px;">暂无评分记录</div>';

    rated.forEach((song, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding:14px; background:rgba(255,255,255,0.03); border:1px solid var(--ssc8-border); border-radius:10px; margin-bottom:10px;';
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="flex:1">
                    <div style="font-weight:700; color:var(--ssc8-accent); font-size:13px; line-height:1.2;">#${index + 1} ${song.title}</div>
                    <div style="font-size:11px; opacity:0.5; margin-top:2px;">by ${song.artist}</div>
                </div>
                <div style="background:var(--ssc8-accent); color:white; padding:4px 10px; border-radius:6px; font-weight:800; font-size:15px;">${song.score}</div>
            </div>
            <div style="font-size:10px; opacity:0.4; line-height:1.3; border-top:1px solid rgba(255,255,255,0.05); padding-top:6px;">${song.breakdown}</div>
        `;
        container.appendChild(div);
    });
}

// --- 数据操作 ---
function exportToCSV() {
    chrome.storage.local.get(null, (data) => {
        const config = data.config || { dimensions: DEFAULT_DIMENSIONS };
        const headers = ['Song ID', 'Title', 'Artist', ...config.dimensions.map(d => d.name), 'Total'];
        const rows = [headers];

        for (const key in data) {
            if (key.startsWith('SONGCONT_') || key.startsWith('hash_')) {
                const ratings = data[key];
                const meta = ratings._metadata || {};
                let total = 0;
                const row = [key, meta.title || '?', meta.artist || '?'];
                config.dimensions.forEach(dim => {
                    const s = ratings[dim.id] || 0;
                    total += s;
                    row.push(s);
                });
                row.push(total);
                if (total > 0) rows.push(row);
            }
        }

        const csvContent = rows.map(r => r.join(',')).join('\n');
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ssc8_ratings_${new Date().toISOString().slice(0, 10)}.csv`);
        link.click();
    });
}

function clearAllData() {
    if (confirm('确定要清除所有评分数据吗？配置将保留。')) {
        chrome.storage.local.get(null, (data) => {
            const keysToRemove = Object.keys(data).filter(k => k.startsWith('SONGCONT_') || k.startsWith('hash_'));
            chrome.storage.local.remove(keysToRemove, () => {
                loadRankings();
                alert('数据已清除');
            });
        });
    }
}
