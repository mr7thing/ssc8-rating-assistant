/**
 * SSC8 Rating Assistant - Content Script
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
});

function injectRatingUI(songElement) {
    if (songElement.querySelector('.ssc8-rating-widget')) return;

    const titleLink = songElement.querySelector('a[href*="/s/"]');
    let songId = null;
    let songTitle = "Unknown Song";

    if (titleLink) {
        const href = titleLink.getAttribute('href');
        songId = href.split('/').pop();
        songTitle = titleLink.innerText.split('[')[0].trim();
    } else {
        const idMatch = songElement.innerText.match(/SONGCONT_[A-Za-z0-9]+/);
        songId = idMatch ? idMatch[0] : null;
    }

    if (!songId) return;

    const container = document.createElement('div');
    container.className = 'ssc8-rating-widget ssc8-extension-root';
    container.dataset.songId = songId;

    // 维度列表：每行一个
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    config.dimensions.forEach(dim => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';

        const label = document.createElement('div');
        label.style.cssText = 'font-size:13px; font-weight:500; min-width:80px;';
        label.innerText = dim.name;

        const rightPart = document.createElement('div');
        rightPart.style.cssText = 'display:flex; align-items:center; gap:12px;';

        const starsContainer = document.createElement('div');
        starsContainer.className = 'ssc8-stars-row';

        for (let i = 1; i <= dim.max; i++) {
            const star = document.createElement('span');
            star.className = 'ssc8-star';
            star.innerHTML = '★';
            star.dataset.value = i;
            star.dataset.dimId = dim.id;

            star.onclick = (e) => {
                e.stopPropagation();
                saveRating(songId, dim.id, i);
            };
            starsContainer.appendChild(star);
        }

        const scoreVal = document.createElement('span');
        scoreVal.className = 'score-val';
        scoreVal.dataset.dim = dim.id;
        scoreVal.style.cssText = 'font-size:14px; font-weight:bold; color:var(--ssc8-star-active); min-width:20px; text-align:right;';
        scoreVal.innerText = '0';

        rightPart.appendChild(starsContainer);
        rightPart.appendChild(scoreVal);

        row.appendChild(label);
        row.appendChild(rightPart);
        listContainer.appendChild(row);
    });

    container.appendChild(listContainer);

    // 关键修正：将容器注入到 Card 的最底部，不遮挡原有信息
    // 寻找 Card 的内容容器
    const cardContent = songElement.closest('.rt-Card') || songElement;
    if (cardContent) {
        cardContent.style.height = 'auto';
        cardContent.style.display = 'flex';
        cardContent.style.flexDirection = 'column';
        cardContent.appendChild(container);

        loadSavedRatings(container, songId);
    }
}

function saveRating(songId, dimId, value) {
    chrome.storage.local.get([songId], (result) => {
        const ratings = result[songId] || {};
        if (ratings[dimId] === value) {
            delete ratings[dimId];
        } else {
            ratings[dimId] = value;
        }

        chrome.storage.local.set({ [songId]: ratings }, () => {
            updateWidgetUI(songId);
        });
    });
}

function updateWidgetUI(songId) {
    const widgets = document.querySelectorAll(`.ssc8-rating-widget[data-song-id="${songId}"]`);
    chrome.storage.local.get([songId], (result) => {
        const ratings = result[songId] || {};
        widgets.forEach(widget => {
            widget.querySelectorAll('.ssc8-star').forEach(star => {
                const dimId = star.dataset.dimId;
                const val = parseInt(star.dataset.value);
                star.classList.toggle('active', ratings[dimId] >= val);
            });
            widget.querySelectorAll('.score-val').forEach(valSpan => {
                const dimId = valSpan.dataset.dim;
                valSpan.innerText = ratings[dimId] || 0;
            });
        });
    });
}

function loadSavedRatings(widget, songId) {
    chrome.storage.local.get([songId], (result) => {
        const ratings = result[songId] || {};
        widget.querySelectorAll('.ssc8-star').forEach(star => {
            const dimId = star.dataset.dimId;
            const val = parseInt(star.dataset.value);
            star.classList.toggle('active', ratings[dimId] >= val);
        });
        widget.querySelectorAll('.score-val').forEach(valSpan => {
            const dimId = valSpan.dataset.dim;
            valSpan.innerText = ratings[dimId] || 0;
        });
    });
}

const observer = new MutationObserver((mutations) => {
    document.querySelectorAll('.rt-Card').forEach(card => {
        if (card.innerText.includes('Click to rank')) {
            injectRatingUI(card);
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });

document.querySelectorAll('.rt-Card').forEach(card => {
    if (card.innerText.includes('Click to rank')) {
        injectRatingUI(card);
    }
});
