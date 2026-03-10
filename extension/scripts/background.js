/**
 * Background script for SSC8 Rating Assistant
 */

// 点击图标打开侧边栏
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log('SSC8 Rating Assistant Installed');
});
