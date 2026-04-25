/* =========================================
   【 Colin's Blog 】随机副标题 (纯净重构版)
   ========================================= */
(function() {
    'use strict'; 
    var customTyped = null;

    function triggerRandomSubtitle() {
        var subtitleEl = document.getElementById('subtitle');
        var subtitleWrap = document.getElementById('site-subtitle'); 
        
        if (!subtitleEl) return;

        // 1. 立即剥夺显示权限，隐身准备重绘（完美杀掉原生的幽灵光标）
        if (subtitleWrap) subtitleWrap.classList.remove('colin-ready');

        // 2. 暴力销毁历史实例，彻底解除 PJAX 死锁
        try {
            if (window.typed && typeof window.typed.destroy === 'function') {
                window.typed.destroy();
            }
            if (customTyped && typeof customTyped.destroy === 'function') {
                customTyped.destroy();
            }
        } catch (e) {}

        // 3. 物理清空残骸
        subtitleEl.innerHTML = '';
        
        // 4. 抽卡装弹
        var rand = Math.random();
        var text = "";
        if (rand < 0.02) text = "恭喜你！这句话出现的概率仅为万分之一，幸运的人啊，愿你天天开心";
        else if (rand < 0.265) text = "余虽不敏，亦望卒有所获";
        else if (rand < 0.510) text = "人生亦不过百岁，何必蹉跎徒伤悲";
        else if (rand < 0.755) text = "别辜负眼前季节";
        else text = "Fly, Fly, Fly To Sky";
        
        // 5. 仅仅等待 80 毫秒（避开原生引擎初始化），迅速接管战场
        setTimeout(function() {
            try {
                customTyped = new Typed('#subtitle', {
                    strings: [text],
                    startDelay: 0,      
                    typeSpeed: 90,       
                    loop: false,         
                    showCursor: true,    
                    cursorChar: '|'
                });
                window.typed = customTyped; // 覆盖全局，防止原生代码报错
            } catch(e) {
                subtitleEl.innerHTML = text; // 究极兜底：万一库没加载，直接硬塞文字
            }

            // 6. 发放通行证，触发 CSS 0.5秒优雅丝滑淡入！
            if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
        }, 80); 
    }

    // 监听初次加载与 PJAX 无刷新跳转
    window.addEventListener('load', triggerRandomSubtitle);
    document.addEventListener('pjax:complete', triggerRandomSubtitle);
})();


/* =========================================
   【底层修复】解决图片异步加载导致右侧目录 (TOC) 偏移错位的问题
   ========================================= */
(function() {
    'use strict';
    function fixTocScroll() {
        var imgs = document.querySelectorAll('.post-content img');
        if (imgs.length === 0) return;
        
        imgs.forEach(function(img) {
            if (img.complete) return;
            img.onload = function() {
                window.dispatchEvent(new Event('resize'));
            };
        });
    }

    window.addEventListener('load', fixTocScroll);
    document.addEventListener('pjax:complete', fixTocScroll);
})();


/* =========================================
   【 Colin's Blog 】F12 开发者控制台极客彩蛋 
   ========================================= */
(function() {
    var asciiArt = `
   ______      ___     
  / ____/___  / (_)___ 
 / /   / __ \\/ / / __ \\
/ /___/ /_/ / / / / / /
\\____/\\____/_/_/_/ /_/ 
\n`;

    var message = "Welcome to Colin's Matrix.\n\n";
    var info = "Talk is cheap. Show me the shell.\n发现漏洞请手下留情，扣扣号：502068770";
    
    var styleArt = "color: #49b1f5; font-size: 16px; line-height: 1.2; font-weight: bold; font-family: 'Fira Code', monospace; text-shadow: 0 0 5px rgba(73,177,245,0.5);";
    var styleMsg = "color: #eee; font-size: 14px; background: #2c3e50; padding: 5px 10px; border-radius: 4px; font-family: 'Fira Code', monospace;";
    var styleInfo = "color: #42b983; font-size: 14px; font-family: 'Fira Code', monospace; margin-top: 10px;";
    
    console.log("%c" + asciiArt + "%c" + message + "%c" + info, styleArt, styleMsg, styleInfo);
})();