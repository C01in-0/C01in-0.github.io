function randomSubtitle() {
    // 确保打字机配置存在，且不会碰到你的主标题 "Colin"
    if (window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.typed) {
        var rand = Math.random();
        var text = "";

        // 2% 的 SSR 隐藏彩蛋概率
        if (rand < 0.02) {
            text = "恭喜你！这句话出现的概率仅为万分之一，幸运的人啊，愿你天天开心";
        } 
        // 剩下 98% 平分给 4 句话，每句 24.5%
        else if (rand < 0.265) {
            text = "余虽不敏，亦望卒有所获";
        } else if (rand < 0.510) {
            text = "人生亦不过百岁，何必蹉跎徒伤悲";
        } else if (rand < 0.755) {
            text = "别辜负眼前季节";
        } else {
            text = "Fly, Fly, Fly To Sky";
        }

        // 精准覆盖副标题数组
        window.GLOBAL_CONFIG.typed.sub = [text];
    }
}

// 网页首次加载时执行
randomSubtitle();

// 监听 Pjax 页面跳转（确保不管怎么点，切回主页都会重新抽卡）
document.addEventListener('pjax:complete', randomSubtitle);