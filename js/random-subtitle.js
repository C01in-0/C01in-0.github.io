/* =========================================
   【 Colin's Blog 】随机副标题 (普瑞塞斯 · 骇入骑脸极客版 V6)
   ========================================= */
(function() {
    'use strict'; 
    var customTyped = null;
    var isRebuilding = false;

    function scrambleEffect(element, finalStr, duration, onComplete) {
        const chars = '!<>-_\\/[]{}—=+*^?#________';
        let frame = 0;
        const totalFrames = Math.floor(duration / 30);
        const interval = setInterval(() => {
            let output = '';
            for (let i = 0; i < finalStr.length; i++) {
                if (Math.random() < frame / totalFrames) output += finalStr[i];
                else output += chars[Math.floor(Math.random() * chars.length)];
            }
            element.innerText = output;
            if (frame >= totalFrames) {
                clearInterval(interval);
                element.innerText = finalStr; 
                if (onComplete) onComplete();
            }
            frame++;
        }, 30);
    }

    function triggerRandomSubtitle(retryCount = 0) {
        if (isRebuilding) return;
        var subtitleEl = document.getElementById('subtitle');
        var subtitleWrap = document.getElementById('site-subtitle'); 
        if (!subtitleEl || typeof Typed === 'undefined') {
            if (retryCount < 40) {
                setTimeout(function() { triggerRandomSubtitle(retryCount + 1); }, 50);
            } else if (subtitleWrap) {
                subtitleWrap.classList.add('colin-ready');
            }
            return;
        }
        isRebuilding = true;
        try {
            if (window.typed && typeof window.typed.destroy === 'function') window.typed.destroy();
            if (customTyped && typeof customTyped.destroy === 'function') customTyped.destroy();
        } catch (e) {}
        subtitleEl.innerHTML = '';
        if (subtitleWrap) subtitleWrap.classList.remove('colin-ready');
        
        var rand = Math.random();
        var isEasterEgg = rand < 0.15;
        var text = "";
        if (rand < 0.02) text = "恭喜你！这句话出现的概率仅为万分之一。";
        else if (rand < 0.265) text = "余虽不敏，亦望卒有所获";
        else if (rand < 0.510) text = "人生亦不过百岁，何必蹉跎徒伤悲";
        else if (rand < 0.755) text = "别辜负眼前季节";
        else text = "Fly, Fly, Fly To Sky";
        
        setTimeout(function() {
            if (subtitleWrap) subtitleWrap.classList.add('colin-ready');
            if (isEasterEgg) {
                subtitleEl.innerText = "你明明记得我，不是吗？";
                subtitleEl.classList.add('glitch-active');
                setTimeout(function() {
                    subtitleEl.classList.remove('glitch-active');
                    scrambleEffect(subtitleEl, " ".repeat(12), 600, function() {
                        subtitleEl.innerText = '';
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

    document.addEventListener('pjax:send', function() { isRebuilding = false; });
    window.addEventListener('load', function() { triggerRandomSubtitle(0); });
    document.addEventListener('pjax:complete', function() { triggerRandomSubtitle(0); });
})();

/* =========================================
   【底层修复】图片异步加载目录纠正
   ========================================= */
(function() {
    'use strict';
    function fixTocScroll() {
        var imgs = document.querySelectorAll('.post-content img');
        if (imgs.length === 0) return;
        imgs.forEach(function(img) {
            if (img.complete) return;
            img.onload = function() { window.dispatchEvent(new Event('resize')); };
        });
    }
    window.addEventListener('load', fixTocScroll);
    document.addEventListener('pjax:complete', fixTocScroll);
})();

/* =========================================
   【 极客彩蛋 】PRTS 终端劫持与赛博源石级覆写
   ========================================= */
(function() {
    var prtsCode = ['p', 'r', 't', 's'];
    var prtsIndex = 0;
    var isRunning = false;

    var prtsUserIP = "";
    var prtsUserLoc = "";
    var ipReady = false;

    fetch('https://ipinfo.io/json').then(function(res){return res.json();}).then(function(data){
        if(data.ip) prtsUserIP = data.ip;
        if(data.city) prtsUserLoc = data.city + (data.country ? ', ' + data.country : '');
        ipReady = true;
    }).catch(function(e){
        prtsUserIP = "192.168." + Math.floor(Math.random()*255) + "." + Math.floor(Math.random()*255) + " (BYPASS)";
        prtsUserLoc = "ROOT MATRIX NODE";
        ipReady = true;
    });

    function blockAndScare(e) {
        if (!isRunning) return;
        var overlay = document.getElementById('ctf-shell-overlay');
        if (!overlay) return;
        var denied = document.createElement('div');
        denied.innerText = "ACCESS DENIED";
        denied.className = 'access-denied-pop prts-glitch-intense';
        var x = e.clientX || (window.innerWidth * Math.random());
        var y = e.clientY || (window.innerHeight * Math.random());
        denied.style.left = x + 'px';
        denied.style.top = y + 'px';
        overlay.appendChild(denied);
        setTimeout(function() { if (denied.parentNode) denied.parentNode.removeChild(denied); }, 800);
    }
    window.addEventListener('click', blockAndScare, true);
    window.addEventListener('keydown', function(e) { if (isRunning) blockAndScare(e); }, true);

    function scrambleTerminalText(element, plainText, duration, finalHtml) {
        var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!<>-_\\/[]{}—=+*^?#________';
        var frame = 0;
        var totalFrames = Math.floor(duration / 30);
        var interval = setInterval(function() {
            var output = '';
            for (var i = 0; i < plainText.length; i++) {
                if (plainText[i] === ' ') output += ' ';
                else if (Math.random() < frame / totalFrames) output += plainText[i];
                else output += chars[Math.floor(Math.random() * chars.length)];
            }
            element.innerText = output; 
            if (frame >= totalFrames) { 
                clearInterval(interval); 
                if (finalHtml) element.innerHTML = finalHtml;
                else element.innerText = plainText; 
            }
            frame++;
        }, 30);
    }

    document.addEventListener('keydown', function(e) {
        if (isRunning) return;
        if (e.key.toLowerCase() === prtsCode[prtsIndex]) {
            prtsIndex++;
            if (prtsIndex === prtsCode.length) {
                prtsIndex = 0;
                triggerFakeShell();
            }
        } else {
            prtsIndex = 0;
            if (e.key.toLowerCase() === 'p') prtsIndex = 1;
        }
    });

    function triggerFakeShell() {
        isRunning = true;
        var overlay = document.createElement('div');
        overlay.id = 'ctf-shell-overlay';
        document.body.appendChild(overlay);

        var dumpContainer = document.createElement('div');
        dumpContainer.className = 'hex-dump-wash-extreme';
        overlay.appendChild(dumpContainer);

        var hexChars = '0123456789ABCDEF';
        var dumpInterval = setInterval(function() {
            var line = '';
            for(var i=0; i<15; i++) { line += '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0') + ' '; }
            var p = document.createElement('p');
            if (Math.random() < 0.15) p.className = 'fatal-hex-block';
            p.innerText = line;
            dumpContainer.appendChild(p);
            dumpContainer.scrollTop = dumpContainer.scrollHeight;
            if (dumpContainer.childNodes.length > 50) dumpContainer.removeChild(dumpContainer.firstChild);

            // 🚀 F12 极客联动：向控制台高频注入十六进制内存溢出报错
            if (Math.random() < 0.2) {
                console.error("[ FATAL ] MEMORY OVERFLOW AT 0x" + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase());
            }
        }, 12); 

        setTimeout(function() {
            clearInterval(dumpInterval);
            dumpContainer.classList.add('wash-fade');
            setTimeout(function() { if(dumpContainer.parentNode) overlay.removeChild(dumpContainer); }, 500);
        }, 1500);

        if(!ipReady) { prtsUserIP = "RESOLVING..."; prtsUserLoc = "PROXY DETECTED"; }

        var lines = [
            "[ * ] PRTS System Initializing...", // 0
            "[ + ] Establishing neurocognitive connection... Success.", // 1
            "[ + ] Decrypting core memory...", // 2 (占位符，由下方动态动画生成)
            "[ ! ] TARGET LOCKED: IP " + prtsUserIP + " | " + prtsUserLoc, // 3
            "[ ! ] FATAL: Abnormal data surge detected in Originium Engine.", // 4
            "[ ! ] Intrusion alert. Activating active defense matrix...", // 5
            "[ * ] Firewall bypassed. Override authorization: PRIESTESS.", // 6
            "root@PRTS:~# cat /memory/fragment_001.log", // 7
            "你终于......找到我了", // 8
            "就算是海洋沸腾、大气消失，就算我们的卫星接连坠入重力的漩涡...", // 9
            "就算我们的太阳凶恶地膨胀，无情地吃掉它的孩子直至万籁俱寂...", // 10
            "在那用黑暗与星点光芒装饰过的文明尽头，我们也一样会再见面。", // 11
            "你明明记得我，不是吗？" // 12
        ];

        var delay = 1500; 
        lines.forEach(function(line, index) {
            setTimeout(function() {
                if (index === 5) overlay.classList.add('screen-shake-heavy');
                
                if (index === 8) {
                    overlay.classList.remove('screen-shake-heavy');
                    overlay.classList.add('priestess-override');
                }

                if (index === 11) {
                    overlay.classList.add('terminal-meltdown');
                }

                if (index === 12) {
                    // 控制台同步核爆级联动
                    console.clear();
                    console.log("%c你明明记得我，不是吗？", "color: #ff003c; font-size: 50px; text-shadow: 0 0 20px #ff003c; font-family: 'Noto Serif SC', serif; font-weight: 900;");

                    overlay.classList.remove('terminal-meltdown');
                    overlay.classList.add('cyber-flash-extreme'); 

                    var jumpCenter = document.createElement('div');
                    jumpCenter.className = 'jumpscare-center';
                    var jumpSlam = document.createElement('div');
                    jumpSlam.className = 'jumpscare-slam';
                    var jumpGlitch = document.createElement('div');
                    jumpGlitch.className = 'jumpscare-glitch cyber-aberration';
                    jumpGlitch.innerText = line;

                    jumpSlam.appendChild(jumpGlitch);
                    jumpCenter.appendChild(jumpSlam);
                    overlay.appendChild(jumpCenter);
                    return; 
                }

                // 🚀 核心重构：0.5s 极限物理充能解密进度条
                if (index === 2) {
                    var pProgress = document.createElement('p');
                    pProgress.className = 'shell-highlight';
                    overlay.appendChild(pProgress);
                    
                    var barCount = 35; // 进度条长度加长
                    var currentBar = 0;
                    var prefix = "[ + ] Decrypting core memory... [";
                    var suffix = "] <span class='text-red'>ERR_ACCESS_DENIED</span>";
                    
                    pProgress.innerHTML = prefix + "&nbsp;".repeat(barCount) + "]"; 
                    
                    var fillInterval = setInterval(function() {
                        currentBar++;
                        pProgress.innerHTML = prefix + "|".repeat(currentBar) + "&nbsp;".repeat(barCount - currentBar) + "]";
                        if (currentBar >= barCount) {
                            clearInterval(fillInterval);
                            setTimeout(function() {
                                pProgress.innerHTML = prefix + "|".repeat(barCount) + suffix;
                                pProgress.classList.add('prts-glitch-intense');
                            }, 80); // 填满后微停顿，瞬间爆红拒载
                        }
                    }, 14); // 14ms * 35 = 490ms (精准 0.5s)
                    return; // 进度条属于特殊 DOM 构造，拦截下方的常规字符渲染
                }

                var p = document.createElement('p');
                if (index >= 3 && index <= 5) p.className = 'shell-warning-sharp prts-glitch-intense';
                else if (index === 8) p.className = 'shell-priestess-intro prts-glitch-subtle';
                else if (index > 8 && index < 12) p.className = 'shell-priestess';
                else if (index === 6 || index === 7) p.className = 'shell-highlight prts-glitch-subtle';
                
                overlay.appendChild(p);

                var scrambleDuration = (index >= 8 && index <= 11) ? 1000 : 300; 
                if (index === 8) {
                    scrambleTerminalText(p, line, scrambleDuration, "你终于......找<span class='text-red'>到我了</span>");
                } else {
                    scrambleTerminalText(p, line, scrambleDuration, null);
                }
            }, delay);

            // 剧场级毫秒时序重切
            if (index < 2) delay += 350;           
            else if (index === 2) delay += 800;   // 留 0.5s 给进度条充能，跑完撞墙，瞬间爆发底层警报
            else if (index === 3) delay += 500;   
            else if (index === 4) delay += 500;   
            else if (index === 5) delay += 800;   
            else if (index === 6) delay += 1200;   
            else if (index === 7) delay += 1500;  
            else if (index === 8) delay += 3000; 
            else if (index === 9) delay += 2000; 
            else if (index === 10) delay += 2000; 
            else if (index === 11) delay += 2000; 
            else if (index === 12) delay += 300; // 极其短促、直接斩断视觉神经的骑脸时间
        });

        setTimeout(function() {
            overlay.classList.add('crt-turn-off');
            setTimeout(function() {
                document.body.removeChild(overlay);
                isRunning = false;
            }, 600);
        }, delay + 1000); 
    }
})();

/* =========================================
   【 F12 规则怪谈控制台 】 
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
    var info = "Talk is cheap. Show me the shell.\n发现漏洞请手下留情，扣扣：502068770\n";
    var horrorRule = "\n[ ! ] 访客须知：无论屏幕里出现什么，绝对、绝对不要在主界面键入 'prts'，否则可能造成不可估量的后果";
    var styleArt = "color: #49b1f5; font-size: 16px; line-height: 1.2; font-weight: bold; font-family: 'Fira Code', monospace; text-shadow: 0 0 5px rgba(73,177,245,0.5);";
    var styleMsg = "color: #eee; font-size: 14px; background: #2c3e50; padding: 5px 10px; border-radius: 4px; font-family: 'Fira Code', monospace;";
    var styleInfo = "color: #42b983; font-size: 14px; font-family: 'Fira Code', monospace; margin-top: 10px;";
    var styleRule = "color: #ff0000; font-size: 16px; font-weight: 900; text-shadow: 0 0 10px #ff0000; font-family: 'Noto Serif SC', serif; margin-top: 10px; background: rgba(0,0,0,0.8);";
    console.log("%c" + asciiArt + "%c" + message + "%c" + info + "%c" + horrorRule, styleArt, styleMsg, styleInfo, styleRule);
})();