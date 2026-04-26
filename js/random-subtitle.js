/* =========================================
   【 Colin's Blog 】随机副标题 (普瑞塞斯 · 乱码重构版)
   ========================================= */
(function() {
    'use strict'; 
    var customTyped = null;
    var isRebuilding = false;

    // 极客特效：数据搅碎机（纯符号乱码剥离）
    function scrambleEffect(element, finalStr, duration, onComplete) {
        const chars = '!<>-_\\/[]{}—=+*^?#________';
        let frame = 0;
        const totalFrames = Math.floor(duration / 30);
        
        const interval = setInterval(() => {
            let output = '';
            for (let i = 0; i < finalStr.length; i++) {
                if (Math.random() < frame / totalFrames) {
                    output += finalStr[i];
                } else {
                    output += chars[Math.floor(Math.random() * chars.length)];
                }
            }
            element.innerText = output;
            if (frame >= totalFrames) {
                clearInterval(interval);
                element.innerText = finalStr; // 兜底对齐
                if (onComplete) onComplete();
            }
            frame++;
        }, 30);
    }

    function triggerRandomSubtitle(retryCount = 0) {
        if (isRebuilding) return;

        var subtitleEl = document.getElementById('subtitle');
        var subtitleWrap = document.getElementById('site-subtitle'); 

        // 核心锁：等待 Typed 引擎就绪
        if (!subtitleEl || typeof Typed === 'undefined') {
            if (retryCount < 40) {
                setTimeout(function() { triggerRandomSubtitle(retryCount + 1); }, 50);
            } else {
                if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
            }
            return;
        }

        isRebuilding = true;

        // 彻底超度旧实例
        try {
            if (window.typed && typeof window.typed.destroy === 'function') window.typed.destroy();
            if (customTyped && typeof customTyped.destroy === 'function') customTyped.destroy();
        } catch (e) {}

        subtitleEl.innerHTML = '';
        if (subtitleWrap) subtitleWrap.classList.remove('colin-ready');
        
        var rand = Math.random();
        var isEasterEgg = rand < 0.15; // 15% 概率触发普瑞塞斯彩蛋

        // 抽卡装弹
        var text = "";
        if (rand < 0.02) text = "恭喜你！这句话出现的概率仅为万分之一，幸运的人啊，愿你天天开心";
        else if (rand < 0.265) text = "余虽不敏，亦望卒有所获";
        else if (rand < 0.510) text = "人生亦不过百岁，何必蹉跎徒伤悲";
        else if (rand < 0.755) text = "别辜负眼前季节";
        else text = "Fly, Fly, Fly To Sky";
        
        // 延迟 100ms 避开 DOM 渲染竞争
        setTimeout(function() {
            if (subtitleWrap) subtitleWrap.classList.add('colin-ready');

            if (isEasterEgg) {
                // 🚀 【第四面墙】：记忆抹除
                subtitleEl.innerText = "你明明记得我，不是吗？";
                subtitleEl.classList.add('glitch-active');

                // 死亡凝视 1.2 秒后，触发乱码搅碎
                setTimeout(function() {
                    subtitleEl.classList.remove('glitch-active');
                    scrambleEffect(subtitleEl, " ".repeat(12), 600, function() {
                        subtitleEl.innerText = '';
                        // 记忆重写，开始常规打字
                        customTyped = new Typed('#subtitle', {
                            strings: [text],
                            typeSpeed: 75,
                            showCursor: true,
                            cursorChar: '|',
                            onComplete: function() { isRebuilding = false; }
                        });
                        window.typed = customTyped; 
                    });
                }, 1200); 

            } else {
                // ☕ 【常规流】：优雅起手
                customTyped = new Typed('#subtitle', {
                    strings: [text],
                    typeSpeed: 75,
                    showCursor: true,
                    cursorChar: '|',
                    onComplete: function() { isRebuilding = false; }
                });
                window.typed = customTyped; 
            }
        }, 100); 
    }

    // 终极修复：监听 PJAX 离开事件，瞬间砸碎死锁！
    document.addEventListener('pjax:send', function() { isRebuilding = false; });

    // 严密监听初次加载与 PJAX 进入事件
    window.addEventListener('load', function() { triggerRandomSubtitle(0); });
    document.addEventListener('pjax:complete', function() { triggerRandomSubtitle(0); });
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
    var info = "Talk is cheap. Show me the shell.\n发现漏洞请手下留情，扣扣：502068770";
    
    var styleArt = "color: #49b1f5; font-size: 16px; line-height: 1.2; font-weight: bold; font-family: 'Fira Code', monospace; text-shadow: 0 0 5px rgba(73,177,245,0.5);";
    var styleMsg = "color: #eee; font-size: 14px; background: #2c3e50; padding: 5px 10px; border-radius: 4px; font-family: 'Fira Code', monospace;";
    var styleInfo = "color: #42b983; font-size: 14px; font-family: 'Fira Code', monospace; margin-top: 10px;";
    
    console.log("%c" + asciiArt + "%c" + message + "%c" + info, styleArt, styleMsg, styleInfo);
})();