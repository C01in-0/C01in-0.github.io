/* =========================================
   【Colin's Blog】健壮版副标题劫持脚本 (解决光标竞态问题)
   ========================================= */
(function() {
    'use strict'; 

    function triggerRandomSubtitle(retryCount = 0) {
        var subtitleEl = document.getElementById('subtitle');
        var maxRetries = 15; 

        // 1. 安全轮询（增加保护层）
        if (!subtitleEl || !window.typed) {
            if (retryCount < maxRetries) {
                setTimeout(function() { triggerRandomSubtitle(retryCount + 1); }, 100);
            } else {
                console.warn("[Colin's Blog] 打字机加载超时，已安全放弃接管。");
            }
            return;
        }

        // 2. 核心执行：强行蒸发初始文本，防光标空移
        try {
            subtitleEl.style.opacity = '0';
            subtitleEl.style.transition = 'none'; 
            // 【关键击杀】将原本生成的字符内容彻底清空，确保打字机从空串开始
            subtitleEl.textContent = ""; 

            var rand = Math.random();
            var text = "";
            
            // 抽卡概率配置
            if (rand < 0.02) text = "恭喜你！这句话出现的概率仅为万分之一，幸运的人啊，愿你天天开心";
            else if (rand < 0.265) text = "余虽不敏，亦望卒有所获";
            else if (rand < 0.510) text = "人生亦不过百岁，何必蹉跎徒伤悲";
            else if (rand < 0.755) text = "别辜负眼前季节";
            else text = "Fly, Fly, Fly To Sky";
            
            window.typed.strings = [text];
            window.typed.reset(); 
            
            requestAnimationFrame(function() {
                setTimeout(function() {
                    subtitleEl.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    subtitleEl.style.opacity = '1';
                }, 150);
            });
        } catch (error) {
            console.error("[Colin's Blog] 副标题劫持异常，已拦截：", error);
        }
    }

    // 绑定事件（兼容首次加载与 Pjax）
    window.addEventListener('load', function() { triggerRandomSubtitle(0); });
    document.addEventListener('pjax:complete', function() { triggerRandomSubtitle(0); });
})();