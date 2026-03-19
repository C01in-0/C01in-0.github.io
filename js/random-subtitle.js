function triggerRandomSubtitle() {
    // 检查主题的打字机实例是否已经安全启动
    if (window.typed) {
        var rand = Math.random();
        var text = "";
        
        // 2% SSR 彩蛋概率
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
        
        // 【核心安全操作】：不破坏元素，只替换弹匣（字符串数据）
        window.typed.strings = [text];
        // 优雅地重启打字机，让它打出新的句子
        window.typed.reset(); 
    }
}

// 网页加载完毕后，稍微等 100 毫秒（确保主题的打字机已经完全站稳脚跟），然后执行换弹
window.addEventListener('load', function() {
    setTimeout(triggerRandomSubtitle, 100);
});

// 适配 Pjax：点击其他页面切回主页时，重新抽卡
document.addEventListener('pjax:complete', function() {
    setTimeout(triggerRandomSubtitle, 100);
});