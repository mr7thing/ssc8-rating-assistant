/**
 * SSC8 Rating Assistant - Content Script
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

function getDefaultDimensions() {
    const lang = chrome.i18n.getUILanguage();
    return lang.startsWith('zh') ? DEFAULT_DIMENSIONS_ZH : DEFAULT_DIMENSIONS_EN;
}

let config = { dimensions: getDefaultDimensions() };

function i18n(key) {
    return chrome.i18n.getMessage(key) || key;
}

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

function injectRatingUI(card) {
    if (card.querySelector('.ssc8-rating-widget')) return;

    let songId = null;
    let songTitle = "Unknown Song";
    let artistName = "Unknown Artist";

    const titleEl = card.querySelector('.song-title-link');
    if (titleEl) {
        const fullText = titleEl.innerText.trim();
        songTitle = fullText.split('SONGCONT_')[0].trim();
        const idMatch = fullText.match(/SONGCONT_([A-Za-z0-9]+)/);
        if (idMatch) songId = idMatch[0];

        if (!songId) {
            const parentLink = titleEl.closest('a');
            if (parentLink && parentLink.href.includes('/s/')) {
                songId = parentLink.href.split('/').pop();
            }
        }
    }

    const artistEls = Array.from(card.querySelectorAll('span')).filter(el => el.innerText.trim().toLowerCase().startsWith('by '));
    if (artistEls.length > 0) {
        const rawArtist = artistEls[0].innerText.trim().substring(3);
        artistName = rawArtist.split('(')[0].split('\n')[0].trim();
    }

    if (!songId) {
        songId = 'hash_' + btoa(unescape(encodeURIComponent(songTitle + artistName))).substring(0, 16).replace(/[/+=]/g, '');
    }

    card.style.position = 'relative';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.overflow = 'visible';

    const badge = document.createElement('div');
    badge.className = 'ssc8-total-badge';
    badge.style.cssText = 'position:absolute; top:12px; right:120px; background:#fbbf24; color:black; font-weight:900; padding:4px 12px; border-radius:100px; font-size:16px; box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:100; pointer-events:none; border:2px solid black;';
    badge.dataset.songId = songId;
    card.appendChild(badge);

    const expandBtn = document.createElement('button');
    expandBtn.className = 'ssc8-expand-btn';
    expandBtn.innerHTML = i18n('expandRating');
    expandBtn.style.cssText = 'margin: 8px 16px; padding: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; font-size: 12px; cursor: pointer; font-weight: 600;';

    const container = document.createElement('div');
    container.className = 'ssc8-rating-widget ssc8-extension-root';
    container.dataset.songId = songId;
    container.style.display = 'none';

    expandBtn.onclick = (e) => {
        e.stopPropagation();
        const isHidden = container.style.display === 'none';
        container.style.display = isHidden ? 'flex' : 'none';
        expandBtn.innerHTML = isHidden ? i18n('collapseRating') : i18n('expandRating');
        expandBtn.style.background = isHidden ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.05)';
    };

    const list = document.createElement('div');
    list.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 10px;';

    config.dimensions.forEach(dim => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; margin-bottom: 2px;';

        const labelBox = document.createElement('div');
        labelBox.style.cssText = 'display:flex; flex-direction:column;';

        const label = document.createElement('span');
        label.style.cssText = 'font-size:13px; opacity:0.8;';
        label.innerText = dim.name;
        labelBox.appendChild(label);

        if (dim.desc) {
            const desc = document.createElement('span');
            desc.style.cssText = 'font-size:10px; opacity:0.4; font-weight:normal; margin-top:1px;';
            desc.innerText = dim.desc;
            labelBox.appendChild(desc);
        }

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
        row.appendChild(labelBox);
        row.appendChild(stars);
        list.appendChild(row);
    });

    // 注入评语区
    const commentContainer = document.createElement('div');
    commentContainer.className = 'ssc8-comment-container';

    const commentLabel = document.createElement('label');
    commentLabel.className = 'ssc8-comment-label';
    commentLabel.innerText = i18n('commentLabel');

    const commentInput = document.createElement('textarea');
    commentInput.className = 'ssc8-comment-input';
    commentInput.placeholder = i18n('commentPlaceholder');
    commentInput.dataset.songId = songId;

    const statusMsg = document.createElement('div');
    statusMsg.className = 'ssc8-comment-status';

    let debounceTimer = null;
    commentInput.oninput = () => {
        statusMsg.innerText = '...';
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            saveComment(songId, commentInput.value, () => {
                statusMsg.innerText = '✓';
                setTimeout(() => { if (statusMsg.innerText === '✓') statusMsg.innerText = ''; }, 2000);
            });
        }, 800);
    };

    commentContainer.appendChild(commentLabel);
    commentContainer.appendChild(commentInput);
    commentContainer.appendChild(statusMsg);
    list.appendChild(commentContainer);

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

function saveComment(songId, comment, p1) {
    chrome.storage.local.get([songId], (res) => {
        const ratings = res[songId] || {};
        ratings.comment = comment;
        chrome.storage.local.set({ [songId]: ratings }, p1);
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
            const commentInput = w.querySelector('.ssc8-comment-input');
            if (commentInput && document.activeElement !== commentInput) {
                commentInput.value = ratings.comment || '';
            }
        });

        config.dimensions.forEach(d => total += (ratings[d.id] || 0));
        document.querySelectorAll(`.ssc8-total-badge[data-song-id="${songId}"]`).forEach(b => {
            b.innerText = total;
            b.style.display = total > 0 ? 'block' : 'none';
        });
    });
}

function scanAndInject() {
    // 锁定所有歌曲标题链接作为绝对锚点
    const titleLinks = document.querySelectorAll('.song-title-link');
    
    titleLinks.forEach(link => {
        // 向上寻找最近的卡片容器
        const card = link.closest('.rt-BaseCard, .rt-Card');
        if (!card) return;

        // 幂等检查：避免在动态滚动或状态切换时重复注入
        if (card.dataset.ssc8Injected === 'true') return;
        
        // 标记已注入，无论其内部 UI 如何变化（如 Click to rank 消失）
        card.dataset.ssc8Injected = 'true';
        injectRatingUI(card);
    });
}

let scanTimer = null;
const observer = new MutationObserver(() => {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndInject, 300);
});

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'scroll-to-song' && msg.songId) {
        const target = document.querySelector(`.ssc8-rating-widget[data-song-id="${msg.songId}"], .ssc8-total-badge[data-song-id="${msg.songId}"]`);
        if (target) {
            const card = target.closest('.rt-BaseCard, .rt-Card');
            if (card) {
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                card.classList.add('ssc8-highlight-pulse');
                setTimeout(() => card.classList.remove('ssc8-highlight-pulse'), 2000);
            }
        }
    }
});

observer.observe(document.body, { childList: true, subtree: true });
scanAndInject();
