function initRandomSubtitle() {
    // 增加一个调试日志，按 F12 可以在 Console 看到它有没有运行
    console.log("随机副标题脚本已启动！");

    if (window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.typed) {
        var rand = Math.random();
        var text = "";
        
        if (rand < 0.02) {
            text = "恭喜你！这句话出现的概率仅为万分之一，幸运的人啊，愿你天天开心";
        } else if (rand < 0.265) {
            text = "余虽不敏，亦望卒有所获";
        } else if (rand < 0.510) {
            text = "人生亦不过百岁，何必蹉跎徒伤悲";
        } else if (rand < 0.755) {
            text = "别辜负眼前季节";
        } else {
            text = "Fly, Fly, Fly To Sky";
        }
        
        // 覆盖打字机内容
        window.GLOBAL_CONFIG.typed.sub = [text];
    }
}

// 确保在主程序加载后立即执行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRandomSubtitle);
} else {
    initRandomSubtitle();
}
// 适配 Pjax
document.addEventListener('pjax:complete', initRandomSubtitle);