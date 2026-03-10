/**
 * SSC8 Rating Assistant - Content Script
 * 优化版：基于用户提供的 .rt-BaseCard 和 .song-title-link 精确注入
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

let config = { dimensions: DEFAULT_DIMENSIONS };

chrome.storage.local.get(['config'], (result) => {
    if (result.config) config = result.config;
    scanAndInject();
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.config) {
        config = changes.config.newValue;
        refreshAllWidgets();
    }
});

function refreshAllWidgets() {
    document.querySelectorAll('.ssc8-rating-widget, .ssc8-expand-btn, .ssc8-total-badge').forEach(el => el.remove());
    scanAndInject();
}

/**
 * 精确注入逻辑
 */
function injectRatingUI(card) {
    if (card.querySelector('.ssc8-rating-widget')) return;

    // 1. 提取元数据 - 使用用户发现的规律
    let songId = null;
    let songTitle = "Unknown Song";
    let artistName = "Unknown Artist";

    // 歌名定位：.song-title-link
    const titleEl = card.querySelector('.song-title-link');
    if (titleEl) {
        const fullText = titleEl.innerText.trim();
        // 提取歌名 (截断可能的 ID)
        songTitle = fullText.split('SONGCONT_')[0].trim();

        // 尝试从 ID 字符串或链接提取 ID
        const idMatch = fullText.match(/SONGCONT_([A-Za-z0-9]+)/);
        if (idMatch) songId = idMatch[0];

        if (!songId) {
            const parentLink = titleEl.closest('a');
            if (parentLink && parentLink.href.includes('/s/')) {
                songId = parentLink.href.split('/').pop();
            }
        }
    }

    // 艺术家定位：寻找 "by " 开头的 span
    const artistEls = Array.from(card.querySelectorAll('span')).filter(el => el.innerText.trim().toLowerCase().startsWith('by '));
    if (artistEls.length > 0) {
        const rawArtist = artistEls[0].innerText.trim().substring(3);
        artistName = rawArtist.split('(')[0].split('\n')[0].trim();
    }

    // 兜底 ID
    if (!songId) {
        songId = 'hash_' + btoa(unescape(encodeURIComponent(songTitle + artistName))).substring(0, 16).replace(/[/+=]/g, '');
    }

    // --- UI 渲染 ---
    card.style.position = 'relative';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.overflow = 'visible';

    // 1. 总分徽章
    const badge = document.createElement('div');
    badge.className = 'ssc8-total-badge';
    badge.style.cssText = 'position:absolute; top:12px; right:120px; background:#fbbf24; color:black; font-weight:900; padding:4px 12px; border-radius:100px; font-size:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:100; pointer-events:none; border:2px solid black;';
    badge.dataset.songId = songId;
    card.appendChild(badge);

    // 2. 展开按钮
    const expandBtn = document.createElement('button');
    expandBtn.className = 'ssc8-expand-btn';
    expandBtn.innerHTML = '▼ 展开评分';
    expandBtn.style.cssText = 'margin: 8px 16px; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 12px; cursor: pointer; font-weight: 600;';

    // 3. 评分容器
    const container = document.createElement('div');
    container.className = 'ssc8-rating-widget ssc8-extension-root';
    container.dataset.songId = songId;
    container.style.display = 'none';

    expandBtn.onclick = (e) => {
        e.stopPropagation();
        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'flex' : 'none';
        expandBtn.innerHTML = isHidden ? '▲ 收起评分' : '▼ 展开评分';
        expandBtn.style.background = isHidden ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.05)';
    };

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 10px;';

    config.dimensions.forEach(dim => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
        const label = document.createElement('span');
        label.style.cssText = 'font-size:13px; opacity:0.8;';
        label.innerText = dim.name;

        const stars = document.createElement('div');
        stars.className = 'ssc8-stars-row';
        for (let i = 1; i <= dim.max; i++) {
            const s = document.createElement('span');
            s.className = 'ssc8-star';
            s.innerHTML = '★';
            s.dataset.value = i;
            s.dataset.dimId = dim.id;
            s.onclick = (e) => {
                e.stopPropagation();
                saveRating(songId, dim.id, i, songTitle, artistName);
            };
            stars.appendChild(s);
        }
        row.appendChild(label);
        row.appendChild(stars);
        list.appendChild(row);
    });

    container.appendChild(list);
    card.appendChild(expandBtn);
    card.appendChild(container);

    updateUI(songId);
}

function saveRating(songId, dimId, value, title, artist) {
    chrome.storage.local.get([songId], (res) => {
        const ratings = res[songId] || {};
        ratings._metadata = { title, artist, updatedAt: Date.now() };
        if (ratings[dimId] === value) delete ratings[dimId];
        else ratings[dimId] = value;
        chrome.storage.local.set({ [songId]: ratings }, () => updateUI(songId));
    });
}

function updateUI(songId) {
    chrome.storage.local.get([songId], (res) => {
        const ratings = res[songId] || {};
        let total = 0;

        document.querySelectorAll(`.ssc8-rating-widget[data-song-id="${songId}"]`).forEach(w => {
            w.querySelectorAll('.ssc8-star').forEach(s => {
                const isActive = ratings[s.dataset.dimId] >= parseInt(s.dataset.value);
                s.classList.toggle('active', isActive);
            });
        });

        config.dimensions.forEach(d => total += (ratings[d.id] || 0));
        document.querySelectorAll(`.ssc8-total-badge[data-song-id="${songId}"]`).forEach(b => {
            b.innerText = total;
            b.style.display = total > 0 ? 'block' : 'none';
        });
    });
}

function scanAndInject() {
    // 使用用户发现的精确类名：.rt-BaseCard 或 .rt-Card
    const cards = document.querySelectorAll('.rt-BaseCard, .rt-Card');
    cards.forEach(card => {
        // 只要包含 "Click to rank" 说明是我们要找的歌曲载体
        if (card.innerText.includes('Click to rank')) {
            injectRatingUI(card);
        }
    });
}

let scanTimer = null;
const observer = new MutationObserver(() => {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndInject, 300);
});

observer.observe(document.body, { childList: true, subtree: true });
scanAndInject();
