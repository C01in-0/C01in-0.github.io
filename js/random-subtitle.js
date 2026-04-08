/* =========================================
   【 Colin's Blog 】随机副标题 (容器级绝对强控版)
   ========================================= */
(function() {
    'use strict'; 
    var isRebuilding = false; 

    function triggerRandomSubtitle(retryCount = 0) {
        if (isRebuilding) return; 

        var subtitleEl = document.getElementById('subtitle');
        var subtitleWrap = document.getElementById('site-subtitle'); // 抓取父容器
        var maxRetries = 40; 

        if (!subtitleEl || !window.typed) {
            if (retryCount < maxRetries) {
                setTimeout(function() { triggerRandomSubtitle(retryCount + 1); }, 50);
            } else {
                // 超时兜底：强行解禁父容器
                if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
            }
            return;
        }

        isRebuilding = true; 

        try {
            // 1. 击碎原生引擎
            if (typeof window.typed.destroy === 'function') {
                window.typed.destroy();
            }

            // 2. 清理残骸
            subtitleEl.innerHTML = '';
            
            // 3. 抽卡装弹
            var rand = Math.random();
            var text = "";
            if (rand < 0.02) text = "恭喜你！这句话出现的概率仅为万分之一，幸运的人啊，愿你天天开心";
            else if (rand < 0.265) text = "余虽不敏，亦望卒有所获";
            else if (rand < 0.510) text = "人生亦不过百岁，何必蹉跎徒伤悲";
            else if (rand < 0.755) text = "别辜负眼前季节";
            else text = "Fly, Fly, Fly To Sky";
            
            // 4. 重建纯净版打字机
            window.typed = new Typed('#subtitle', {
                strings: [text],
                startDelay: 50,      
                typeSpeed: 90,       
                loop: false,         
                showCursor: true,    
                cursorChar: '|',
                onComplete: function() {
                    isRebuilding = false; 
                }
            });

            // 5. 【核心交接】打字机建好后，给父容器打上通行证，解除 CSS 黑盒
            setTimeout(function() {
                if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
                else subtitleEl.style.setProperty('opacity', '1', 'important'); // 极限防崩兜底
            }, 50);

        } catch (error) {
            console.error("[Colin's Blog] 副标题劫持异常：", error);
            if (subtitleEl) subtitleEl.innerHTML = "Fly, Fly, Fly To Sky";
            if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
            isRebuilding = false; 
        }
    }

    // 绑定事件
    window.addEventListener('load', function() { triggerRandomSubtitle(0); });
    document.addEventListener('pjax:complete', function() { triggerRandomSubtitle(0); });
})();
/* =========================================
   【底层修复】解决图片异步加载导致右侧目录 (TOC) 偏移错位的问题
   ========================================= */
(function() {
    'use strict';
    function fixTocScroll() {
        // 抓取文章里的所有图片
        var imgs = document.querySelectorAll('.post-content img');
        if (imgs.length === 0) return;
        
        imgs.forEach(function(img) {
            // 如果图片瞬间就已经加载完了（比如有缓存），直接跳过
            if (img.complete) return;
            
            // 监听：一旦这张图片加载完毕，撑开了网页
            img.onload = function() {
                // 核心魔法：派发一个全局的 Resize（窗口尺寸改变）事件。
                // 这会骗过 Butterfly 主题的底层 JS，逼迫它重新计算目录的高亮坐标！
                window.dispatchEvent(new Event('resize'));
            };
        });
    }

    // 绑定事件（兼容首次加载与 Pjax 切页）
    window.addEventListener('load', fixTocScroll);
    document.addEventListener('pjax:complete', fixTocScroll);
})();


/* =========================================
   【 Colin's Blog 】F12 开发者控制台极客彩蛋 
   ========================================= */
(function() {
    // 使用标准 ASCII 字符，通过 \\ 转义反斜杠防止 JS 解析错误
    var asciiArt = `
   ______      ___     
  / ____/___  / (_)___ 
 / /   / __ \\/ / / __ \\
/ /___/ /_/ / / / / / /
\\____/\\____/_/_/_/ /_/ 
\n`;

    var message = "Welcome to Colin's Matrix.\n\n";
    var info = "Talk is cheap. Show me the shell.\n发现漏洞请手下留情，扣扣：502068770";
    
    // 【核心修复】增加 line-height: 1.2 强制行间距紧凑，并缩小字号提升兼容性
    var styleArt = "color: #49b1f5; font-size: 16px; line-height: 1.2; font-weight: bold; font-family: 'Fira Code', monospace; text-shadow: 0 0 5px rgba(73,177,245,0.5);";
    var styleMsg = "color: #eee; font-size: 14px; background: #2c3e50; padding: 5px 10px; border-radius: 4px; font-family: 'Fira Code', monospace;";
    var styleInfo = "color: #42b983; font-size: 14px; font-family: 'Fira Code', monospace; margin-top: 10px;";
    
    console.log("%c" + asciiArt + "%c" + message + "%c" + info, styleArt, styleMsg, styleInfo);
})();